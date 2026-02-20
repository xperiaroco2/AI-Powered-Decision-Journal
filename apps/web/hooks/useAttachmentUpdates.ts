"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface AttachmentUpdateEvent {
  type: "attachment:update";
  attachmentId: string;
  decisionId: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  error?: string;
}

export function useAttachmentUpdates(decisionId: string) {
  const [updates, setUpdates] = useState<Map<string, { status: string; error?: string }>>(new Map());
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize Socket.IO client
    const socketInstance = io({
      path: "/api/socket",
    });

    socketInstance.on("connect", () => {
      console.log("✓ Connected to WebSocket server (attachments)");
    });

    socketInstance.on("disconnect", () => {
      console.log("✗ Disconnected from WebSocket server (attachments)");
    });

    // Listen for attachment updates
    socketInstance.on("attachment:update", (event: AttachmentUpdateEvent) => {
      console.log("📥 Received attachment event:", event);
      
      // Only update if it's for this decision
      if (event.decisionId === decisionId) {
        setUpdates((prev) => {
          const newUpdates = new Map(prev);
          newUpdates.set(event.attachmentId, {
            status: event.status,
            error: event.error,
          });
          return newUpdates;
        });
      }
    });

    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setSocket(socketInstance), 0);

    // Cleanup on unmount
    return () => {
      clearTimeout(timer);
      socketInstance.disconnect();
    };
  }, [decisionId]);

  return { updates, socket };
}

