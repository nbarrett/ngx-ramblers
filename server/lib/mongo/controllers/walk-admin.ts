import { Request, Response } from "express";
import { extendedGroupEvent } from "../models/extended-group-event";
import { EventField, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";

import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import {
  EditableEventStats,
  EventStats,
  EventStatsRequest
} from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";

const debugLog = debug(envConfig.logNamespace("walk-admin"));
debugLog.enabled = true;

export async function eventStats(req: Request, res: Response) {
  try {
    const pipeline = [
      {
        $project: {
          itemType: `$${GroupEventField.ITEM_TYPE}`,
          groupCode: `$${GroupEventField.GROUP_CODE}`,
          groupName: `$${GroupEventField.GROUP_NAME}`,
          startDate: `$${GroupEventField.START_DATE}`,
          inputSource: `$${EventField.INPUT_SOURCE}`,
        }
      },
      {
        $group: {
          _id: {
            itemType: "$itemType",
            groupCode: "$groupCode",
            groupName: "$groupName",
            inputSource: "$inputSource"
          },
          eventCount: { $sum: 1 },
          minDate: {$min: "$startDate"},
          maxDate: {$max: "$startDate"},
          uniqueCreators: {
            $addToSet: {
              $cond: {
                if: { $ifNull: [`$${GroupEventField.CREATED_BY}`, false] },
                then: {$ifNull: [`$${EventField.CONTACT_DETAILS_MEMBER_ID}`, "unknown"]},
                else: {$ifNull: [`$${GroupEventField.CREATED_BY}`, "unknown"]}
              }
            }
          },
        }
      },
      {
        $project: {
          itemType: "$_id.itemType",
          groupCode: "$_id.groupCode",
          groupName: "$_id.groupName",
          inputSource: "$_id.inputSource",
          eventCount: 1,
          minDate: 1,
          maxDate: 1,
          uniqueCreators: {
            $filter: {
              input: "$uniqueCreators",
              as: "creator",
              cond: { $ne: ["$$creator", null] }
            }
          },
          _id: 0
        }
      },
      {
        $sort: {
          itemType: 1,
          groupCode: 1,
          minDate: 1,
          inputSource: 1
        }
      }
    ];

    const eventStats: EventStats[] = await extendedGroupEvent.aggregate(pipeline).exec();
    debugLog("eventStats returned:", eventStats);
    res.json(eventStats);
  } catch (error) {
    debugLog(error);
    res.status(500).json({ error: error.message });
  }
}

export async function bulkDeleteEvents(req: Request, res: Response) {
  try {
    const request = req.body as EventStatsRequest[];
    debugLog("bulkDeleteWalkGroups: request:", request, "body:", req.body);
    if (!request || !Array.isArray(request)) {
      return res.status(400).json({ error: "Invalid event stats request" });
    }

    const result = await extendedGroupEvent.deleteMany({
      [GroupEventField.ITEM_TYPE]: { $in: request.map(group => group.itemType) },
      [GroupEventField.GROUP_CODE]: {$in: request.map(group => group.groupCode)},
      [EventField.INPUT_SOURCE]: {$in: request.map(group => group.inputSource)}
    }).exec();

    res.json({ message: `Deleted ${result.deletedCount} walks` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function bulkUpdateEvents(req: Request, res: Response) {
  try {
    const updates = req.body as EditableEventStats[];
    debugLog("bulkUpdateEvents: updates:", updates);
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: "Invalid update data" });
    }

    const updatePromises = updates.map(async update => {
      const matchCount = await extendedGroupEvent.countDocuments({
        [GroupEventField.ITEM_TYPE]: update.itemType,
        [GroupEventField.GROUP_CODE]: update.groupCode,
        [EventField.INPUT_SOURCE]: update.inputSource
      }).exec();
      debugLog(`bulkUpdateEvents: Matched ${matchCount} documents for update - itemType: ${update.itemType}, groupCode: ${update.groupCode}, original inputSource: ${update.inputSource}, new values: groupCode: ${update.editedGroupCode}, groupName: ${update.editedGroupName}, inputSource: ${update.editedInputSource}`);

      const result = await extendedGroupEvent.updateMany(
        {
          [GroupEventField.ITEM_TYPE]: update.itemType,
          [GroupEventField.GROUP_CODE]: update.groupCode,
          [EventField.INPUT_SOURCE]: update.inputSource
        },
        {
          $set: {
            [GroupEventField.GROUP_CODE]: update.editedGroupCode,
            [GroupEventField.GROUP_NAME]: update.editedGroupName,
            [EventField.INPUT_SOURCE]: update.editedInputSource
          }
        }
      ).exec();
      debugLog(`bulkUpdateEvents: Updated ${result.modifiedCount} documents - itemType: ${update.itemType}, groupCode: ${update.groupCode}, original inputSource: ${update.inputSource}, new values applied: groupCode: ${update.editedGroupCode}, groupName: ${update.editedGroupName}, inputSource: ${update.editedInputSource}`);
      return result;
    });

    const results = await Promise.all(updatePromises);
    const totalUpdated = results.reduce((sum, result) => sum + result.modifiedCount, 0);
    debugLog(`bulkUpdateEvents: Total updated documents: ${totalUpdated}`);
    res.json({ message: `Updated ${totalUpdated} events` });
  } catch (error) {
    debugLog("bulkUpdateEvents:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function recreateIndex(req: Request, res: Response) {
  try {
    debugLog("recreateIndex: indexes: starting");
    const indexes = await (extendedGroupEvent.collection as any).indexInformation();
    debugLog("recreateIndex: indexes:", indexes);
    const oldIndexKey = { "groupEvent.start_date_time": 1, "groupEvent.item_type": 1, "groupEvent.group_code": 1 };
    let oldIndexName: string | undefined;

    for (const name in indexes) {
      if (indexes.hasOwnProperty(name)) {
        const indexKeyArray = indexes[name];
        const indexKeyObj = indexKeyArray.reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
          // tslint:disable-next-line:no-object-literal-type-assertion
        }, {} as { [key: string]: number });
        if (JSON.stringify(indexKeyObj) === JSON.stringify(oldIndexKey)) {
          oldIndexName = name;
          break;
        }
      }
    }

    if (oldIndexName) {
      await (extendedGroupEvent.collection as any).dropIndex(oldIndexName);
      debugLog("recreateIndex: Dropped old index:", oldIndexName);
    } else {
      debugLog("recreateIndex: No old index found to drop");
    }

    await extendedGroupEvent.syncIndexes();
    debugLog("recreateIndex: New index synchronized successfully");

    res.json({ message: "Index recreated successfully" });
  } catch (error) {
    debugLog("recreateIndex: error:", error);
    res.status(500).json({ error: error.message });
  }
}
