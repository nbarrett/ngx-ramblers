import { Request, Response } from "express";
import { extendedGroupEvent } from "../models/extended-group-event";
import { GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";

import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { EventStatsRequest } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";

const debugLog = debug(envConfig.logNamespace("walk-admin"));
debugLog.enabled = true;

export async function eventStats(req: Request, res: Response) {
  try {
    const eventStats = await extendedGroupEvent.aggregate([
      {
        $group: {
          _id: {itemType: `$${GroupEventField.ITEM_TYPE}`, groupCode: `$${GroupEventField.GROUP_CODE}`},
          walkCount: {$sum: 1},
          minDate: {$min: `$${GroupEventField.START_DATE}`},
          maxDate: {$max: `$${GroupEventField.START_DATE}`},
          uniqueCreators: {
            $addToSet: {
              $cond: {
                if: {$ifNull: [`$${GroupEventField.CREATED_BY}`, false]},
                then: `$${GroupEventField.CREATED_BY}`,
                else: "$groupEvent.memberId"
              }
            }
          }
        }
      },
      {
        $project: {
          itemType: "$_id.itemType",
          groupCode: "$_id.groupCode",
          walkCount: 1,
          minDate: 1,
          maxDate: 1,
          uniqueCreators: {
            $filter: {
              input: "$uniqueCreators",
              as: "creator",
              cond: {$ne: ["$$creator", null]}
            }
          },
          _id: 0
        }
      }
    ]).exec();
    debugLog("eventStats returned:", eventStats);
    res.json(eventStats);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export async function bulkDeleteEvents(req: Request, res: Response) {
  try {
    const request = req.body as EventStatsRequest[];
    debugLog("bulkDeleteWalkGroups: request:", request, "body:", req.body);
    if (!request || !Array.isArray(request)) {
      return res.status(400).json({error: "Invalid event stats request"});
    }

    const result = await extendedGroupEvent.deleteMany({
      [GroupEventField.ITEM_TYPE]: {$in: request.map(group => group.itemType)},
      [GroupEventField.GROUP_CODE]: {$in: request.map(group => group.groupCode)}
    }).exec();

    res.json({message: `Deleted ${result.deletedCount} walks`});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}
