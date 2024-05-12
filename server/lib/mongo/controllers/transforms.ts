import { each, includes, isArray, isEmpty, omit, set } from "lodash";
import debug from "debug";
import { DataQueryOptions, MongoId } from "../../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { envConfig } from "../../env-config/env-config";
import { Request } from "express";
import {
  ControllerRequest,
  CriteriaAndDocument,
  HasBody,
  SetUnSetDocument
} from "../../../../projects/ngx-ramblers/src/app/models/mongo-models";
import { Identifiable } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("transforms"));
debugLog.enabled = false;

export function toObjectWithId(document: any) {
  return document ? {
    id: document._id,
    ...omit(document.toObject(), ["_id", "__v"]),
  } : document;
}

export function setUnSetDocument<T>(document: T, parent?: string, parentResponse?: object): SetUnSetDocument {
  const parentPath = parent ? parent + "." : "";
  const setUnSetDocumentResponse: SetUnSetDocument = parentResponse || {};
  each(document as any, (value: any, field) => {
    if (typeof value === "string") {
      value = value.trim();
    }
    const fullPath = parentPath + field;
    if (includes([null, "", undefined], value)) {
      debugLog("removing field:", fullPath, "[" + typeof (value) + "]", "value:", value);
      set(setUnSetDocumentResponse, ["$unset", fullPath], 1);
    } else if (isArray(value)) {
      debugLog("setting array:", fullPath, "[" + typeof (value) + "]", "value:", value);
      set(setUnSetDocumentResponse, ["$set", fullPath], value);
    } else if (typeof (value) === "object") {
      debugLog("setting nested field:", fullPath, "[" + typeof (value) + "]", "value:", value);
      setUnSetDocument(value, fullPath, setUnSetDocumentResponse);
    } else {
      debugLog("setting field:", fullPath, "[" + typeof (value) + "]", "value:", value);
      set(setUnSetDocumentResponse, ["$set", fullPath], value);
    }
  });
  return setUnSetDocumentResponse;
}

export function mongoIdCriteria(controllerRequest: ControllerRequest | Identifiable): MongoId {
  debugLog("mongoIdCriteria:controllerRequest:", controllerRequest, "isControllerRequest:",
    isControllerRequest(controllerRequest), "hasBody(controllerRequest):", hasBody(controllerRequest));
  const returnValue = {
    _id: hasBody(controllerRequest) ?
      controllerRequest.body?.id :
      isControllerRequest(controllerRequest) ? controllerRequest.params?.id : controllerRequest?.id
  };
  debugLog("mongoIdCriteria:returnValue:", returnValue);
  return returnValue;
}

export function parse(req: Request, queryParameter: string) {
  if (req.query) {
    const value = req.query[queryParameter];
    return value ? typeof value === "string" ? JSON.parse(value) : value : {};
  } else {
    return {};
  }
}

export function parseQueryStringParameters(req: Request): DataQueryOptions {
  return {
    criteria: parse(req, "criteria"),
    limit: parse(req, "limit"),
    select: parse(req, "select"),
    sort: parse(req, "sort"),
  };
}

export function documentFromRequest<T>(documentOrRequest: T | (T & ControllerRequest)) {
  return isControllerRequest(documentOrRequest) ? documentOrRequest.body : documentOrRequest;
}

export function updateDocumentRequest<T>(documentOrRequest: T): SetUnSetDocument {
  const document = documentFromRequest(documentOrRequest);
  const documentMinusIds = omit(document as any, ["_id", "__v", "id"]);
  return setUnSetDocument<T>(documentMinusIds);
}

export function createDocumentRequest<T>(documentOrRequest: T): T {
  return createDocument(updateDocumentRequest(documentOrRequest));
}

export function createDocument<T>(setUnSetDocument: SetUnSetDocument): T {
  const response: any = {};
  const setFields = setUnSetDocument.$set;
  each(setFields, (value, field) => {
    set(response, field.split("."), value);
  });
  return response;
}

export function criteriaAndDocument<T>(req: ControllerRequest): CriteriaAndDocument {
  return {
    criteria: mongoIdCriteria(req),
    document: updateDocumentRequest(req)
  };
}

export function parseError(error: any) {
  if (error instanceof Error) {
    debugLog("parseError:returning Error:", error.toString());
    return error.toString();
  } else if (error.errmsg) {
    debugLog("parseError:returning errmsg:", error.errmsg);
    return error.errmsg;
  } else {
    debugLog("parseError:returning errmsg:", typeof error, error);
    return error;
  }
}

export function isControllerRequest(object: any): object is ControllerRequest {
  const request = object as ControllerRequest;
  return request?.params !== undefined || request?.body !== undefined;
}

export function hasBody(object: any): object is HasBody {
  return !isEmpty(object?.body) && object?.body !== undefined;
}
