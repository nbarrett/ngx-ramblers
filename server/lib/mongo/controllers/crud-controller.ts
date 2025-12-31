import { Request, Response } from "express";
import { isFunction, isNumber } from "es-toolkit/compat";
import mongoose, { Model } from "mongoose";
import { DataQueryOptions } from "../../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { envConfig } from "../../env-config/env-config";
import * as transforms from "./transforms";
import debug from "debug";
import { ControllerRequest, DeletionResponse } from "../../../../projects/ngx-ramblers/src/app/models/mongo-models";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { DeleteDocumentsRequest } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { pluraliseWithCount } from "../../shared/string-utils";

mongoose.set("strictQuery", false);

export function create<T>(model: Model<T>, debugEnabled = false) {
  const debugLog: debug.Debugger = debug(envConfig.logNamespace("database:" + model.modelName));
  debugLog.enabled = debugEnabled;
  const errorDebugLog: debug.Debugger = debug("ERROR:" + envConfig.logNamespace("database:" + model.modelName));
  errorDebugLog.enabled = true;

  async function createOrUpdateAll(req: Request, res: Response): Promise<void> {
    const documents: T[] = req.body;
    const message = "Create or update of " + documents.length + " " + model.modelName;
    try {
      const response = await createOrUpdateAllDocuments(req);
      res.status(200).json({
        action: ApiAction.UPSERT,
        message,
        response
      });
    } catch (error) {
      errorDebugLog("createOrUpdateAll: " + message + " error:", error);
      res.status(500).json({
        message,
        request: message,
        error: transforms.parseError(error)
      });
    }
  }

  async function findOne(req: Request, res: Response, parameters: DataQueryOptions): Promise<void> {
    try {
      const result = await model.findOne(parameters.criteria).select(parameters.select).exec();
      debugLog(req.query, "findByConditions:parameters", parameters, result, "documents");
      res.status(200).json({
        action: ApiAction.QUERY,
        response: transforms.toObjectWithId(result)
      });
    } catch (error) {
      errorDebugLog("findByConditions: " + model.modelName + " error:", error);
      res.status(500).json({
        message: model.modelName + " query failed",
        request: req.query,
        error: transforms.parseError(error)
      });
    }
  }

  async function findOneDocument(parameters: DataQueryOptions): Promise<T | null> {
    const response = await model.findOne(parameters.criteria).select(parameters.select).exec();
    debugLog("findOneDocument:parameters:", parameters, "response:", response);
    return transforms.toObjectWithId(response) as T | null;
  }

  async function createOrUpdateAllDocuments(req: Request): Promise<T[]> {
    const documents: T[] = req.body;
    const message = "Create or update of " + documents.length + " " + model.modelName;
    debugLog("createOrUpdateAll:received request for", message);
    const response = await Promise.all(
      documents.map(async document => {
        if (document["id"] || document["_id"]) {
          return updateDocument({body: document});
        } else {
          return createDocument({body: document});
        }
      })
    );
    debugLog("createOrUpdateAll:received request for", message, "returned:", pluraliseWithCount(response.length, model.modelName), response);
    return response;
  }

  async function deleteAllDocuments(req: Request): Promise<DeletionResponse[]> {
    const deleteDocumentsRequest: DeleteDocumentsRequest = req.body;
    const message = "Deletion of " + deleteDocumentsRequest.ids.length + " " + model.modelName;
    debugLog("deleteAllDocuments:received request for", message);
    const response = await Promise.all(
      deleteDocumentsRequest.ids.map(id => deleteDocument({body: {id}}))
    );
    debugLog("deleteAllDocuments:received request for", message, "returned:", pluraliseWithCount(response.length, model.modelName), response);
    return response;
  }

  async function updateMany(req: Request, res: Response): Promise<any> {
    try {
      const dataQueryOptions: DataQueryOptions = req.body;
      const filter = dataQueryOptions?.criteria || {};
      const update = dataQueryOptions?.update || {};
      const message = "Update many documents in " + model.modelName;

      debugLog(
        "updateMany:received request body:",
        JSON.stringify(req.body, null, 2),
        "for", message,
        "with filter:", JSON.stringify(filter, null, 2),
        "and update:", JSON.stringify(update, null, 2)
      );

      const originalDocuments = await model.find(filter).exec();
      if (!originalDocuments.length) {
        debugLog("updateMany:No documents matched the criteria");
        return res.status(200).json({
          action: ApiAction.UPDATE,
          message: "No documents matched the criteria",
          response: []
        });
      }

      const updatedDocuments = await Promise.all(
        originalDocuments.map(doc =>
          model.findOneAndUpdate(
            {_id: doc._id},
            update,
            {new: true}
          ).exec()
        )
      );

      debugLog("updateMany:updated documents:", JSON.stringify(updatedDocuments, null, 2));
      res.status(200).json({
        action: ApiAction.UPDATE,
        message,
        response: updatedDocuments.map(doc => transforms.toObjectWithId(doc))
      });
    } catch (error) {
      errorDebugLog("updateMany failed with error:", error);
      res.status(500).json({
        request: req.body,
        error: transforms.parseError(error)
      });
    }
  }

  async function updateDocument(requestDocument: ControllerRequest): Promise<T> {
    const {criteria, document} = transforms.criteriaAndDocument<T>(requestDocument);
    debugLog("pre-update:criteria:", criteria, "document:", document);
    const result = await model.findOneAndUpdate(criteria, document, {new: true}).exec();
    if (!result) throw new Error("Document not found for update");
    const updatedDocument = transforms.toObjectWithId(result);
    debugLog("post-update:updatedDocument:", updatedDocument);
    return updatedDocument;
  }

  async function createDocument(requestDocument: ControllerRequest): Promise<T> {
    const document: any = transforms.createDocumentRequest(requestDocument);
    debugLog("pre-create:document:", document);
    const result = await model.create(document);
    const createdDocument = transforms.toObjectWithId(result);
    debugLog("post-create:createdDocument:", createdDocument);
    return createdDocument;
  }

  async function deleteDocument(requestDocument: ControllerRequest): Promise<DeletionResponse> {
    const criteria = transforms.mongoIdCriteria(requestDocument);
    debugLog("pre-delete:params:", requestDocument.params, "criteria:", criteria);
    const result = await model.deleteOne(criteria).exec();
    const response: DeletionResponse = {id: criteria._id?.toString() || "", deleted: result.deletedCount === 1};
    debugLog("post-delete:deletedCount", result.deletedCount, "result:", result, "response:", response);
    return response;
  }

  async function findDocumentById(id: string): Promise<T | null> {
    debugLog("findDocumentById:", id);
    try {
      const result = await model.findById(id).exec();
      return result ? transforms.toObjectWithId(result) as T : null;
    } catch (error) {
      errorDebugLog("findDocumentById error:", error);
      throw new Error("Query failed: " + transforms.parseError(error));
    }
  }

  return {
    create: async (req: ControllerRequest, res: Response) => {
      try {
        const response = await createDocument(req);
        res.status(201).json({
          action: ApiAction.CREATE,
          response
        });
      } catch (error) {
        res.status(500).json({
          message: "Creation of " + model.modelName + " failed",
          error: transforms.parseError(error)
        });
      }
    },
    update: async (req: ControllerRequest, res: Response) => {
      try {
        const response = await updateDocument(req);
        res.status(200).json({
          action: ApiAction.UPDATE,
          response
        });
      } catch (error) {
        const errorMessage = {
          message: "Update of " + model.modelName + " failed",
          error: transforms.parseError(error)
        };
        errorDebugLog("error:", error);
        res.status(500).json(errorMessage);
      }
    },
    deleteOne: async (req: Request, res: Response) => {
      try {
        const response = await deleteDocument(req);
        res.status(200).json({
          action: ApiAction.DELETE,
          response
        });
      } catch (error) {
        errorDebugLog("deleteOne: " + model.modelName + " failed:", error);
        res.status(500).json({
          message: "Delete of " + model.modelName + " failed",
          error: transforms.parseError(error)
        });
      }
    },
    deleteAll: async (req: Request, res: Response) => {
      const deleteDocumentsRequest: DeleteDocumentsRequest = req.body;
      const message = "Deletion of " + pluraliseWithCount(deleteDocumentsRequest.ids.length, model.modelName);
      try {
        const response = await deleteAllDocuments(req);
        res.status(200).json({
          action: message,
          response
        });
      } catch (error) {
        errorDebugLog("deleteAll: " + message + " error:", error);
        res.status(500).json({
          message,
          request: message,
          error: transforms.parseError(error)
        });
      }
    },
    all: async (req: Request, res: Response) => {
      try {
        const parameters: DataQueryOptions = transforms.parseQueryStringParameters(req);
        const page = parameters.page;
        const limit = parameters.limit;
        const usePagination = isNumber(page) && isNumber(limit);

        if (usePagination) {
          const total = await model.countDocuments(parameters.criteria).exec();
          const skip = (page - 1) * limit;
          const query = model.find(parameters.criteria).select(parameters.select).sort(parameters.sort).skip(skip).limit(limit);
          const allowDisk = (query as any).allowDiskUse;
          if (isFunction(allowDisk)) {
            allowDisk.call(query, true);
          }
          const results = await query.exec();
          const totalPages = Math.ceil(total / limit);

          debugLog(req.query, "paginated find - criteria:found", results.length, "of", total, "documents, page", page, "of", totalPages);
          res.status(200).json({
            action: ApiAction.QUERY,
            response: results.map(result => transforms.toObjectWithId(result)),
            pagination: {
              total,
              page,
              limit,
              totalPages
            }
          });
        } else {
          const query = model.find(parameters.criteria).select(parameters.select).sort(parameters.sort);
          if (isNumber(parameters.limit)) {
            query.limit(parameters.limit);
          }
          const allowDisk = (query as any).allowDiskUse;
          if (isFunction(allowDisk)) {
            allowDisk.call(query, true);
          }
          const results = await query.exec();
          debugLog(req.query, "find - criteria:found", results.length, "documents:", results);
          res.status(200).json({
            action: ApiAction.QUERY,
            response: results.map(result => transforms.toObjectWithId(result))
          });
        }
      } catch (error) {
        errorDebugLog("all:query", req.query, "error:", error);
        res.status(500).json({
          message: model.modelName + " query failed",
          error: transforms.parseError(error)
        });
      }
    },
    findById: async (req: Request, res: Response) => {
      debugLog("find - id:", req.params.id);
      try {
        const result = await model.findById(req.params.id).exec();
        if (result) {
          debugLog(req.query, "find - id:", req.params.id, "- criteria:found", result);
          res.status(200).json({
            action: ApiAction.QUERY,
            response: transforms.toObjectWithId(result)
          });
        } else {
          res.status(404).json({
            message: model.modelName + " not found",
            request: req.params.id
          });
        }
      } catch (error) {
        res.status(500).json({
          message: model.modelName + " query failed",
          request: req.params.id,
          error: transforms.parseError(error)
        });
      }
    },
    findByConditions: async (req: Request, res: Response) => {
      const parameters: DataQueryOptions = transforms.parseQueryStringParameters(req);
      await findOne(req, res, parameters);
    },
    errorDebugLog,
    findOne,
    findOneDocument,
    findDocumentById,
    deleteDocument,
    createOrUpdateAll,
    updateDocument,
    updateMany,
    createDocument
  };
}
