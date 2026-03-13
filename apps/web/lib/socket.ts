import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { logger } from "./logger";

// Event types
export interface DecisionUpdateEvent {
  type: "decision:update";
  decisionId: string;
  runId: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
}

export interface AttachmentUpdateEvent {
  type: "attachment:update";
  attachmentId: string;
  decisionId: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  error?: string;
}

type WebSocketEvent = DecisionUpdateEvent | AttachmentUpdateEvent;

const EVENTS_CHANNEL = "decision-events";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

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

  const isTLS = redisUrl.startsWith("rediss://");
  const redisOptions = {
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
  };

  const pubClient = new Redis(redisUrl, redisOptions);
  const subClient = pubClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  const subscriber = new Redis(redisUrl, redisOptions);

  subscriber.subscribe(EVENTS_CHANNEL, (err) => {
    if (err) {
      logger.error({ err, channel: EVENTS_CHANNEL }, "Failed to subscribe to Redis channel");
    } else {
      logger.info({ channel: EVENTS_CHANNEL }, "Subscribed to Redis channel");
    }
  });

  subscriber.on("message", (channel, message) => {
    if (channel === EVENTS_CHANNEL) {
      try {
        const event: WebSocketEvent = JSON.parse(message);

        if (event.type === "decision:update") {
          io?.emit("decision:update", event);
          logger.info(
            { decisionId: event.decisionId, status: event.status },
            "Broadcasted decision event"
          );
        } else if (event.type === "attachment:update") {
          io?.emit("attachment:update", event);
          logger.info(
            { attachmentId: event.attachmentId, status: event.status },
            "Broadcasted attachment event"
          );
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to parse Redis message");
      }
    }
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected");
    });
  });

  logger.info("Socket.IO server initialized");

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
