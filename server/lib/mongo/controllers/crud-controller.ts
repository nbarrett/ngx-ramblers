import { Request, Response } from "express";
import { isNumber } from "lodash";
import { DataQueryOptions } from "../../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { envConfig } from "../../env-config/env-config";
import * as transforms from "./transforms";

export function create(model, debugEnabled?: boolean) {
  const debug = require("debug")(envConfig.logNamespace(`database:${model.modelName}`));
  debug.enabled = debugEnabled;

  function findOne(req: Request, res: Response, parameters: DataQueryOptions): void {
    return model.findOne(parameters.criteria).select(parameters.select)
      .then(result => {
        debug(req.query, "findByConditions:parameters", parameters, result, "documents");
        return res.status(200).json({
          action: "query",
          response: transforms.toObjectWithId(result)
        });
      })
      .catch(error => {
        debug(`findByConditions: ${model.modelName} error: ${error}`);
        res.status(500).json({
          message: `${model.modelName} query failed`,
          request: req.query,
          error: transforms.parseError(error)
        });
      });
  }

  return {
    create: (req: Request, res: Response) => {
      const document = transforms.createDocumentRequest(req);
      debug("create:body:", req.body, "document:", document);
      new model(document).save()
        .then(result => {
          res.status(201).json({
            action: "create",
            response: transforms.toObjectWithId(result)
          });
        })
        .catch(error => res.status(500).json({
          message: `Creation of ${model.modelName} failed`,
          error: transforms.parseError(error),
          request: req.body,
        }));
    },
    update: (req: Request, res: Response) => {
      const {criteria, document} = transforms.criteriaAndDocument(req);
      debug("pre-update:body:", req.body, "criteria:", criteria, "document:", document);
      model.findOneAndUpdate(criteria, document, {useFindAndModify: false, new: true})
        .then(result => {
          debug("post-update:document:", document, "result:", result);
          res.status(200).json({
            action: "update",
            response: transforms.toObjectWithId(result)
          });
        })
        .catch(error => {
          res.status(500).json({
            message: `Update of ${model.modelName} failed`,
            request: document,
            error: transforms.parseError(error)
          });
        });
    },
    delete: (req: Request, res: Response) => {
      const criteria = transforms.criteria(req);
      debug("delete:", criteria);
      model.deleteOne(criteria)
        .then(result => {
          debug("deletedCount", result.deletedCount, "result:", result);
          res.status(200).json({
            action: "delete",
            response: {id: req.params.id}
          });
        })
        .catch(error => {
          res.status(500).json({
            message: `Delete of ${model.modelName} failed`,
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
          debug(req.query, "find - criteria:found", results.length, "documents");
          return res.status(200).json({
            action: "query",
            response: results.map(result => transforms.toObjectWithId(result))
          });
        })
        .catch(error => {
          debug("all:query", req.query, "error");
          res.status(500).json({
            message: `${model.modelName} query failed`,
            request: req.query,
            error: transforms.parseError(error)
          });
        });
    },
    findById: (req: Request, res: Response) => {
      debug("find - id:", req.params.id);
      model.findById(req.params.id)
        .then(result => {
          if (result) {
            res.status(200).json({
              action: "query",
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
    findOne
  };
}



