import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";

// Event types
export interface DecisionUpdateEvent {
  type: "decision:update";
  decisionId: string;
  runId: string; // Added runId for multi-run support
  status: "PROCESSING" | "COMPLETED" | "FAILED"; // Changed DONE to COMPLETED
}

const EVENTS_CHANNEL = "decision-events";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  // Create Socket.IO server
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    path: "/api/socket",
  });

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  // Parse URL to check for TLS
  const isTLS = redisUrl.startsWith("rediss://");
  const redisOptions = {
    // Enable TLS for production Redis (Upstash, Redis Cloud, etc.)
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
  };

  // Create Redis clients for adapter
  const pubClient = new Redis(redisUrl, redisOptions);
  const subClient = pubClient.duplicate();

  // Set up Redis adapter for Socket.IO
  io.adapter(createAdapter(pubClient, subClient));

  // Subscribe to Redis Pub/Sub channel
  const subscriber = new Redis(redisUrl, redisOptions);
  
  subscriber.subscribe(EVENTS_CHANNEL, (err) => {
    if (err) {
      console.error("Failed to subscribe to Redis channel:", err);
    } else {
      console.log(`✓ Subscribed to Redis channel: ${EVENTS_CHANNEL}`);
    }
  });

  // Handle incoming Redis messages
  subscriber.on("message", (channel, message) => {
    if (channel === EVENTS_CHANNEL) {
      try {
        const event: DecisionUpdateEvent = JSON.parse(message);
        
        // Emit to all connected clients
        io?.emit("decision:update", event);
        
        console.log(`📤 Broadcasted event: ${event.status} for decision ${event.decisionId}`);
      } catch (error) {
        console.error("Failed to parse Redis message:", error);
      }
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  console.log("✓ Socket.IO server initialized");

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

