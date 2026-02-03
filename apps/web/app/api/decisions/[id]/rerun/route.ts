import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { enqueueAnalysisRun } from "@/lib/queue";

// POST /api/decisions/:id/rerun - Create a new analysis run for an existing decision
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: decisionId } = await params;

    // 1. Fetch decision and verify ownership
    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: {
        runs: {
          where: {
            status: "PROCESSING",
          },
          take: 1,
        },
      },
    });

    if (!decision) {
      return NextResponse.json(
        { error: "Decision not found" },
        { status: 404 }
      );
    }

    // 2. Verify ownership
    if (decision.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden - You don't own this decision" },
        { status: 403 }
      );
    }

    // 3. Check if there's already a PROCESSING run
    if (decision.runs.length > 0) {
      return NextResponse.json(
        {
          error: "Analysis already in progress",
          message: "Please wait for the current analysis to complete before retrying",
        },
        { status: 409 } // Conflict
      );
    }

    // 4. Get AI provider from environment (default to mock)
    const aiProvider = process.env.AI_PROVIDER || "mock";

    // 5. Create new analysis run and update decision in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create new run
      const run = await tx.decisionAnalysisRun.create({
        data: {
          decisionId: decision.id,
          status: "PENDING",
          provider: aiProvider,
        },
      });

      // Update decision status and latestRunId
      await tx.decision.update({
        where: { id: decision.id },
        data: {
          status: "PENDING",
          latestRunId: run.id,
          errorMessage: null, // Clear previous error
        },
      });

      return { run };
    });

    // 6. Enqueue run for background analysis
    try {
      await enqueueAnalysisRun(result.run.id);
    } catch (queueError) {
      console.error("Failed to enqueue run for analysis:", queueError);
      return NextResponse.json(
        { error: "Failed to enqueue analysis" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Analysis re-run started",
        runId: result.run.id,
        status: "PENDING",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating rerun:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

