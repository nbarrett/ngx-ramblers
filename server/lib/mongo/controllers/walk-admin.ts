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
import { PipelineStage } from "mongoose";

const debugLog = debug(envConfig.logNamespace("walk-admin"));
debugLog.enabled = true;

export async function eventStats(req: Request, res: Response) {
  try {
    const pipeline: PipelineStage[] = [
      {
        $project: {
          itemType: `$${GroupEventField.ITEM_TYPE}`,
          groupCode: `$${GroupEventField.GROUP_CODE}`,
          groupName: `$${GroupEventField.GROUP_NAME}`,
          startDate: `$${GroupEventField.START_DATE}`,
          inputSource: `$${EventField.INPUT_SOURCE}`,
        },
      },
      {
        $group: {
          _id: {
            itemType: "$itemType",
            groupCode: "$groupCode",
            groupName: "$groupName",
            inputSource: "$inputSource",
          },
          eventCount: { $sum: 1 },
          minDate: { $min: "$startDate" },
          maxDate: { $max: "$startDate" },
          uniqueCreators: {
            $addToSet: {
              $ifNull: [
                `$${GroupEventField.CREATED_BY}`,
                `$${EventField.CONTACT_DETAILS_MEMBER_ID}`,
                "unknown",
              ],
            },
          },
        },
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
              cond: { $ne: ["$$creator", null] },
            },
          },
          _id: 0,
        },
      },
      {
        $sort: {
          itemType: 1,
          groupCode: 1,
          minDate: 1,
          inputSource: 1,
        },
      },
    ];

    const eventStats = await extendedGroupEvent.aggregate<EventStats>(pipeline);
    debugLog("eventStats returned:", eventStats);
    res.json(eventStats);
  } catch (error) {
    debugLog("eventStats error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function bulkDeleteEvents(req: Request, res: Response) {
  try {
    const request = req.body as EventStatsRequest[];
    debugLog("bulkDeleteEvents: request:", request);
    if (!Array.isArray(request)) {
      return res.status(400).json({ error: "Invalid event stats request" });
    }

    const result = await extendedGroupEvent.deleteMany({
      $and: [
        { [GroupEventField.ITEM_TYPE]: { $in: request.map(group => group.itemType) } },
        { [GroupEventField.GROUP_CODE]: { $in: request.map(group => group.groupCode) } },
        { [EventField.INPUT_SOURCE]: { $in: request.map(group => group.inputSource) } },
      ],
    });

    res.json({ message: `Deleted ${result.deletedCount} events` });
  } catch (error) {
    debugLog("bulkDeleteEvents error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function bulkUpdateEvents(req: Request, res: Response) {
  try {
    const updates = req.body as EditableEventStats[];
    debugLog("bulkUpdateEvents: updates:", updates);
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "Invalid update data" });
    }

    const bulkOps = updates.map(update => ({
      updateMany: {
        filter: {
          [GroupEventField.ITEM_TYPE]: update.itemType,
          [GroupEventField.GROUP_CODE]: update.groupCode,
          [EventField.INPUT_SOURCE]: update.inputSource,
        },
        update: {
          $set: {
            [GroupEventField.GROUP_CODE]: update.editedGroupCode,
            [GroupEventField.GROUP_NAME]: update.editedGroupName,
            [EventField.INPUT_SOURCE]: update.editedInputSource,
          },
        },
      },
    }));

    const result = await extendedGroupEvent.bulkWrite(bulkOps);
    debugLog(`bulkUpdateEvents: Updated ${result.modifiedCount} documents`);
    res.json({ message: `Updated ${result.modifiedCount} events` });
  } catch (error) {
    debugLog("bulkUpdateEvents error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function recreateIndex(req: Request, res: Response) {
  try {
    debugLog("recreateIndex: starting");
    const oldIndexKey = { "groupEvent.start_date_time": 1, "groupEvent.item_type": 1, "groupEvent.group_code": 1 };
    const indexes = await extendedGroupEvent.collection.indexInformation();
    const oldIndexName = Object.keys(indexes).find(name => {
      const indexKeyObj = Object.fromEntries(indexes[name]);
      return JSON.stringify(indexKeyObj) === JSON.stringify(oldIndexKey);
    });

    if (oldIndexName) {
      await extendedGroupEvent.collection.dropIndex(oldIndexName);
      debugLog("recreateIndex: Dropped old index:", oldIndexName);
    } else {
      debugLog("recreateIndex: No old index found to drop");
    }

    await extendedGroupEvent.syncIndexes();
    debugLog("recreateIndex: New index synchronized successfully");
    res.json({ message: "Index recreated successfully" });
  } catch (error) {
    debugLog("recreateIndex error:", error);
    res.status(500).json({ error: error.message });
  }
}
