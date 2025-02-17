import { Request, Response } from "express";
import { isNumber } from "lodash";
import { DataQueryOptions } from "../../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { envConfig } from "../../env-config/env-config";
import * as transforms from "./transforms";
import debug from "debug";
import * as mongoose from "mongoose";
import { ControllerRequest, DeletionResponse } from "../../../../projects/ngx-ramblers/src/app/models/mongo-models";
import { ApiAction, Identifiable } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { pluraliseWithCount } from "../../../serenity-js/screenplay/util/util";
import { DeleteDocumentsRequest } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

export function create<T extends Identifiable>(model: mongoose.Model<mongoose.Document>, debugEnabled?: boolean) {
  const debugLog: debug.Debugger = debug(envConfig.logNamespace(`database:${model.modelName}`));
  debugLog.enabled = debugEnabled;

  async function createOrUpdateAll(req: Request, res: Response) {
    const documents: T[] = req.body;
    const message = `Create or update of ${pluraliseWithCount(documents.length, model.modelName)}`;
    createOrUpdateAllDocuments(req).then((response: T[]) => {
      res.status(200).json({
        action: ApiAction.UPSERT,
        message,
        response
      });
    }).catch(error => {
      debugLog(`createOrUpdateAll: ${message} error: ${error}`);
      res.status(500).json({
        message,
        request: message,
        error: transforms.parseError(error)
      });
    });
  }

  function findOne(req: Request, res: Response, parameters: DataQueryOptions) {
    return model.findOne(parameters.criteria).select(parameters.select)
      .then(result => {
        debugLog(req.query, "findByConditions:parameters", parameters, result, "documents");
        return res.status(200).json({
          action: ApiAction.QUERY,
          response: transforms.toObjectWithId(result)
        });
      })
      .catch(error => {
        debugLog(`findByConditions: ${model.modelName} error: ${error}`);
        res.status(500).json({
          message: `${model.modelName} query failed`,
          request: req.query,
          error: transforms.parseError(error)
        });
      });
  }

  async function createOrUpdateAllDocuments(req: Request): Promise<T[]> {
    const documents: T[] = req.body;
    const message = `Create or update of ${pluraliseWithCount(documents.length, model.modelName)}`;
    debugLog("createOrUpdateAll:received request for", message);
    const response = await Promise.all(documents.map(member => {
      if (member.id) {
        return updateDocument({body: member});
      } else {
        return createDocument({body: member});
      }
    }));
    debugLog("createOrUpdateAll:received request for", message, "returned:", pluraliseWithCount(response.length, model.modelName), response);
    return response;
  }

  async function deleteAllDocuments(req: Request): Promise<DeletionResponse[]> {
    const deleteDocumentsRequest: DeleteDocumentsRequest = req.body;
    const message = `Deletion of ${pluraliseWithCount(deleteDocumentsRequest.ids.length, model.modelName)}`;
    debugLog("deleteAllDocuments:received request for", message);
    const response = await Promise.all(deleteDocumentsRequest.ids.map(id => {
      return deleteDocument({body: {id}});
    }));
    debugLog("deleteAllDocuments:received request for", message, "returned:", pluraliseWithCount(response.length, model.modelName), response);
    return response;
  }

  async function updateDocument(requestDocument: ControllerRequest): Promise<T> {
    const {criteria, document} = transforms.criteriaAndDocument<T>(requestDocument);
    debugLog("pre-update:criteria:", criteria, "document:", document);
    const result = await model.findOneAndUpdate(criteria, document, {
      useFindAndModify: false,
      new: true
    });
    const updatedDocument = transforms.toObjectWithId(result);
    debugLog("post-update:updatedDocument:", updatedDocument);
    return updatedDocument;
  }

  async function createDocument(requestDocument: ControllerRequest): Promise<T> {
    const document = transforms.createDocumentRequest(requestDocument);
    debugLog("pre-create:document:", document);
    const result = await new model(document).save();
    const createdDocument = transforms.toObjectWithId(result);
    debugLog("post-update:createdDocument:", createdDocument);
    return createdDocument;
  }

  async function deleteDocument(requestDocument: ControllerRequest): Promise<DeletionResponse> {
    const criteria = transforms.mongoIdCriteria(requestDocument);
    debugLog("pre-delete:params:", requestDocument.params, "criteria:", criteria);
    const result = await model.deleteOne(criteria);
    const response: DeletionResponse = {id: criteria._id, deleted: result.deletedCount === 1};
    debugLog("post-update:deletedCount", result.deletedCount, "result:", result, "response:", response);
    return response;
  }

  async function findDocumentById(id: string): Promise<T> {
    debugLog("findDocumentById:", id);
    return model.findById(id)
      .then(result => transforms.toObjectWithId(result))
      .catch(error => {
        return {
          message: `${model.modelName} query failed`,
          request: id,
          error: transforms.parseError(error)
        };
      });
  }

  return {
    create: (req: ControllerRequest, res: Response) => {
      createDocument(req)
        .then(response => {
          res.status(201).json({
            action: ApiAction.CREATE,
            response
          });
        })
        .catch(error => res.status(500).json({
          message: `Creation of ${model.modelName} failed`,
          error: transforms.parseError(error),
        }));
    },
    update: (req: ControllerRequest, res: Response) => {
      updateDocument(req)
        .then(response => {
          res.status(200).json({
            action: ApiAction.UPDATE,
            response
          });
        }).catch(error => {
          res.status(500).json({
            message: `Update of ${model.modelName} failed`,
            error: transforms.parseError(error)
          });
        });
    },
    deleteOne: (req: Request, res: Response) => {
      deleteDocument(req)
        .then(response => {
          res.status(200).json({
            action: ApiAction.DELETE,
            response
          });
        })
        .catch(error => {
          res.status(500).json({
            message: `Delete of ${model.modelName} failed`,
            error: transforms.parseError(error)
          });
        });
    },
    deleteAll: (req: Request, res: Response) => {
      const deleteDocumentsRequest: DeleteDocumentsRequest = req.body;
      const message = `Deletion of ${pluraliseWithCount(deleteDocumentsRequest.ids.length, model.modelName)}`;
      deleteAllDocuments(req).then(response => {
        res.status(200).json({
          action: message,
          response
        });
      }).catch(error => {
        debugLog(`deleteAll: ${message} error: ${error}`);
        res.status(500).json({
          message,
          request: message,
          error: transforms.parseError(error)
        });
      });
    },
    all: (req: Request, res: Response) => {
      const parameters: DataQueryOptions = transforms.parseQueryStringParameters(req);
      const query = model.find(parameters.criteria).select(parameters.select).sort(parameters.sort);
      if (isNumber(parameters.limit)) {
        query.limit(parameters.limit);
      }
      query
        .then(results => {
          debugLog(req.query, "find - criteria:found", results.length, "documents:", results);
          return res.status(200).json({
            action: ApiAction.QUERY,
            response: results.map(result => transforms.toObjectWithId(result))
          });
        })
        .catch(error => {
          debugLog("all:query", req.query, "error");
          res.status(500).json({
            message: `${model.modelName} query failed`,
            error: transforms.parseError(error)
          });
        });
    },
    findById: (req: Request, res: Response) => {
      debugLog("find - id:", req.params.id);
      model.findById(req.params.id)
        .then(result => {
          if (result) {
            res.status(200).json({
              action: ApiAction.QUERY,
              response: transforms.toObjectWithId(result)
            });
          } else {
            res.status(404).json({
              message: `${model.modelName} not found`,
              request: req.params.id
            });
          }
        })
        .catch(error => {
          res.status(500).json({
            message: `${model.modelName} query failed`,
            request: req.params.id,
            error: transforms.parseError(error)
          });
        });
    },
    findByConditions: (req: Request, res: Response) => {
      const parameters: DataQueryOptions = transforms.parseQueryStringParameters(req);
      findOne(req, res, parameters);
    },
    findOne,
    findDocumentById,
    deleteDocument,
    createOrUpdateAll,
    updateDocument,
    createDocument,
  };
}



