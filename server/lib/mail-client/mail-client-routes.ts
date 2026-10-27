import express from "express";
import * as authConfig from "../auth/auth-config";
import {
  createMailClientCredential,
  listMailClientCredentials,
  readMailClientSettings,
  revokeMailClientCredential
} from "./mail-client-controllers";

const router = express.Router();

router.get("/settings", authConfig.authenticate(), readMailClientSettings);
router.get("/credentials", authConfig.authenticate(), listMailClientCredentials);
router.post("/credentials", authConfig.authenticate(), createMailClientCredential);
router.delete("/credentials/:id", authConfig.authenticate(), revokeMailClientCredential);

export const mailClientRoutes = router;
