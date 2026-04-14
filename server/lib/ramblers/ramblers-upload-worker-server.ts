import debug from "debug";
import { install } from "source-map-support";
import express from "express";
import http from "http";
import compression from "compression";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import passport from "passport";
import errorHandler from "errorhandler";
import { Server } from "node:http";
import { envConfig } from "../env-config/env-config";
import { health } from "../health/health";
import { createRamblersUploadWorkerWebSocketServer } from "./ramblers-upload-worker-websocket-server";
import { ramblersUploadWorkerRoutes } from "./ramblers-upload-worker-routes";

install();

const debugLog = debug(envConfig.logNamespace("ramblers-upload-worker-server"));
debugLog.enabled = true;
const port: number = +envConfig.server.listenPort;
const app = express();
const server: Server = http.createServer(app);

app.use(compression());
app.set("port", port);
app.disable("view cache");
app.use(methodOverride());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(passport.initialize());
app.use((req, res, next) => {
  if (req.originalUrl === "/api/health") {
    next();
    return;
  }
  const startedAt = Date.now();
  debugLog("->", req.method, req.originalUrl, "from:", req.ip, "contentLength:", req.headers["content-length"] ?? "-");
  res.on("finish", () => {
    debugLog("<-", req.method, req.originalUrl, "status:", res.statusCode, "elapsedMs:", Date.now() - startedAt);
  });
  next();
});
app.get("/", (req, res) => {
  res.json({
    service: "ngx-ramblers-upload-worker",
    description: "Machine-to-machine Serenity upload worker for the Ramblers walks upload flow. No browser interface.",
    environment: envConfig.env,
    endpoints: {
      health: { method: "GET", path: "/api/health" },
      submitJob: { method: "POST", path: "/api/ramblers-upload-worker/jobs" },
      progressCallback: { method: "POST", path: "/api/ramblers-upload-worker/progress" },
      resultCallback: { method: "POST", path: "/api/ramblers-upload-worker/result" }
    },
    documentation: "https://www.ngx-ramblers.org.uk/how-to/technical-articles/2026-04-12-secrets-deployment-and-cloudflare-config"
  });
});
app.get("/api/health", health);
app.use("/api/ramblers-upload-worker", ramblersUploadWorkerRoutes);

if (app.get("env") === "dev") {
  app.use(errorHandler());
}

async function startServer(): Promise<void> {
  try {
    server.listen(port, "0.0.0.0", () => {
      debugLog(`Ramblers upload worker server is listening on port ${port} for ${envConfig.env} environment`);
    });

    server.timeout = 600000;
    server.keepAliveTimeout = 610000;
    server.headersTimeout = 620000;
    createRamblersUploadWorkerWebSocketServer(server, port);
  } catch (error) {
    debugLog("Failed to start Ramblers upload worker server:", error);
    process.exit(1);
  }
}

void startServer();
