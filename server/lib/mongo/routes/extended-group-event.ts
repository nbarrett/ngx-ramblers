import express, { NextFunction } from "express";
import * as authConfig from "../../auth/auth-config";
import * as crudController from "../controllers/crud-controller";
import { extendedGroupEvent } from "../models/extended-group-event";
import { count, dateRange, nextWalkId, queryVenues, queryWalkLeaders, urlFromTitle } from "../controllers/extended-group-event";
import { EventSource, ExtendedGroupEvent } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { DocumentField, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";

const controller = crudController.create<ExtendedGroupEvent>(extendedGroupEvent, false);
const router = express.Router();
const LOCAL_ACTIVE_FILTER = {
  $or: [
    { [DocumentField.SOURCE]: { $ne: EventSource.LOCAL } },
    { [DocumentField.SOURCE]: EventSource.LOCAL, [GroupEventField.STATUS]: { $ne: "deleted" } }
  ]
};

function mergeLocalFilter(criteria: any = {}) {
  if (criteria && criteria.$and) {
    return {...criteria, $and: [...criteria.$and, LOCAL_ACTIVE_FILTER]};
  }
  if (!criteria || Object.keys(criteria).length === 0) {
    return LOCAL_ACTIVE_FILTER;
  }
  return {$and: [criteria, LOCAL_ACTIVE_FILTER]};
}

function ensureLocalDeletedFilter(req: express.Request, _res: express.Response, next: NextFunction) {
  try {
    const rawCriteria = req.query.criteria as string | undefined;
    const parsed = rawCriteria ? JSON.parse(rawCriteria) : {};
    req.query.criteria = JSON.stringify(mergeLocalFilter(parsed));
  } catch (error) {
    req.query.criteria = JSON.stringify(mergeLocalFilter());
  }
  next();
}

router.get("/count", ensureLocalDeletedFilter, count);
router.post("", authConfig.authenticate(), controller.create);
router.get("", ensureLocalDeletedFilter, controller.findByConditions);
router.get("/all", ensureLocalDeletedFilter, controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.post("/delete-all", authConfig.authenticate(), controller.deleteAll);
router.post("/update-many", authConfig.authenticate(), controller.updateMany);
router.post("/all", authConfig.authenticate(), controller.createOrUpdateAll);
router.get("/walk-leaders", queryWalkLeaders);
router.get("/venues", queryVenues);
router.get("/date-range", dateRange);
router.get("/next-walk-id", nextWalkId);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);
router.post("/url-from-title", authConfig.authenticate(), urlFromTitle);

export const extendedGroupEventRoutes = router;
