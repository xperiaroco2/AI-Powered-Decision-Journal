/**
 * Prometheus metrics for the BullMQ worker.
 *
 * Exposes a /metrics endpoint on METRICS_PORT (default 9465) for Prometheus to scrape.
 * Records job counts and processing durations per queue.
 */
import { createServer } from 'http';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import { childLogger } from './logger';

const log = childLogger('metrics');
const register = new Registry();

// Node.js runtime metrics (heap, event loop, GC, etc.)
collectDefaultMetrics({ register });

export const jobsTotal = new Counter({
  name: 'worker_jobs_total',
  help: 'Total jobs processed by the worker',
  labelNames: ['queue', 'status'] as const,
  registers: [register],
});

export const jobDurationSeconds = new Histogram({
  name: 'worker_job_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

export function startMetricsServer(port: number): void {
  const server = createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        res.writeHead(200, { 'Content-Type': register.contentType });
        res.end(await register.metrics());
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    log.info({ port }, 'Metrics server listening');
  });
}
