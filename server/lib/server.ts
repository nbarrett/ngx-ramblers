import debug from "debug";
import { install } from "source-map-support";
import { addresses } from "./addresses/addresses";
import { awsRoutes } from "./aws/aws-routes";
import { mongoBackupRoutes } from "./backup/mongo-backup-routes";
import { s3BackupRoutes } from "./backup/s3-backup-routes";
import { envConfig } from "./env-config/env-config";
import { mailchimpRoutes } from "./mailchimp/mailchimp-routes";
import { osMapsRoutes } from "./os-maps/os-maps-routes";
import * as mongooseClient from "./mongo/mongoose-client";
import { configRoutes } from "./mongo/routes/config";
import { ramblersUploadAuditRoutes } from "./mongo/routes/ramblers-upload-audit";
import { ramblersRoutes } from "./ramblers/ramblers-routes";
import { pageContentRoutes } from "./mongo/routes/page-content";
import { walksRoutes } from "./mongo/routes/walk";
import { contentMetadataRoutes } from "./mongo/routes/content-metadata";
import { brevoRoutes } from "./brevo/brevo-routes";
import { bannerRoutes } from "./mongo/routes/banner";
import { notificationConfigRoutes } from "./mongo/routes/notification-config";
import { mailchimpListAuditRoutes } from "./mongo/routes/mailchimp-list-audit";
import express from "express";
import { memberRoutes } from "./mongo/routes/member";
import { memberAuthAuditRoutes } from "./mongo/routes/member-auth-audit";
import { memberUpdateAuditRoutes } from "./mongo/routes/member-update-audit";
import { mailListAuditRoutes } from "./mongo/routes/mail-list-audit";
import { deletedMemberRoutes } from "./mongo/routes/deleted-member";
import { memberBulkLoadAuditRoutes } from "./mongo/routes/member-bulk-load-update";
import { socialEventsRoutes } from "./mongo/routes/social-event";
import { authRoutes } from "./mongo/routes/auth";
import { contentTextRoutes } from "./mongo/routes/content-text";
import { migrationHistoryRoutes } from "./mongo/routes/migration-history";
import { expenseClaimRoutes } from "./mongo/routes/expense-claim";
import { instagramRoutes } from "./instagram/instagram";
import { meetupRoutes } from "./meetup/meetup";
import { googleMapsRoutes } from "./google-maps/google-maps";
import { contactUsRoutes } from "./contact-us/contact-us-routes";
import { migrationRoutes } from "./migration/migration-routes";
import { migrationsRoutes } from "./mongo/routes/migrations";
import { createWebSocketServer } from "./websockets/websocket-server";
import http from "http";
import { Server } from "node:http";
import { health, systemStatus } from "./health/health";
import { crossEnvironmentHealthRoutes } from "./health/cross-environment-health-routes";
import { download } from "./files/files";
import { extendedGroupEventRoutes } from "./mongo/routes/extended-group-event";
import { venueRoutes } from "./mongo/routes/venue";
import { environmentSetupRoutes } from "./environment-setup/routes/environment-setup-routes";
import { cloudflareEmailRoutingRoutes } from "./cloudflare/cloudflare-email-routing-routes";
import { bookingRoutes } from "./mongo/routes/booking";
import { contactInteractionRoutes } from "./mongo/routes/contact-interaction";
import { configureLogging } from "./logging/logging";
import { downloadStatusRoutes } from "./ramblers/download-status-routes";
import { integrationWorkerRoutes } from "./ramblers/integration-worker-routes";
import { integrationWorkerMigrationCallbackRoutes } from "./ramblers/integration-worker-migration-callback-routes";
import { geoJsonRoutes } from "./geojson/geojson-routes";
import { regions } from "./geojson/regions";
import { parishRoutes } from "./parishes/parish-routes";
import { parishAllocationRoutes } from "./mongo/routes/parish-allocation";
import { migrationRunner } from "./mongo/migrations/migrations-runner";
import { resolveClientPath } from "./shared/path-utils";
import { Environment } from "../../projects/ngx-ramblers/src/app/models/environment.model";
import { mapRouteRoutes } from "./map-routes/map-route-routes";
import { spatialFeaturesController } from "./map-routes/spatial-features-controller";
import { scheduleWalksManagerSync } from "./cron/walks-manager-sync-job";
import { scheduleBookingReminders } from "./cron/booking-reminder-job";
import bodyParser from "body-parser";
import compression from "compression";
import errorHandler from "errorhandler";
import methodOverride from "method-override";
import passport from "passport";
import path from "path";
import favicon from "serve-favicon";
import fs from "fs";
import committeeFile from "./mongo/routes/committee-file";
import memberResource from "./mongo/routes/member-resource";

