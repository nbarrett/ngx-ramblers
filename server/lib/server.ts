import debug from "debug";
import { install } from "source-map-support";
import { addresses } from "./addresses/addresses";
import { awsRoutes } from "./aws/aws-routes";
import { envConfig } from "./env-config/env-config";
import { mailchimpRoutes } from "./mailchimp/mailchimp-routes";
import { meetup } from "./meetup/meetup";
import * as mongooseClient from "./mongo/mongoose-client";
import { configRoutes } from "./mongo/routes/config";
import { ramblersUploadAuditRoutes } from "./mongo/routes/ramblers-upload-audit";
import { ramblersRoutes } from "./ramblers/ramblers-routes";
import { pageContentRoutes } from "./mongo/routes/page-content";
import { walksRoutes } from "./mongo/routes/walk";
import { contentMetadataRoutes } from "./mongo/routes/content-metadata";
import bodyParser = require("body-parser");
import compression = require("compression");
import errorHandler = require("errorhandler");
import express = require("express");
import methodOverride = require("method-override");
import logger = require("morgan");
import passport = require("passport");
import path = require("path");
import favicon = require("serve-favicon");
import googleMaps = require("./google-maps/googleMaps");
import instagram = require("./instagram/instagram");
import logs = require("./middleware/logs");
import migration = require("./migration/migration-controller");
import auth = require("./mongo/routes/auth");
import committeeFile = require("./mongo/routes/committee-file");
import contentText = require("./mongo/routes/content-text");
import deletedMember = require("./mongo/routes/deleted-member");
import expenseClaim = require("./mongo/routes/expense-claim");
import mailchimpListAudit = require("./mongo/routes/mailchimp-list-audit");
import member = require("./mongo/routes/member");
import memberAuthAuditRoutes = require("./mongo/routes/member-auth-audit");
import memberBulkLoadAudit = require("./mongo/routes/member-bulk-load-update");
import memberResource = require("./mongo/routes/member-resource");
import memberUpdateAuditRoutes = require("./mongo/routes/member-update-audit");
import socialEvent = require("./mongo/routes/social-event");
import { brevoRoutes } from "./brevo/brevo-routes";
import { bannerRoutes } from "./mongo/routes/banner";
import { notificationConfigRoutes } from "./mongo/routes/notification-config";

install();
const debugLog = debug(envConfig.logNamespace("server"));
debugLog.enabled = true;
const folderNavigationsUp = process.env.NODE_ENV === "production" ? "../../" : "";
const distFolder = path.resolve(__dirname, folderNavigationsUp, "../../dist/ngx-ramblers");
const currentDir = path.resolve(__dirname);
debugLog("currentDir:", currentDir, "distFolder:", distFolder, "NODE_ENV:", process.env.NODE_ENV);
const app = express();
app.use(compression());
app.set("port", envConfig.server.listenPort);
app.disable("view cache");
app.use(favicon(path.join(distFolder, "favicon.ico")));
app.use(logger(envConfig.env));
app.use(methodOverride());
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use("/api/ramblers", ramblersRoutes);
app.use("/api/migration", migration);
app.use("/api/aws", awsRoutes);
app.use("/api/google-maps", googleMaps);
app.use("/api/instagram", instagram);
app.use("/api/mailchimp", mailchimpRoutes);
app.use("/api/mail", brevoRoutes);
app.use("/api/addresses", addresses);
app.use("/api/meetup", meetup);
app.use("/api/database/auth", auth);
app.use("/api/database/banners", bannerRoutes);
app.use("/api/database/notification-config", notificationConfigRoutes);
app.use("/api/database/content-text", contentText);
app.use("/api/database/page-content", pageContentRoutes);
app.use("/api/database/content-metadata", contentMetadataRoutes);
app.use("/api/database/expense-claim", expenseClaim);
app.use("/api/database/committee-file", committeeFile);
app.use("/api/database/deleted-member", deletedMember);
app.use("/api/database/member", member);
app.use("/api/database/member-bulk-load-audit", memberBulkLoadAudit);
app.use("/api/database/member-auth-audit", memberAuthAuditRoutes);
app.use("/api/database/mailchimp-list-audit", mailchimpListAudit);
app.use("/api/database/member-resource", memberResource);
app.use("/api/database/member-update-audit", memberUpdateAuditRoutes);
app.use("/api/database/ramblers-upload-audit", ramblersUploadAuditRoutes);
app.use("/api/database/social-event", socialEvent);
app.use("/api/database/config", configRoutes);
app.use("/api/database/walks", walksRoutes);
app.use("/api/logs", logs);
app.use("/", express.static(distFolder));
app.use((req, res, next) => {
  res.sendFile(path.join(distFolder, "index.html"));
});
if (app.get("env") === "dev") {
  app.use(errorHandler());
}
mongooseClient.connect(debugLog);
app.listen(app.get("port"), function () {
  debugLog("listening on port " + envConfig.server.listenPort);
});
