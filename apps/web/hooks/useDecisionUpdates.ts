"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface DecisionUpdateEvent {
  type: "decision:update";
  decisionId: string;
  runId: string; // Added runId for multi-run support
  status: "PROCESSING" | "COMPLETED" | "FAILED"; // Changed DONE to COMPLETED
}

export function useDecisionUpdates(decisionId: string) {
  const [status, setStatus] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize Socket.IO client
    const socketInstance = io({
      path: "/api/socket",
    });

    socketInstance.on("connect", () => {
      console.log("✓ Connected to WebSocket server");
    });

    socketInstance.on("disconnect", () => {
      console.log("✗ Disconnected from WebSocket server");
    });

    // Listen for decision updates
    socketInstance.on("decision:update", (event: DecisionUpdateEvent) => {
      console.log("📥 Received event:", event);
      
      // Only update if it's for this decision
      if (event.decisionId === decisionId) {
        setStatus(event.status);
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

  return { status, socket };
}

