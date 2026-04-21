import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Self-ping every 60s to prevent autoscale sleep
  const URLS = [
    "https://goutstoso.replit.app/api/healthz",
    "https://goutstoso.replit.app/goutstoso/",
  ];
  const selfPing = () => {
    URLS.forEach(u => fetch(u, { method: "HEAD" }).catch(() => {}));
  };
  setInterval(selfPing, 60 * 1000);
  selfPing();
});
