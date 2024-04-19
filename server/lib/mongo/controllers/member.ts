import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { member } from "../models/member";
import * as crudController from "./crud-controller";
import * as transforms from "./transforms";
import * as querystring from "querystring";
import * as authConfig from "../../auth/auth-config";
import { extend } from "lodash";

const debugLog = debug(envConfig.logNamespace("member"));
debugLog.enabled = true;

const controller = crudController.create(member, true);
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findById = controller.findById;

export function update(req: Request, res: Response) {
  const password = req.body.password;
  if (password && password.length < 60) {
    authConfig.hashValue(req.body.password).then(hash => {
      debugLog("non-encrypted password found:", password, "- encrypted to:", hash);
      req.body.password = hash;
      controller.update(req, res);
    })
  } else {
    controller.update(req, res);
  }
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
        action: "update",
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
          action: "query",
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

export function create(req: Request, res: Response) {
  const document = transforms.createDocumentRequest(req);
  const returnError = (error, context) => {
    res.status(500).json({
      message: "Unexpected error " + context,
      error: transforms.parseError(error),
      request: req.body,
    });
  };
  const createMember = memberObject => new member(memberObject).save()
    .then(result => {
      res.status(201).json({action: "create", response: transforms.toObjectWithId(result)});
    }).catch(error => returnError(error, "saving member"));

  if (req.body.password) {
    authConfig.hashValue(req.body.password)
      .then(password => {
        const documentWithPasswordEncrypted = extend({}, document, {password});
        createMember(documentWithPasswordEncrypted);
      }).catch(error => returnError(error, "encrypting password for member"));
  } else {
    createMember(document)
  }
}
