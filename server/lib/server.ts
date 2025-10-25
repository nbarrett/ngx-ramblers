import debug from "debug";
import { install } from "source-map-support";
import { addresses } from "./addresses/addresses";
import { awsRoutes } from "./aws/aws-routes";
import { envConfig } from "./env-config/env-config";
import { mailchimpRoutes } from "./mailchimp/mailchimp-routes";
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
import { download } from "./files/files";
import { setupSerenityReports } from "./reports/serenity-reports";
import { extendedGroupEventRoutes } from "./mongo/routes/extended-group-event";
import { configureLogging } from "./logging/logging";
import { downloadStatusRoutes } from "./ramblers/download-status-routes";
import { geoJsonRoutes } from "./geojson/geojson-routes";
import { regions } from "./geojson/regions";
import { migrationRunner } from "./mongo/migrations/migrations-runner";
import { resolveClientPath } from "./shared/path-utils";
import bodyParser = require("body-parser");
import compression = require("compression");
import errorHandler = require("errorhandler");
import methodOverride = require("method-override");
import passport = require("passport");
import path = require("path");
import favicon = require("serve-favicon");
import fs = require("fs");
import committeeFile = require("./mongo/routes/committee-file");
import memberResource = require("./mongo/routes/member-resource");

install();
const debugLog = debug(envConfig.logNamespace("server"));
debugLog.enabled = true;
const distFolder = resolveClientPath("dist/ngx-ramblers");
const currentDir = path.resolve(__dirname);
const port: number = +envConfig.server.listenPort;
debugLog("⏳currentDir:", currentDir, "distFolder:", distFolder, "NODE_ENV:", process.env.NODE_ENV, "port:", port);
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
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true}));
app.use(passport.initialize());
app.use(passport.session());
app.get("/api/files/download", download);
app.get("/api/health", health);
app.get("/api/system-status", systemStatus);
app.use("/api/areas", geoJsonRoutes);
app.get("/api/regions", regions);
app.use("/api/download-status", downloadStatusRoutes);
app.use("/api/ramblers", ramblersRoutes);
app.use("/api/aws", awsRoutes);
app.use("/api/contact-us", contactUsRoutes);
app.use("/api/migration", migrationRoutes);
app.use("/api/google-maps", googleMapsRoutes);
app.use("/api/instagram", instagramRoutes);
app.use("/api/mailchimp", mailchimpRoutes);
app.use("/api/mail", brevoRoutes);
app.use("/api/addresses", addresses);
app.use("/api/meetup", meetupRoutes);
app.use("/api/database/auth", authRoutes);
app.use("/api/database/banners", bannerRoutes);
app.use("/api/database/notification-config", notificationConfigRoutes);
app.use("/api/database/content-text", contentTextRoutes);
app.use("/api/database/migration-history", migrationHistoryRoutes);
app.use("/api/database/page-content", pageContentRoutes);
app.use("/api/database/content-metadata", contentMetadataRoutes);
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
setupSerenityReports(app);
if (fs.existsSync(distFolder)) {
  app.use("/", express.static(distFolder));
  app.use((req, res, next) => {
    const indexPath = path.join(distFolder, "index.html");
    if (fs.existsSync(indexPath)) {
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

async function startServer() {
  try {
    debugLog("⏳Connecting to MongoDB...");
    await mongooseClient.connect();

    const runMigrationsOnStartup = process.env.RUN_MIGRATIONS_ON_STARTUP === "true";
    if (runMigrationsOnStartup) {
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
    } else {
      debugLog("⏭️ Skipping automatic migrations (RUN_MIGRATIONS_ON_STARTUP not set to 'true')");
    }

    server.listen(port, "0.0.0.0", () => {
      debugLog(`🚀 Server is listening on port for ${envConfig.env} environment`, port);
    });

    createWebSocketServer(server, port);
  } catch (error) {
    debugLog("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
