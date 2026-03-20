"use client";

import { useState, useEffect } from "react";
import { AttachmentStatusBadge } from "@/components/ui/attachment-status-badge";
import { useAttachmentUpdates } from "@/hooks/useAttachmentUpdates";
import { useAuth } from "@/hooks/useAuth";

interface Attachment {
  id: string;
  title: string;
  status: string;
  error: string | null;
  createdAt: Date;
  chunkCount: number;
}

interface DecisionAttachmentsProps {
  decisionId: string;
}

export default function DecisionAttachments({ decisionId }: DecisionAttachmentsProps) {
  const { accessToken } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Real-time updates
  const { updates } = useAttachmentUpdates(decisionId);

  // Fetch attachments
  useEffect(() => {
    if (accessToken) {
      fetchAttachments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionId, accessToken]);

  // Apply real-time updates
  useEffect(() => {
    if (updates.size > 0) {
      setAttachments((prev) =>
        prev.map((attachment) => {
          const update = updates.get(attachment.id);
          if (update) {
            return {
              ...attachment,
              status: update.status,
              error: update.error || attachment.error,
            };
          }
          return attachment;
        })
      );
    }
  }, [updates]);

  const fetchAttachments = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/decisions/${decisionId}/attachments`);

      if (!response.ok) {
        throw new Error("Failed to fetch attachments");
      }

      const data = await response.json();
      setAttachments(data.attachments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    // Validation
    if (title.trim().length < 3) {
      setUploadError("Title must be at least 3 characters");
      return;
    }

    if (!file) {
      setUploadError("Please select a file to upload");
      return;
    }

    if (!accessToken) {
      setUploadError("You must be logged in to upload attachments");
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("file", file);

      const response = await fetch(`/api/decisions/${decisionId}/attachments`, {
        method: "POST",
        body: formData, // Don't set Content-Type header - browser will set it with boundary
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || "Failed to upload attachment");
        return;
      }

      // Success - reset form and refresh list
      setTitle("");
      setFile(null);
      setShowUploadForm(false);
      fetchAttachments();
    } catch (_err) {
      setUploadError("An error occurred. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploadError(null);

    // Check file size (max 10MB for PDF/DOCX, 5MB for text)
    const maxSize = selectedFile.name.match(/\.(pdf|docx?)$/i) ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setUploadError(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    // Check file type
    const allowedExtensions = /\.(txt|md|pdf|docx?)$/i;
    if (!selectedFile.name.match(allowedExtensions)) {
      setUploadError("Only .txt, .md, .pdf, .doc, and .docx files are supported");
      return;
    }

    // Set title from filename if empty
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }

    // Store the file (no client-side reading)
    setFile(selectedFile);
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Attachments
        </h2>
        <div className="mt-4 flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading attachments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Attachments
        </h2>
        <div className="mt-4 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Attachments
        </h2>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          {showUploadForm ? "Cancel" : "+ Add Attachment"}
        </button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <form onSubmit={handleUpload} className="mt-4 space-y-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
          <div>
            <label
              htmlFor="attachment-title"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="attachment-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-500"
              placeholder="e.g., Employment Contract"
            />
          </div>

          <div>
            <label
              htmlFor="attachment-file"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              File <span className="text-red-500">*</span>
            </label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Supported: .txt, .md, .pdf, .doc, .docx (max 10MB for PDF/DOCX, 5MB for text)
            </p>
            <input
              id="attachment-file"
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="mt-2 block w-full text-sm text-zinc-900 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-50 dark:file:bg-zinc-700 dark:file:text-zinc-300 dark:hover:file:bg-zinc-600"
            />
            {file && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {uploadError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {uploadError}
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading}
            className="w-full cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            {isUploading ? "Uploading..." : "Upload Attachment"}
          </button>
        </form>
      )}

      {/* Attachments List */}
      <div className="mt-4">
        {attachments.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-8 text-center dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No attachments yet. Add documents to get AI advice based on their content.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                      {attachment.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Uploaded {new Date(attachment.createdAt).toLocaleDateString()} •{" "}
                      {attachment.chunkCount} {attachment.chunkCount === 1 ? "chunk" : "chunks"}
                    </p>
                    {attachment.error && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        Error: {attachment.error}
                      </p>
                    )}
                  </div>
                  <AttachmentStatusBadge status={attachment.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

