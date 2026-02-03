import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { enqueueAnalysisRun } from "@/lib/queue";

// Validation schema
const createDecisionSchema = z.object({
  situation: z.string().min(10, "Situation must be at least 10 characters"),
  chosenDecision: z.string().min(5, "Decision must be at least 5 characters"),
  personalReasoning: z.string().optional(),
});

// POST /api/decisions - Create a new decision
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createDecisionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { situation, chosenDecision, personalReasoning } = validationResult.data;

    // Get AI provider from environment (default to mock)
    const aiProvider = process.env.AI_PROVIDER || "mock";

    // Create decision and initial analysis run in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create decision
      const decision = await tx.decision.create({
        data: {
          userId: session.user.id,
          situation,
          chosenDecision,
          personalReasoning: personalReasoning || null,
          status: "PENDING",
        },
      });

      // 2. Create initial analysis run
      const run = await tx.decisionAnalysisRun.create({
        data: {
          decisionId: decision.id,
          status: "PENDING",
          provider: aiProvider,
        },
      });

      // 3. Update decision to point to this run
      await tx.decision.update({
        where: { id: decision.id },
        data: { latestRunId: run.id },
      });

      return { decision, run };
    });

    // Enqueue run for background analysis
    try {
      await enqueueAnalysisRun(result.run.id);
    } catch (queueError) {
      console.error("Failed to enqueue run for analysis:", queueError);
      // Don't fail the request if queueing fails - decision is still created
    }

    return NextResponse.json(result.decision, { status: 201 });
  } catch (error) {
    console.error("Error creating decision:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/decisions - Get all decisions for authenticated user
export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch decisions with latest run
    const decisions = await prisma.decision.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        latestRun: {
          select: {
            id: true,
            status: true,
            categoryText: true,
          },
        },
      },
    });

    return NextResponse.json(decisions);
  } catch (error) {
    console.error("Error fetching decisions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

