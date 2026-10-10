import { Request, Response } from "express";
import { isString, values } from "es-toolkit/compat";
import debug from "debug";
import { UpdateQuery } from "mongoose";
import { Member, MemberCookie, MemberRoutePreferences, RoutePreferenceAction, RoutePreferenceChange } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { member as memberModel } from "../models/member";
import * as mongooseClient from "../mongoose-client";
import { envConfig } from "../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("member-route-preferences"));

function preferencesFrom(member: Member): MemberRoutePreferences {
  return {favouriteKeys: member.routePreferences?.favouriteKeys || [], hiddenKeys: member.routePreferences?.hiddenKeys || []};
}

function preferenceUpdate(change: RoutePreferenceChange): UpdateQuery<Member> {
  if (change.action === RoutePreferenceAction.FAVOURITE) {
    return {$addToSet: {"routePreferences.favouriteKeys": change.key}};
  } else if (change.action === RoutePreferenceAction.UNFAVOURITE) {
    return {$pull: {"routePreferences.favouriteKeys": change.key}};
  } else if (change.action === RoutePreferenceAction.HIDE) {
    return {$addToSet: {"routePreferences.hiddenKeys": change.key}};
  } else {
    return {$set: {"routePreferences.hiddenKeys": []}};
  }
}

export async function readMemberRoutePreferences(req: Request, res: Response): Promise<void> {
  const memberId = (req.user as MemberCookie)?.memberId;
  if (!memberId) {
    res.status(401).json({message: "Sign in to use profile route preferences."});
  } else {
    try {
      const member = await mongooseClient.execute(() => memberModel.findById(memberId).select("routePreferences").lean());
      if (member) {
        res.status(200).json(preferencesFrom(member));
      } else {
        res.status(404).json({message: "Member not found."});
      }
    } catch (error) {
      debugLog("Reading route preferences failed", error);
      res.status(500).json({message: "Route preferences could not be read."});
    }
  }
}

export async function changeMemberRoutePreference(req: Request, res: Response): Promise<void> {
  const memberId = (req.user as MemberCookie)?.memberId;
  const action = req.body?.action;
  const key = isString(req.body?.key) ? req.body.key.trim() : null;
  const valid = values(RoutePreferenceAction).includes(action) && (action === RoutePreferenceAction.SHOW_ALL || (key && key.length <= 512));
  if (!memberId) {
    res.status(401).json({message: "Sign in to use profile route preferences."});
  } else if (!valid) {
    res.status(400).json({message: "A valid route preference action and route key are required."});
  } else {
    try {
      const change: RoutePreferenceChange = {action, key};
      const member = await mongooseClient.execute(() => memberModel.findByIdAndUpdate(memberId, preferenceUpdate(change), {new: true, runValidators: true}).select("routePreferences").lean());
      if (member) {
        res.status(200).json(preferencesFrom(member));
      } else {
        res.status(404).json({message: "Member not found."});
      }
    } catch (error) {
      debugLog("Updating route preferences failed", error);
      res.status(500).json({message: "Route preferences could not be saved."});
    }
  }
}
