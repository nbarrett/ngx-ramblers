import { omit, each, includes, set, isArray } from "lodash";
import debug from "debug";
import { DataQueryOptions, MongoId } from "../../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { envConfig } from "../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("transforms"));
debugLog.enabled = true;

export function toObjectWithId(document) {
  return document ? {
    id: document._id,
    ...omit(document.toObject(), ["_id", "__v"]),
  } : document;
}

export function setUnSetDocument(document: object, parent?: string, parentResponse?: object) {
  const parentPath = parent ? parent + "." : "";
  const localResponse = parentResponse || {};
  each(document, (value: any, field) => {
    if (typeof value === "string") {
      value = value.trim();
    }
    const fullPath = parentPath + field;
    if (includes([null, "", undefined], value)) {
      debug("removing field:", fullPath, "[" + typeof (value) + "]", "value:", value);
      set(localResponse, ["$unset", fullPath], 1);
    } else if (isArray(value)) {
      debug("setting array:", fullPath, "[" + typeof (value) + "]", "value:", value);
      set(localResponse, ["$set", fullPath], value);
    } else if (typeof (value) === "object") {
      debug("setting nested field:", fullPath, "[" + typeof (value) + "]", "value:", value);
      setUnSetDocument(value, fullPath, localResponse);
    } else {
      debug("setting field:", fullPath, "[" + typeof (value) + "]", "value:", value);
      set(localResponse, ["$set", fullPath], value);
    }
  });
  return localResponse;
}

export function criteria(req): MongoId {
  return {_id: req.params.id};
}

export function parse(req, queryParameter) {
  if (req.query) {
    const value = req.query[queryParameter];
    return value ? typeof value === "string" ? JSON.parse(value) : value : {};
  } else {
    return {};
  }
}

export function parseQueryStringParameters(req): DataQueryOptions {
  return {
    criteria: parse(req, "criteria"),
    limit: parse(req, "limit"),
    select: parse(req, "select"),
    sort: parse(req, "sort"),
  };
}

export function updateDocumentRequest(req) {
  const documentMinusIds = omit(req.body, ["_id", "__v", "id"]);
  return setUnSetDocument(documentMinusIds);
}

export function createDocumentRequest(req) {
  return createDocument(updateDocumentRequest(req));
}

export function createDocument(setUnSetDocument) {
  const response = {};
  const setFields = setUnSetDocument.$set;
  each(setFields, (value, field) => {
    set(response, field.split("."), value);
  });
  return response;
}

export function criteriaAndDocument(req): { criteria: { _id: string }; document: object } {
  return {
    criteria: criteria(req),
    document: updateDocumentRequest(req)
  };
}

export function parseError(error) {
  if (error instanceof Error) {
    debug("parseError:returning Error:", error.toString());
    return error.toString();
  } else if (error.errmsg) {
    debug("parseError:returning errmsg:", error.errmsg);
    return error.errmsg;
  } else {
    debug("parseError:returning errmsg:", typeof error, error);
    return error;
  }
}
