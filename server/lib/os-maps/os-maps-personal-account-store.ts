import { Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { OsMapsPersonalCredentials } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { osMapsPersonalAccount } from "../mongo/models/os-maps-personal-account";
import * as mongooseClient from "../mongo/mongoose-client";
import { encryptJsonConfig, decryptJsonConfig } from "../shared/config-crypto";
import { envConfig } from "../env-config/env-config";
import { isString } from "es-toolkit/compat";

export async function personalOsMapsCredentials(memberId: string): Promise<OsMapsPersonalCredentials | null> {
  const account = await mongooseClient.execute(() => osMapsPersonalAccount.findOne({memberId}).lean());
  return account ? decryptJsonConfig<OsMapsPersonalCredentials>(account.encryptedCredentials, envConfig.auth().secret) : null;
}

export async function personalOsMapsAccount(req: Request, res: Response): Promise<void> {
  try {
    const account = await personalOsMapsCredentials((req.user as MemberCookie).memberId);
    res.json({email: account?.email || "", configured: !!account});
  } catch {
    res.status(503).json({error: "Could not read your OS Maps account settings"});
  }
}

export async function savePersonalOsMapsAccount(req: Request, res: Response): Promise<void> {
  const memberId = (req.user as MemberCookie).memberId;
  const email = isString(req.body?.email) ? req.body.email.trim() : "";
  const password = isString(req.body?.password) ? req.body.password : "";
  try {
    const existing = password ? null : await personalOsMapsCredentials(memberId);
    const resolvedPassword = password || (existing?.email === email ? existing.password : "");
    if (!email || !resolvedPassword) {
      res.status(400).json({error: "Enter your OS Maps email and password"});
    } else {
      const encryptedCredentials = encryptJsonConfig({email, password: resolvedPassword}, envConfig.auth().secret);
      await mongooseClient.execute(() => osMapsPersonalAccount.findOneAndUpdate({memberId}, {$set: {encryptedCredentials}}, {upsert: true}));
      res.json({email, configured: true});
    }
  } catch {
    res.status(503).json({error: "Could not save your OS Maps account settings"});
  }
}
