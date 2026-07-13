import express from "express";
import * as authConfig from "../auth/auth-config";
import * as controller from "./cloudflare-email-routing-controllers";
import { asyncRoute } from "../shared/async-route";

const messageType = "cloudflare:email-routing";
const router = express.Router();

router.get("/config", authConfig.authenticate(), asyncRoute(messageType, controller.getConfig));
router.get("/rules", authConfig.authenticate(), asyncRoute(messageType, controller.getRules));
router.get("/rules/catch-all", authConfig.authenticate(), asyncRoute(messageType, controller.getCatchAllRule));
router.put("/rules/catch-all", authConfig.authenticate(), asyncRoute(messageType, controller.putCatchAllRule));
router.post("/rules/catch-all/router/redeploy", authConfig.authenticate(), asyncRoute(messageType, controller.postCatchAllRouterRedeploy));
router.post("/route-to-inbox", authConfig.authenticate(), asyncRoute(messageType, controller.postRouteToInbox));
router.post("/rules", authConfig.authenticate(), asyncRoute(messageType, controller.postRule));
router.put("/rules/:ruleId", authConfig.authenticate(), asyncRoute(messageType, controller.putRule));
router.delete("/rules/:ruleId", authConfig.authenticate(), asyncRoute(messageType, controller.deleteRule));

router.get("/destination-addresses", authConfig.authenticate(), asyncRoute(messageType, controller.getDestinationAddresses));
router.post("/destination-addresses", authConfig.authenticate(), asyncRoute(messageType, controller.postDestinationAddress));
router.post("/destination-addresses/resend", authConfig.authenticate(), asyncRoute(messageType, controller.postDestinationAddressResend));
router.delete("/destination-addresses/:addressId", authConfig.authenticate(), asyncRoute(messageType, controller.deleteDestinationAddressById));

router.get("/workers", authConfig.authenticate(), asyncRoute(messageType, controller.getWorkers));
router.get("/workers/:scriptName/recipients", authConfig.authenticate(), asyncRoute(messageType, controller.getWorkerRecipients));
router.get("/workers/:scriptName/info", authConfig.authenticate(), asyncRoute(messageType, controller.getWorkerInfo));
router.post("/workers", authConfig.authenticate(), asyncRoute(messageType, controller.postWorker));
router.delete("/workers/:scriptName", authConfig.authenticate(), asyncRoute(messageType, controller.deleteWorker));
router.put("/workers/:oldName/rename", authConfig.authenticate(), asyncRoute(messageType, controller.renameWorker));

router.post("/logs/email-routing", authConfig.authenticate(), asyncRoute(messageType, controller.postEmailRoutingLogs));
router.post("/logs/workers", authConfig.authenticate(), asyncRoute(messageType, controller.postWorkerLogs));

router.get("/mx-records", authConfig.authenticate(), asyncRoute(messageType, controller.getMxRecords));
router.post("/mx-records", authConfig.authenticate(), asyncRoute(messageType, controller.postMxRecords));
router.delete("/mx-records/:recordId", authConfig.authenticate(), asyncRoute(messageType, controller.deleteMxRecord));

router.post("/inbound-mime", controller.handleInboundMime);
router.post("/inbound-inbox", controller.handleInboundInbox);

router.get("/auth-records", authConfig.authenticate(), asyncRoute(messageType, controller.getAuthRecords));
router.post("/auth-records", authConfig.authenticate(), asyncRoute(messageType, controller.postAuthRecords));

export const cloudflareEmailRoutingRoutes = router;