install();
const debugLog = debug(envConfig.logNamespace("server"));
debugLog.enabled = true;
const distFolder = resolveClientPath("dist/ngx-ramblers");
const currentDir = path.resolve(__dirname);
const port: number = +envConfig.server.listenPort;
debugLog("⏳currentDir:", currentDir, "distFolder:", distFolder, "NODE_ENV:", envConfig.env, "port:", port);
const app = express();
configureLogging(app);
const server: Server = http.createServer(app);
app.use(compression());
app.set("port", port);
app.disable("view cache");
const faviconPath = path.join(distFolder, "favicon.ico");
if (fs.existsSync(faviconPath)) {
  app.use(favicon(faviconPath));
}
app.use(methodOverride());
app.use(bodyParser.json({
  limit: "50mb",
  verify: (req, _res, buf) => { (req as { rawBody?: string }).rawBody = buf.toString("utf-8"); }
}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true}));
app.use(passport.initialize());
app.use(passport.session());
app.get("/api/files/download", download);
app.get("/api/health", health);
app.get("/api/system-status", systemStatus);
app.use("/api/health/environments", crossEnvironmentHealthRoutes);
app.use("/api/areas", geoJsonRoutes);
app.get("/api/regions", regions);
app.use("/api/parishes", parishRoutes);
app.use("/api/download-status", downloadStatusRoutes);
app.use("/api/ramblers", ramblersRoutes);
app.use("/api/integration-worker", integrationWorkerRoutes);
app.use("/api/integration-worker/migration", integrationWorkerMigrationCallbackRoutes);
app.use("/api/routes", mapRouteRoutes);
app.use(spatialFeaturesController);
app.use("/api/aws", awsRoutes);
app.use("/api/mongo-backup", mongoBackupRoutes);
app.use("/api/s3-backup", s3BackupRoutes);
app.use("/api/contact-us", contactUsRoutes);
app.use("/api/migration", migrationRoutes);
app.use("/api/google-maps", googleMapsRoutes);
app.use("/api/instagram", instagramRoutes);
app.use("/api/mailchimp", mailchimpRoutes);
app.use("/api/mail", brevoRoutes);
app.use("/api/addresses", addresses);
app.use("/api/os-maps", osMapsRoutes);
app.use("/api/meetup", meetupRoutes);
app.use("/api/database/auth", authRoutes);
app.use("/api/database/banners", bannerRoutes);
app.use("/api/database/notification-config", notificationConfigRoutes);
app.use("/api/database/content-text", contentTextRoutes);
app.use("/api/database/migration-history", migrationHistoryRoutes);
app.use("/api/database/page-content", pageContentRoutes);
app.use("/api/database/content-metadata", contentMetadataRoutes);
app.use("/api/database/booking", bookingRoutes);
app.use("/api/database/parish-allocation", parishAllocationRoutes);
app.use("/api/database/contact-interaction", contactInteractionRoutes);
app.use("/api/database/expense-claim", expenseClaimRoutes);
app.use("/api/database/committee-file", committeeFile);
app.use("/api/database/deleted-member", deletedMemberRoutes);
app.use("/api/database/member", memberRoutes);
app.use("/api/database/member-bulk-load-audit", memberBulkLoadAuditRoutes);
app.use("/api/database/member-auth-audit", memberAuthAuditRoutes);
app.use("/api/database/mailchimp-list-audit", mailchimpListAuditRoutes);
app.use("/api/database/mail-list-audit", mailListAuditRoutes);
app.use("/api/database/member-resource", memberResource);
app.use("/api/database/member-update-audit", memberUpdateAuditRoutes);
app.use("/api/database/ramblers-upload-audit", ramblersUploadAuditRoutes);
app.use("/api/database/social-event", socialEventsRoutes);
app.use("/api/database/config", configRoutes);
app.use("/api/database/walks", walksRoutes);
app.use("/api/database/group-event", extendedGroupEventRoutes);
app.use("/api/database/migrations", migrationsRoutes);
app.use("/api/database/venues", venueRoutes);
app.use("/api/cloudflare/email-routing", cloudflareEmailRoutingRoutes);
app.use("/api/environment-setup", environmentSetupRoutes);
const staticAssetExtensions = /\.(js|mjs|css|map|wasm|json|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot|txt|xml)$/i;
if (fs.existsSync(distFolder)) {
  app.use("/", express.static(distFolder, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    }
  }));
  app.use((req, res, next) => {
    if (staticAssetExtensions.test(req.path)) {
      res.status(404).send(`Asset not found: ${req.path}`);
      return;
    }
    const indexPath = path.join(distFolder, "index.html");
    if (fs.existsSync(indexPath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(indexPath);
    } else {
      debugLog("⚠️ index.html not found in", distFolder, "— likely running in dev before build.");
      next();
    }
  });
} else {
  debugLog("⚠️ dist folder not found at", distFolder, "— static assets will not be served.");
}
if (app.get("env") === "dev") {
  app.use(errorHandler());
}

