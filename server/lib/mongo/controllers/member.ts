import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { member } from "../models/member";
import * as crudController from "./crud-controller";
import * as transforms from "./transforms";
import * as querystring from "querystring";
import * as authConfig from "../../auth/auth-config";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { pluraliseWithCount } from "../../../serenity-js/screenplay/util/util";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";

const debugLog = debug(envConfig.logNamespace("member"));
debugLog.enabled = false;

const controller = crudController.create<Member>(member, true);
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findById = controller.findById;
export const deleteAll = controller.deleteAll;

export async function createOrUpdateAll(req: Request, res: Response) {
  const members: Member[] = req.body;
  const message = `Create or update of ${pluraliseWithCount(members.length, "member")}`;
  const createOrUpdatedMembers = await Promise.all(members.map(async member => {
    const hashedMember: Member = await updateHashValue(member);
    if (member.id) {
      return controller.updateDocument({body: hashedMember});
    } else {
      return controller.createDocument({body: hashedMember});
    }
  })).catch(error => {
    res.status(500).json({
      action: ApiAction.UPSERT,
      message,
      request: message,
      error: transforms.parseError(error)
    });
  });
  debugLog("createOrUpdateAll:for:", message, "returning:", createOrUpdatedMembers);
  res.status(200).json({
    action: ApiAction.UPSERT,
    message,
    response: createOrUpdatedMembers
  });
}

async function updateHashValue(member: Member) {
  const password = member.password;
  if (password && password.length < 60) {
    const hash = await authConfig.hashValue(member.password);
    debugLog("non-encrypted password found:", password, "- encrypted to:", hash);
    member.password = hash;
    return member;
  } else {
    return member;
  }
}

export async function update(req: Request, res: Response) {
  const updatedRequest: Member = await updateHashValue(req.body);
  controller.update({body: updatedRequest}, res);
}

export async function create(req: Request, res: Response) {
  const updatedRequest: Member = await updateHashValue(req.body);
  controller.create({body: updatedRequest}, res);
}

export function updateEmailSubscription(req: Request, res: Response) {
  const {criteria, document} = transforms.criteriaAndDocument(req);
  debugLog("updateEmailSubscription:", req.body, "conditions:", criteria, "request document:", document);
  member.findOneAndUpdate(criteria, document, {new: true})
    .then(result => {
      debugLog("update result:", result, "request document:", document);
      res.status(200).json({
        body: req.body,
        document,
        action: ApiAction.UPDATE,
        response: result
      });
    })
    .catch(error => {
      res.status(500).json({
        message: "Update of member failed",
        request: document,
        error: transforms.parseError(error)
      });
    });
}


function findByConditions(conditions: any, fields: any, res: Response, req: Request) {
  debugLog("findByConditions - conditions:", conditions, "fields:", fields);
  member.findOne(conditions, fields)
    .then(member => {
      if (member) {
        res.status(200).json({
          action: ApiAction.QUERY,
          response: fields ? member : transforms.toObjectWithId(member)
        });
      } else {
        res.status(404).json({
          error: "member not found",
          request: conditions
        });
      }
    })
    .catch(error => {
      res.status(500).json({
        message: "member query failed",
        request: req.params.id,
        error: transforms.parseError(error)
      });
    });
}

export function findByPasswordResetId(req: Request, res: Response) {
  debugLog("find - password-reset-id:", req.params.id);
  const conditions = {passwordResetId: req.params.id};
  findByConditions(conditions, "userName", res, req);
}

export function findOne(req: Request, res: Response) {
  const conditions = querystring.parse(req.query as any);
  debugLog("find - by conditions", req.query, "conditions:", conditions);
  findByConditions(req.query, undefined, res, req);
}
