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

  // Self-ping every 2 min to prevent autoscale sleep
  const selfPingUrl = "https://goutstoso.replit.app/api/healthz";
  const selfPing = () => {
    fetch(selfPingUrl, { method: "HEAD" }).catch(() => {});
  };
  setInterval(selfPing, 2 * 60 * 1000);
  selfPing();
});