async function runMigrationsInBackground() {
  debugLog("⏳Checking database migrations...");
  try {
    const migrationResult = await migrationRunner.runPendingMigrations();

    if (migrationResult.appliedFiles.length > 0) {
      debugLog(`✅ Applied ${migrationResult.appliedFiles.length} migration(s):`, migrationResult.appliedFiles);
    }

    if (!migrationResult.success) {
      debugLog("❌ Migration failed:", migrationResult.error, "⚠️ Server will continue but site will show maintenance page");
    }
  } catch (migrationError) {
    debugLog("❌ Migration check failed:", migrationError);
    debugLog("⚠️ Server will continue but site will show maintenance page");
  }
}

async function startServer() {
  try {
    server.listen(port, "::", () => {
      debugLog(`🚀 Server is listening on port for ${envConfig.env} environment`, port);
    });

    server.timeout = 600000;
    server.keepAliveTimeout = 610000;
    server.headersTimeout = 620000;
    debugLog(`⏱️ Server timeouts configured: timeout=${server.timeout}ms, keepAliveTimeout=${server.keepAliveTimeout}ms, headersTimeout=${server.headersTimeout}ms`);

    const workerUrl = envConfig.value(Environment.INTEGRATION_WORKER_URL);
    if (workerUrl) {
      debugLog(`📦 Ramblers walks uploads will route to remote worker at ${workerUrl}`);
    } else {
      debugLog("📦 Ramblers walks uploads will run in-process (no INTEGRATION_WORKER_URL set)");
    }

    createWebSocketServer(server, port);

    debugLog("⏳Connecting to MongoDB in background...");
    mongooseClient.connect().then(() => {
      debugLog("✅ MongoDB connected successfully");

      if (envConfig.booleanValue(Environment.SKIP_MIGRATIONS_ON_STARTUP)) {
        debugLog(`⏭️ Skipping automatic migrations (${Environment.SKIP_MIGRATIONS_ON_STARTUP} is true)`);
      } else {
        runMigrationsInBackground().catch(error => {
          debugLog("❌ Unhandled error in background migrations:", error);
        });
      }

      scheduleWalksManagerSync().catch(error => {
        debugLog("❌ Failed to schedule WALKS_MANAGER sync:", error);
      });

      scheduleBookingReminders().catch(error => {
        debugLog("❌ Failed to schedule booking reminders:", error);
      });
    }).catch(error => {
      debugLog("❌ MongoDB connection failed:", error);
      debugLog("⚠️ Server will continue but database operations will fail");
    });
  } catch (error) {
    debugLog("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
