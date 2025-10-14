import debug from "debug";
import { Request, Response } from "express";
import { ConfigDocument, ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { envConfig } from "../../env-config/env-config";
import { config } from "../models/config";
import * as crudController from "./crud-controller";
import * as transforms from "./transforms";
import { createDocumentRequest, parseError, toObjectWithId } from "./transforms";
import { enumForKey, enumValues } from "../../../../projects/ngx-ramblers/src/app/functions/enums";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";

const debugLog = debug(envConfig.logNamespace("config"));
debugLog.enabled = false;
const controller = crudController.create<ConfigDocument>(config);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;

function criteriaForKey(configKey: ConfigKey) {
  const criteria = {key: {$eq: configKey}};
  debugLog("criteriaForKey:", configKey, "returning:", criteria);
  return criteria;
}

function configCriteriaFromBody(req: Request) {
  const configDocument: ConfigDocument = req.body;
  const configKey: ConfigKey = configDocument.key;
  return criteriaForKey(configKey);
}

function configKeyFromQuerystring(req: Request): ConfigKey {
  const keyAsString = req.query.key as string;
  const key = enumForKey(ConfigKey, keyAsString);
  if (key) {
    return key;
  } else {
    const message = keyAsString ? `invalid key ${keyAsString}` : `no key`;
    throw new Error(`${message} supplied in querystring - must be one of ${enumValues(ConfigKey).join(", ")}`);
  }
}

function configCriteriaFromQuerystring(req: Request) {
  const configKey = configKeyFromQuerystring(req);
  return criteriaForKey(configKey);
}

export async function createOrUpdate(req: Request, res: Response) {
  const {document} = transforms.criteriaAndDocument(req);
  const criteria = configCriteriaFromBody(req);
  debugLog("pre-update:body:", req.body, "criteria:", criteria, "document:", document);
  const documentRequest = createDocumentRequest(req);
  config.findOneAndUpdate(criteria, documentRequest, {upsert: true, new: true, useFindAndModify: false})
    .then(result => {
      debugLog("post-update:document:", documentRequest, "result:", result);
      res.status(200).json({
        action: ApiAction.UPDATE,
        response: toObjectWithId(result)
      });
    })
    .catch(error => {
      return res.status(500).json({
        message: `Update of ${config.modelName} failed`,
        request: document,
        error: parseError(error)
      });
    });
}

export function queryKey(configKey: ConfigKey): Promise<ConfigDocument> {
  return config.findOne(criteriaForKey(configKey))
    .then(response => toObjectWithId(response));
}

export function handleQuery(req: Request, res: Response): Promise<any> {
  try {
    const criteria = configCriteriaFromQuerystring(req);
    return config.findOne(criteria)
      .then(response => {
        const configDocument: ConfigDocument = toObjectWithId(response);
        debugLog(req.query, "findByConditions:criteria", criteria, "configDocument:", configDocument);
        return res.status(200).json({
          action: ApiAction.QUERY,
          response: configDocument?.value
        });
      })
      .catch(error => {
        controller.errorDebugLog(`findByConditions: ${config.modelName} error: ${error}`);
        res.status(500).json({
          message: `${config.modelName} query failed`,
          request: req.query,
          error: parseError(error),
          stack: error.stack
        });
      });
  } catch (e) {
    controller.errorDebugLog("findByConditions:catch", e);
    res.status(500).json({
      message: `query of config key failed`,
      request: req.query,
      error: parseError(e)
    });
  }
}
