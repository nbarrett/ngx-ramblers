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
import { integrationWorkerRoutes } from "./integration-worker-routes";
import { integrationWorkerBrowserRoutes } from "./integration-worker-browser-routes";
import { integrationWorkerMigrationRoutes } from "./integration-worker-migration-routes";

install();

const debugLog = debug(envConfig.logNamespace("integration-worker-server"));
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
    service: "ngx-ramblers-integration-worker",
    description: "Machine-to-machine integration worker. Handles Ramblers walks upload jobs and synchronous browser operations (HTML fetch, Flickr scraping, migration scrapes).",
    environment: envConfig.env,
    endpoints: {
      health: { method: "GET", path: "/api/health" },
      submitJob: { method: "POST", path: "/api/integration-worker/jobs" },
      progressCallback: { method: "POST", path: "/api/integration-worker/progress" },
      resultCallback: { method: "POST", path: "/api/integration-worker/result" },
      htmlFetch: { method: "POST", path: "/api/integration-worker/browser/html-fetch" },
      flickrUserAlbums: { method: "POST", path: "/api/integration-worker/browser/flickr-user-albums" }
    },
    documentation: "https://www.ngx-ramblers.org.uk/how-to/technical-articles/2026-04-12-secrets-deployment-and-cloudflare-config"
  });
});
app.get("/api/health", health);
app.use("/api/integration-worker", integrationWorkerRoutes);
app.use("/api/integration-worker/browser", integrationWorkerBrowserRoutes);
app.use("/api/integration-worker/migration", integrationWorkerMigrationRoutes);

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
  } catch (error) {
    debugLog("Failed to start Ramblers upload worker server:", error);
    process.exit(1);
  }
}

void startServer();
