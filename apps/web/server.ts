import { config } from "dotenv";
import { resolve } from "path";

// Load .env from repository root (skip in test mode as env vars are already set)
if (process.env.NODE_ENV !== "test") {
  config({ path: resolve(__dirname, "../../.env") });
}

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./lib/socket";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize Socket.IO
  initSocketServer(httpServer);

  httpServer
    .once("error", (err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    })
    .listen(port, '0.0.0.0', () => {
      console.log(`> Ready on port ${port}`);
    });
});

