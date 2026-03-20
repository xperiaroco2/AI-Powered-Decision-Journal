"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface Attachment {
  id: string;
  title: string;
  status: string;
  decisionId: string;
}

interface RetrievedDecision {
  id: string;
  situation: string;
  chosenDecision: string;
  personalReasoning: string | null;
  similarity: number;
}

interface RetrievedChunk {
  chunkId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}

interface AdvisoryResponse {
  advice: string;
  retrievedDecisions: RetrievedDecision[];
  retrievedChunks?: RetrievedChunk[];
  metadata: {
    retrievalCount: number;
    retrievalThreshold: number;
    hasContext: boolean;
    retrievalType: "decisions" | "attachment";
    attachmentTitle?: string;
    embeddingProvider: string;
    llmProvider: string;
    processingTimeMs: number;
  };
}

interface AdviceClientProps {
  userId: string;
}

export default function AdviceClient({ userId: _userId }: AdviceClientProps) {
  const { accessToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AdvisoryResponse | null>(null);

  // Fetch user's attachments
  useEffect(() => {
    async function fetchAttachments() {
      try {
        setLoadingAttachments(true);
        const response = await fetch("/api/attachments", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          setAttachments(data.attachments || []);
        }
      } catch (err) {
        console.error("Failed to fetch attachments:", err);
      } finally {
        setLoadingAttachments(false);
      }
    }

    fetchAttachments();
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponse(null);

    // Validation
    if (question.trim().length < 10) {
      setError("Question must be at least 10 characters");
      return;
    }

    if (question.trim().length > 2000) {
      setError("Question must be at most 2000 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const requestBody: { question: string; relatedAttachmentId?: string } = {
        question: question.trim(),
      };

      if (selectedAttachmentId) {
        requestBody.relatedAttachmentId = selectedAttachmentId;
      }

      const res = await fetch("/api/advice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to get advice");
        return;
      }

      setResponse(data);
    } catch (_err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setQuestion("");
    setSelectedAttachmentId("");
    setResponse(null);
    setError(null);
  };

  // Filter only READY attachments
  const readyAttachments = attachments.filter((a) => a.status === "READY");

  return (
    <div className="space-y-6">
      {/* Question Form */}
      <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="question"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Your Question <span className="text-red-500">*</span>
            </label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Ask a question about a decision you&apos;re facing (10-2000 characters)
            </p>
            <textarea
              id="question"
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-2 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
              placeholder="e.g., Should I accept this job offer? What factors should I consider?"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {question.length} / 2000 characters
            </p>
          </div>

          <div>
            <label
              htmlFor="attachment"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Related Document (optional)
            </label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Select a document to get advice based on its content, or leave empty to use your past decisions
            </p>
            <select
              id="attachment"
              value={selectedAttachmentId}
              onChange={(e) => setSelectedAttachmentId(e.target.value)}
              disabled={loadingAttachments}
              className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
            >
              <option value="">Use my past decisions</option>
              {readyAttachments.length > 0 && (
                <optgroup label="Available Documents">
                  {readyAttachments.map((attachment) => (
                    <option key={attachment.id} value={attachment.id}>
                      {attachment.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {!loadingAttachments && readyAttachments.length === 0 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                No documents available. Upload documents to decisions to use them here.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {isSubmitting ? "Getting advice..." : "Get Advice"}
            </button>
            {response && (
              <button
                type="button"
                onClick={handleReset}
                className="cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Ask Another Question
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Loading State */}
      {isSubmitting && (
        <div className="rounded-lg bg-white p-8 shadow dark:bg-zinc-800">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="text-zinc-600 dark:text-zinc-400">
                {selectedAttachmentId
                  ? "Analyzing document and generating advice..."
                  : "Analyzing your past decisions and generating advice..."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Response Display */}
      {response && !isSubmitting && (
        <div className="space-y-6">
          {/* AI Advice */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              AI Advice
            </h2>
            <div className="mt-4 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {response.advice}
            </div>
          </div>

          {/* Retrieved Context */}
          {response.metadata.hasContext && (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Context Used
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {response.metadata.retrievalType === "decisions"
                  ? `Based on ${response.retrievedDecisions.length} similar past decision${response.retrievedDecisions.length === 1 ? "" : "s"}`
                  : `Based on ${response.retrievedChunks?.length || 0} relevant section${(response.retrievedChunks?.length || 0) === 1 ? "" : "s"} from "${response.metadata.attachmentTitle}"`}
              </p>

              {/* Decision-based context */}
              {response.metadata.retrievalType === "decisions" && (
                <div className="mt-4 space-y-3">
                  {response.retrievedDecisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                          {decision.chosenDecision}
                        </h3>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {Math.round(decision.similarity * 100)}% similar
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {decision.situation}
                      </p>
                      {decision.personalReasoning && (
                        <p className="mt-2 text-sm italic text-zinc-500 dark:text-zinc-500">
                          &quot;{decision.personalReasoning}&quot;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Attachment-based context */}
              {response.metadata.retrievalType === "attachment" && response.retrievedChunks && (
                <div className="mt-4 space-y-3">
                  {response.retrievedChunks.map((chunk) => (
                    <div
                      key={chunk.chunkId}
                      className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Section {chunk.chunkIndex + 1}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {Math.round(chunk.similarity * 100)}% relevant
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No Context Warning */}
          {!response.metadata.hasContext && (
            <div className="rounded-lg bg-yellow-50 p-6 dark:bg-yellow-900/20">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                ⚠️ Limited Context
              </h3>
              <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                {response.metadata.retrievalType === "decisions"
                  ? "No similar past decisions found. The advice is based on general knowledge without your personal decision history."
                  : "No relevant sections found in the document. The advice may be less specific to your document."}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/50">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Request Details
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <div>
                <span className="font-medium">Retrieval Type:</span>{" "}
                {response.metadata.retrievalType === "decisions" ? "Past Decisions" : "Document"}
              </div>
              <div>
                <span className="font-medium">Context Found:</span>{" "}
                {response.metadata.retrievalCount} item{response.metadata.retrievalCount === 1 ? "" : "s"}
              </div>
              <div>
                <span className="font-medium">LLM Model:</span> {response.metadata.llmProvider}
              </div>
              <div>
                <span className="font-medium">Processing Time:</span>{" "}
                {(response.metadata.processingTimeMs / 1000).toFixed(2)}s
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

