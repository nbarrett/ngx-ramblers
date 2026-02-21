import { Request, Response } from "express";
import { extendedGroupEvent } from "../models/extended-group-event";
import { socialEvent } from "../models/social-event";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import { deletedMember } from "../models/deleted-member";
import { EventField, GroupEventField, EventType, EventEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { RamblersEventType } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import {
  AGMStatsRequest,
  AGMStatsResponse,
  EditableEventStats,
  EventStats,
  EventStatsRequest,
  ExtendedGroupEvent,
  LeaderStats,
  MembershipAGMStats,
  SocialAGMStats,
  WalkAGMStats,
  YearComparison
} from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { PipelineStage } from "mongoose";
import * as transforms from "./transforms";
import { isArray, isNull, isNumber, isUndefined, kebabCase, keys } from "es-toolkit/compat";
import { sortBy } from "../../../../projects/ngx-ramblers/src/app/functions/arrays";
import { dateTimeFromIso, dateTimeFromMillis, dateTimeInTimezone, dateTimeNow, dateTimeNowAsValue } from "../../shared/dates";
import { systemConfig } from "../../config/system-config";
import { EventPopulation } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import * as crudController from "./crud-controller";
import { fetchMappedEvents } from "../../ramblers/list-events";
import { calculateExpenseStats } from "./agm-expense-stats";
import { expenseClaim } from "../models/expense-claim";
import { LocalWalkStatus } from "../models/walk-admin.model";

const debugLog = debug(envConfig.logNamespace("walk-admin"));
debugLog.enabled = false;
const controller = crudController.create<ExtendedGroupEvent>(extendedGroupEvent);
export async function eventStats(req: Request, res: Response) {
  try {
    const duplicatePipeline: PipelineStage[] = [
      {
        $match: {
          [GroupEventField.ID]: { $ne: null, $exists: true }
        }
      },
      {
        $group: {
          _id: {
            groupEventId: `$${GroupEventField.ID}`,
            itemType: `$${GroupEventField.ITEM_TYPE}`,
            groupCode: `$${GroupEventField.GROUP_CODE}`,
            inputSource: `$${EventField.INPUT_SOURCE}`
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $group: {
          _id: {
            itemType: "$_id.itemType",
            groupCode: "$_id.groupCode",
            inputSource: "$_id.inputSource"
          },
          duplicateCount: { $sum: { $subtract: ["$count", 1] } }
        }
      }
    ];

    const duplicates = await extendedGroupEvent.aggregate(duplicatePipeline);
    const duplicateMap = new Map<string, number>();
    duplicates.forEach((d: any) => {
      const key = `${d._id.itemType}|${d._id.groupCode}|${d._id.inputSource}`;
      duplicateMap.set(key, d.duplicateCount);
    });

    const pipeline: PipelineStage[] = [
      {
        $project: {
          itemType: `$${GroupEventField.ITEM_TYPE}`,
          groupCode: `$${GroupEventField.GROUP_CODE}`,
          groupName: `$${GroupEventField.GROUP_NAME}`,
          startDate: `$${GroupEventField.START_DATE}`,
          inputSource: `$${EventField.INPUT_SOURCE}`,
          lastSyncedAt: "$lastSyncedAt",
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
          lastSyncedAt: { $max: "$lastSyncedAt" },
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
          lastSyncedAt: 1,
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

    const stats = await extendedGroupEvent.aggregate<EventStats>(pipeline);
    const statsWithDuplicates = stats.map(stat => {
      const key = `${stat.itemType}|${stat.groupCode}|${stat.inputSource}`;
      return {
        ...stat,
        duplicateCount: duplicateMap.get(key) || 0
      };
    });
    debugLog("eventStats returned:", statsWithDuplicates);
    res.json(statsWithDuplicates);
  } catch (error) {
    debugLog("eventStats error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function bulkDeleteEvents(req: Request, res: Response) {
  try {
    const request = req.body as EventStatsRequest[];
    debugLog("bulkDeleteEvents: request:", request);
    if (!isArray(request)) {
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
    if (!isArray(updates)) {
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
    const oldIndexFields = [GroupEventField.START_DATE, GroupEventField.ITEM_TYPE, GroupEventField.GROUP_CODE];
    const indexes = await extendedGroupEvent.collection.indexInformation();
    debugLog("recreateIndex: existing indexes:", JSON.stringify(indexes, null, 2));

    const oldIndexName = keys(indexes).find(name => {
      const indexKeyObj = Object.fromEntries(indexes[name]);
      const indexFields = keys(indexKeyObj).sort();
      const hasExactlyTheseFields = indexFields.length === oldIndexFields.length &&
        oldIndexFields.every(field => indexKeyObj[field] === 1);
      debugLog(`recreateIndex: checking index ${name}:`, indexKeyObj, "matches old:", hasExactlyTheseFields);
      return hasExactlyTheseFields;
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

export async function earliestDate(req: Request, res: Response) {
  try {
    const earliest = await earliestDataDate();
    res.json({ earliestDate: earliest });
  } catch (error) {
    debugLog("earliestDate error:", error);
    res.status(500).json({
      message: "Failed to fetch earliest date",
      error: transforms.parseError(error)
    });
  }
}

export async function agmStats(req: Request, res: Response) {
  try {
    const {fromDate, toDate} = req.body as AGMStatsRequest;
    debugLog("agmStats request:", {fromDate, toDate});

    const earliestDate = await earliestDataDate();
    const from = dateTimeFromMillis(fromDate);
    const to = dateTimeFromMillis(toDate);
    const rangeInYears = to.diff(from, "years").years;
    const numPeriods = Math.max(1, Math.round(rangeInYears || 1));

    debugLog(`Range: ${rangeInYears.toFixed(4)} years, numPeriods: ${numPeriods}`);
    const yearlyStats: YearComparison[] = await Array.from({length: numPeriods}, (_, i) => i).reduce<Promise<YearComparison[]>>(
      async (promise, i) => {
        const acc = await promise;
        const periodFromDateTime = i === 0 ? from : from.plus({years: i});
        const periodToDateTime = i === numPeriods - 1 ? to : from.plus({years: i + 1});
        const periodFrom = periodFromDateTime.toMillis();
        const periodTo = periodToDateTime.toMillis();
        const periodYear = dateTimeFromMillis(periodFrom).year;
        debugLog(`Period ${i + 1}: from=${dateTimeFromMillis(periodFrom).toISO()}, to=${dateTimeFromMillis(periodTo).toISO()}, year=${periodYear}`);
        const stats = await calculateYearStats(periodFrom, periodTo, periodYear);
        return [...acc, stats];
      },
      Promise.resolve([])
    );

    if (yearlyStats.length === 0) {
      throw new Error("No yearly stats generated");
    }

    const currentYear = yearlyStats[yearlyStats.length - 1];
    const previousYear = yearlyStats.length >= 2 ? yearlyStats[yearlyStats.length - 2] : null;
    const twoYearsAgo = yearlyStats.length >= 3 ? yearlyStats[yearlyStats.length - 3] : null;

    const response: AGMStatsResponse = {
      currentYear,
      previousYear,
      twoYearsAgo,
      earliestDate,
      yearlyStats
    };

    debugLog("agmStats response:", JSON.stringify(response));
    res.json(response);
  } catch (error) {
    debugLog("agmStats error:", error);
    controller.errorDebugLog(`agmStats error: ${error}`);
    res.status(500).json({
      message: "AGM stats query failed",
      request: req.body,
      error: transforms.parseError(error),
      stack: error?.stack
    });
  }
}

async function calculateYearStats(fromDate: number, toDate: number, year: number): Promise<YearComparison> {
  const walkStats = await calculateWalkStats(fromDate, toDate);
  const socialStats = await calculateSocialStats(fromDate, toDate);
  const expenseStats = await calculateExpenseStats(fromDate, toDate);
  const membershipStats = await calculateMembershipStats(fromDate, toDate);

  return {
    year,
    periodFrom: fromDate,
    periodTo: toDate,
    walks: walkStats,
    socials: socialStats,
    expenses: expenseStats,
    membership: membershipStats
  };
}

export function morningWalksCount(totalWalks: number, cancelledWalks: number, eveningWalks: number, unfilledSlots: number): number {
  const value = (totalWalks || 0) - (cancelledWalks || 0) - (eveningWalks || 0) - (unfilledSlots || 0);
  return value > 0 ? value : 0;
}

async function calculateWalkStats(fromDate: number, toDate: number): Promise<WalkAGMStats> {
  const config = await systemConfig();
  const isWalksManager = config.group.walkPopulation === EventPopulation.WALKS_MANAGER;

  const leaderIdFields = isWalksManager
    ? [`$${GroupEventField.WALK_LEADER_NAME}`, `$${EventField.CONTACT_DETAILS_MEMBER_ID}`, `$${EventField.CONTACT_DETAILS_EMAIL}`, `$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`]
    : [`$${EventField.CONTACT_DETAILS_MEMBER_ID}`, `$${GroupEventField.WALK_LEADER_ID}`, `$${EventField.CONTACT_DETAILS_EMAIL}`, `$${GroupEventField.WALK_LEADER_NAME}`, `$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`];

  const leaderNameFields = isWalksManager
    ? [`$${GroupEventField.WALK_LEADER_NAME}`, `$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`, `$${EventField.CONTACT_DETAILS_MEMBER_ID}`, "Unknown"]
    : [`$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`, `$${GroupEventField.WALK_LEADER_NAME}`, `$${GroupEventField.WALK_LEADER_ID}`, `$${EventField.CONTACT_DETAILS_MEMBER_ID}`, "Unknown"];

  const leaderEmailFields = isWalksManager
    ? [`$${GroupEventField.WALK_LEADER_EMAIL}`, `$${EventField.CONTACT_DETAILS_EMAIL}`, ""]
    : [`$${EventField.CONTACT_DETAILS_EMAIL}`, `$${GroupEventField.WALK_LEADER_EMAIL}`, ""];

  const confirmedStatusMatch = isWalksManager
    ? {
        $or: [
          {[`${GroupEventField.STATUS}`]: "confirmed"},
          {[`${GroupEventField.STATUS}`]: {$exists: false}},
          {[`${GroupEventField.STATUS}`]: null},
          {[`${GroupEventField.STATUS}`]: ""},
          {[`${GroupEventField.STATUS}`]: {$nin: ["cancelled", "deleted"]}}
        ]
      }
    : {[`${GroupEventField.STATUS}`]: {$nin: ["cancelled", "deleted"]}};

  const confirmedStatusExpression = isWalksManager
    ? {
        $or: [
          {$eq: [`$${GroupEventField.STATUS}`, "confirmed"]},
          {$eq: [`$${GroupEventField.STATUS}`, null]},
          {$eq: [`$${GroupEventField.STATUS}`, ""]},
          {$not: [{$ifNull: [`$${GroupEventField.STATUS}`, false]}]},
          {$not: [{$in: [`$${GroupEventField.STATUS}`, ["cancelled", "deleted"]]}]}
        ]
      }
    : {$eq: [`$${GroupEventField.STATUS}`, "confirmed"]};

  const nonCancelledNonDeletedStatusMatch = {[`${GroupEventField.STATUS}`]: {$nin: ["cancelled", "deleted"]}};

  const eveningStatusExpression = isWalksManager
    ? confirmedStatusExpression
    : {
        $and: [
          {$ne: [`$${GroupEventField.STATUS}`, "cancelled"]},
          {$ne: [`$${GroupEventField.STATUS}`, "deleted"]}
        ]
      };

  const eveningHourExpression = {
    $gte: [
      {
        $toInt: {
          $dateToString: {
            format: "%H",
            date: {$toDate: `$${GroupEventField.START_DATE}`},
            timezone: "Europe/London"
          }
        }
      },
      15
    ]
  };

  const walkPipeline: PipelineStage[] = [
    {
      $match: {
        [`${GroupEventField.START_DATE}`]: {
          $gte: dateTimeFromMillis(fromDate).toISO(),
          $lte: dateTimeFromMillis(toDate).toISO()
        },
        [`${GroupEventField.ITEM_TYPE}`]: RamblersEventType.GROUP_WALK,
        [`${GroupEventField.STATUS}`]: {$ne: "deleted"}
      }
    },
    {
        $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalWalks: {$sum: 1},
              confirmedWalks: {
                $sum: {
                  $cond: [confirmedStatusExpression, 1, 0]
                }
              },
              eveningWalks: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        eveningStatusExpression,
                        eveningHourExpression
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              cancelledWalks: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        {$eq: [`$${GroupEventField.STATUS}`, "cancelled"]},
                        {$regexMatch: {input: {$ifNull: [`$${GroupEventField.TITLE}`, ""]}, regex: /cancelled/i}}
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              walksAwaitingLeader: isWalksManager
                ? {$sum: 0}
                : {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            {$eq: [`$${GroupEventField.ITEM_TYPE}`, RamblersEventType.GROUP_WALK]},
                            {$lte: [{$toDate: `$${GroupEventField.START_DATE}`}, dateTimeNow().toJSDate()]},
                            {
                              $or: [
                                {$eq: [`$${GroupEventField.STATUS}`, null]},
                                {$not: [{$in: [`$${GroupEventField.STATUS}`, ["confirmed", "cancelled", "deleted"]]}]}
                              ]
                            }
                          ]
                        },
                        1,
                        0
                      ]
                    }
                  },
              totalMiles: {
                $sum: {
                  $cond: [
                    confirmedStatusExpression,
                    {$ifNull: [`$${GroupEventField.DISTANCE_MILES}`, 0]},
                    0
                  ]
                }
              },
              totalAttendees: {
                $sum: {
                  $cond: [
                    confirmedStatusExpression,
                    {$size: {$ifNull: [`$${EventField.ATTENDEES}`, []]}},
                    0
                  ]
                }
              }
            }
          }
        ],
        leaders: [
          {
            $match: {
              ...confirmedStatusMatch
            }
          },
          {
            $addFields: {
              leaderId: {
                $reduce: {
                  input: leaderIdFields,
                  initialValue: "",
                  in: {
                    $cond: [
                      {
                        $and: [
                          {$eq: ["$$value", ""]},
                          {$ne: ["$$this", null]},
                          {$ne: ["$$this", ""]}
                        ]
                      },
                      "$$this",
                      "$$value"
                    ]
                  }
                }
              },
              leaderName: {
                $reduce: {
                  input: leaderNameFields,
                  initialValue: "",
                  in: {
                    $cond: [
                      {
                        $and: [
                          {$eq: ["$$value", ""]},
                          {$ne: ["$$this", null]},
                          {$ne: ["$$this", ""]}
                        ]
                      },
                      "$$this",
                      "$$value"
                    ]
                  }
                }
              },
              leaderEmail: {
                $reduce: {
                  input: leaderEmailFields,
                  initialValue: "",
                  in: {
                    $cond: [
                      {
                        $and: [
                          {$eq: ["$$value", ""]},
                          {$ne: ["$$this", null]},
                          {$ne: ["$$this", ""]}
                        ]
                      },
                      "$$this",
                      "$$value"
                    ]
                  }
                }
              }
            }
          },
          {
          $group: {
            _id: {$ifNull: ["$leaderId", ""]},
            name: {$first: {$ifNull: ["$leaderName", "Unknown"]}},
            email: {$first: {$ifNull: ["$leaderEmail", ""]}},
            walkCount: {$sum: 1},
            totalMiles: {
                $sum: {$ifNull: [`$${GroupEventField.DISTANCE_MILES}`, 0]}
              },
            firstWalkDate: {$min: `$${GroupEventField.START_DATE}`}
            }
          },
          {
            $sort: {walkCount: -1, totalMiles: -1}
          }
        ]
      }
    }
  ];

  const sampleBeforeAgg = await extendedGroupEvent.find({
    [`${GroupEventField.START_DATE}`]: {
      $gte: dateTimeFromMillis(fromDate).toISO(),
      $lte: dateTimeFromMillis(toDate).toISO()
    },
    ...confirmedStatusMatch
  }).limit(3).lean();

  debugLog(`Sample confirmed walks (${sampleBeforeAgg.length}):`, JSON.stringify(sampleBeforeAgg.map(w => ({
    title: w.groupEvent?.title,
    status: w.groupEvent?.status,
    walk_leader: w.groupEvent?.walk_leader,
    contactDetails: w.fields?.contactDetails
  })), null, 2));

  const result = await extendedGroupEvent.aggregate(walkPipeline);
  const data = result[0];

  const totals = data.totals[0] || {
    totalWalks: 0,
    confirmedWalks: 0,
    cancelledWalks: 0,
    eveningWalks: 0,
    walksAwaitingLeader: 0,
    totalMiles: 0,
    totalAttendees: 0
  };

  debugLog(`calculateWalkStats(${dateTimeFromMillis(fromDate).toISO()} to ${dateTimeFromMillis(toDate).toISO()}): eveningWalks=${totals.eveningWalks}, confirmedWalks=${totals.confirmedWalks}, totalWalks=${totals.totalWalks}`);

  const sampleWalks = await extendedGroupEvent.aggregate([
    {
      $match: {
        [`${GroupEventField.START_DATE}`]: {
          $gte: dateTimeFromMillis(fromDate).toISO(),
          $lte: dateTimeFromMillis(toDate).toISO()
        },
        ...confirmedStatusMatch
      }
    },
    {
      $limit: 5
    },
    {
      $project: {
        startDate: `$${GroupEventField.START_DATE}`,
        title: `$${GroupEventField.TITLE}`,
        extractedHour: {
          $toInt: {
            $dateToString: {
              format: "%H",
              date: {$toDate: `$${GroupEventField.START_DATE}`},
              timezone: "Europe/London"
            }
          }
        }
      }
    }
  ]);
  debugLog("Sample walks with extracted hours:", JSON.stringify(sampleWalks, null, 2));

  let leaders: LeaderStats[] = (data.leaders || []).map((leader: any) => ({
    id: leader._id || "",
    name: leader.name || "",
    email: leader.email || "",
    walkCount: leader.walkCount || 0,
    totalMiles: Math.round(leader.totalMiles * 10) / 10
  }));

  let remoteEvents: ExtendedGroupEvent[] = [];
  if (isWalksManager) {
    remoteEvents = await fetchMappedEvents(config, fromDate, toDate);
  }

  if (isWalksManager) {
    const leaderMap = new Map<string, {id: string; name: string; email: string; walkCount: number; totalMiles: number}>();
    const firstValue = (candidates: (string | null | undefined)[]) => {
      for (const value of candidates) {
        if (!isUndefined(value) && !isNull(value) && value !== "") {
          return value;
        }
      }
      return "";
    };

    const normalizeText = (value: string) => value ? value.trim().replace(/\.$/, "") : "";

    const addLeaderCount = (id: string, name: string, email: string, walkCount: number, miles: number) => {
      const normalizedId = normalizeText(id);
      const normalizedName = normalizeText(name);
      if (!normalizedId) {
        return;
      }
      const existing = leaderMap.get(normalizedId) || {id: normalizedId, name: normalizedName, email, walkCount: 0, totalMiles: 0};
      existing.walkCount += walkCount;
      existing.totalMiles += miles;
      if (!existing.name && normalizedName) {
        existing.name = normalizedName;
      }
      if (!existing.email && email) {
        existing.email = email;
      }
      leaderMap.set(normalizedId, existing);
    };

    leaders.forEach(leader => addLeaderCount(leader.id, leader.name, leader.email, leader.walkCount, leader.totalMiles));

    remoteEvents.forEach(event => {
      const status = event.groupEvent?.status;
      if ([ "cancelled", "deleted" ].includes(status || "")) {
        return;
      }
      const id = firstValue([
        event.groupEvent?.walk_leader?.name,
        event.groupEvent?.walk_leader?.telephone,
        event.groupEvent?.walk_leader?.email_form,
        event.fields?.contactDetails?.memberId,
        event.fields?.contactDetails?.displayName
      ]);
      if (!id) {
        return;
      }
      const name = firstValue([
        event.groupEvent?.walk_leader?.name,
        event.fields?.contactDetails?.displayName,
        event.fields?.contactDetails?.memberId
      ]) || "Unknown";
      const email = firstValue([
        event.fields?.contactDetails?.email
      ]);
      addLeaderCount(id, name, email, 1, event.groupEvent?.distance_miles || 0);
    });

    leaders = Array.from(leaderMap.values()).map(leader => ({
      ...leader,
      totalMiles: Math.round(leader.totalMiles * 10) / 10
    })).sort((a, b) => {
      if (b.walkCount !== a.walkCount) {
        return b.walkCount - a.walkCount;
      }
      return b.totalMiles - a.totalMiles;
    });
  }

  const topLeader = leaders.length > 0 ? leaders[0] : {
    id: "",
    name: "None",
    email: "",
    walkCount: 0,
    totalMiles: 0
  };

  const historicalLeaders = await allHistoricalLeaders(fromDate);
  const newLeaderIds = new Set(leaders.map(l => l.id).filter(id => id && !historicalLeaders.has(id)));
  const newLeadersList = leaders.filter(leader => newLeaderIds.has(leader.id));

  const cancelledWalksList = await extendedGroupEvent.find({
    [`${GroupEventField.START_DATE}`]: {
      $gte: dateTimeFromMillis(fromDate).toISO(),
      $lte: dateTimeFromMillis(toDate).toISO()
    },
    $or: [
      {[`${GroupEventField.STATUS}`]: "cancelled"},
      {[`${GroupEventField.TITLE}`]: {$regex: /cancelled/i}}
    ]
  }).sort({[`${GroupEventField.START_DATE}`]: 1}).lean();

  const eveningWalksListFromDb = await extendedGroupEvent.aggregate([
    {
      $match: {
        [`${GroupEventField.START_DATE}`]: {
          $gte: dateTimeFromMillis(fromDate).toISO(),
          $lte: dateTimeFromMillis(toDate).toISO()
        },
        [`${GroupEventField.ITEM_TYPE}`]: RamblersEventType.GROUP_WALK,
        ...(isWalksManager ? confirmedStatusMatch : nonCancelledNonDeletedStatusMatch)
      }
    },
    {
      $match: {
        $expr: {
          $and: [eveningHourExpression]
        }
      }
    },
    {$sort: {[`${GroupEventField.START_DATE}`]: 1}}
  ]);

  const eveningWalksListFromRamblers = isWalksManager ? remoteEvents.filter(event => {
    const status = event.groupEvent?.status;
    if ([ "cancelled", "deleted" ].includes(status || "")) {
      return false;
    }
    if (event.groupEvent?.item_type !== RamblersEventType.GROUP_WALK) {
      return false;
    }
    const start = event.groupEvent?.start_date_time;
    if (!start) {
      return false;
    }
    const startDate = dateTimeFromIso(start);
    return startDate.toMillis() >= fromDate && startDate.toMillis() <= toDate && startDate.hour >= 15;
  }).sort((a, b) => dateTimeFromIso(a.groupEvent?.start_date_time || "").toMillis() - dateTimeFromIso(b.groupEvent?.start_date_time || "").toMillis()) : [];

  const allWalksForStats = isWalksManager ? [] : await extendedGroupEvent.find({
    [`${GroupEventField.ITEM_TYPE}`]: RamblersEventType.GROUP_WALK,
    [`${GroupEventField.START_DATE}`]: {
      $gte: dateTimeFromMillis(fromDate).toISO(),
      $lte: dateTimeFromMillis(toDate).toISO()
    },
    [`${GroupEventField.STATUS}`]: {$ne: "deleted"}
  }).sort({[`${GroupEventField.START_DATE}`]: 1}).lean();

  const eveningWalksList = isWalksManager
    ? [...eveningWalksListFromRamblers]
    : eveningWalksListFromDb;

  const unfilledSlotsList = isWalksManager ? [] : await extendedGroupEvent.find({
    [`${GroupEventField.ITEM_TYPE}`]: RamblersEventType.GROUP_WALK,
    [`${GroupEventField.START_DATE}`]: {
      $gte: dateTimeFromMillis(fromDate).toISO(),
      $lte: dateTimeNow().toISO()
    },
    $or: [
      {[`${EventField.CONTACT_DETAILS_MEMBER_ID}`]: null},
      {[`${EventField.CONTACT_DETAILS_MEMBER_ID}`]: {$exists: false}},
      {[`${EventField.CONTACT_DETAILS_MEMBER_ID}`]: ""},
      {[`${GroupEventField.TITLE}`]: null},
      {[`${GroupEventField.TITLE}`]: {$exists: false}},
      {[`${GroupEventField.TITLE}`]: ""}
    ]
  }).sort({[`${GroupEventField.START_DATE}`]: 1}).lean();

  const formatWalkListItem = (walk: any) => {
    const walkId = walk._id?.toString() || walk.groupEvent?.id || "";
    const title = walk.groupEvent?.title || "";
    const startDate = walk.groupEvent?.start_date_time;
    const dateStr = startDate ? dateTimeFromIso(startDate).toFormat("yyyy-MM-dd") : "";
    const urlSlug = walk.groupEvent?.url
      || kebabCase([title, dateStr].filter(Boolean).join("-"))
      || walk.groupEvent?.id
      || walkId;
    const lastSegment = urlSlug.split("/").pop() || urlSlug;
    const walkLeaderFromManager = walk.groupEvent?.walk_leader?.name;
    const walkLeaderFromFields = walk.fields?.contactDetails?.displayName;
    const walkLeader = isWalksManager
      ? walkLeaderFromManager || walkLeaderFromFields || ""
      : walkLeaderFromFields || walkLeaderFromManager || "";

    return {
      id: walkId,
      title,
      startDate: dateTimeFromIso(startDate).toMillis(),
      walkDate: startDate || "",
      walkLeader,
      distance: walk.groupEvent?.distance_miles || 0,
      url: `/walks/${lastSegment}`
    };
  };

  const eveningWalksCount = isWalksManager ? eveningWalksList.length : (totals.eveningWalks || 0);
  const unfilledCount = isWalksManager ? 0 : unfilledSlotsList.length;
  const morningWalks = morningWalksCount(totals.totalWalks, totals.cancelledWalks, eveningWalksCount, unfilledCount);
  const idForWalk = (walk: any) => walk._id?.toString() || walk.groupEvent?.id || "";

  const localMorningWalks: any[] = [];
  const localEveningWalks: any[] = [];
  const localCancelledWalks: any[] = [];
  const localUnfilledWalks: any[] = [];

  const classifyLocalWalk = (walk: any): LocalWalkStatus => {
    const events: any[] = isArray(walk.events) ? walk.events : [];
    const hasDeletedEvent = events.some(event => event?.eventType === EventType.DELETED);
    if (hasDeletedEvent) {
      return LocalWalkStatus.DELETED;
    }
    const title = (walk.groupEvent?.title || "") as string;
    const status = walk.groupEvent?.status as string | undefined;
    const memberId = walk.fields?.contactDetails?.memberId as string | undefined;
    const leaderMissing = !memberId;
    const titleMissing = !title;

    const start = walk.groupEvent?.start_date_time as string | undefined;

    const cancelledByStatus = status === "cancelled";
    const cancelledByTitle = /cancelled/i.test(title);
    const cancelled = cancelledByStatus || cancelledByTitle;

    if (cancelled) {
      return LocalWalkStatus.CANCELLED;
    }

    if (!start) {
      return LocalWalkStatus.UNFILLED;
    }

    const dt = dateTimeFromIso(start);
    const nowMillis = dateTimeNowAsValue();
    const pastOrToday = dt.toMillis() <= nowMillis;

    if (pastOrToday && (leaderMissing || titleMissing)) {
      return LocalWalkStatus.UNFILLED;
    }

    if (dt.hour >= 15) {
      return LocalWalkStatus.EVENING;
    }

    return LocalWalkStatus.MORNING;
  };

  if (!isWalksManager) {
    for (const walk of allWalksForStats) {
      const bucket = classifyLocalWalk(walk);
      if (bucket === LocalWalkStatus.DELETED) {
        continue;
      }
      if (bucket === LocalWalkStatus.UNFILLED) {
        localUnfilledWalks.push(walk);
      } else if (bucket === LocalWalkStatus.CANCELLED) {
        localCancelledWalks.push(walk);
      } else if (bucket === LocalWalkStatus.EVENING) {
        localEveningWalks.push(walk);
      } else {
        localMorningWalks.push(walk);
      }
    }

    debugLog("localWalkBuckets", {
      totalWalks: totals.totalWalks,
      allWalksForStats: allWalksForStats.length,
      morning: localMorningWalks.length,
      evening: localEveningWalks.length,
      cancelled: localCancelledWalks.length,
      unfilled: localUnfilledWalks.length,
      sum: localMorningWalks.length + localEveningWalks.length + localCancelledWalks.length + localUnfilledWalks.length
    });
  }

  const totalWalksFinal = isWalksManager
    ? totals.totalWalks
    : localMorningWalks.length + localEveningWalks.length + localCancelledWalks.length + localUnfilledWalks.length;

  const morningWalksFinal = isWalksManager ? morningWalks : localMorningWalks.length;
  const cancelledWalksFinal = isWalksManager ? totals.cancelledWalks : localCancelledWalks.length;
  const eveningWalksFinal = isWalksManager ? eveningWalksCount : localEveningWalks.length;
  const unfilledSlotsFinal = isWalksManager ? unfilledCount : localUnfilledWalks.length;

  const cancelledWalksListFinal = isWalksManager
    ? cancelledWalksList.map(formatWalkListItem)
    : localCancelledWalks.map(formatWalkListItem);

  const eveningWalksListFinal = isWalksManager
    ? eveningWalksList.map(formatWalkListItem)
    : localEveningWalks.map(formatWalkListItem);

  const unfilledSlotsListFinal = isWalksManager
    ? unfilledSlotsList.map(formatWalkListItem)
    : localUnfilledWalks.map(formatWalkListItem);

  const morningWalksListFinal = isWalksManager
    ? []
    : localMorningWalks.map(formatWalkListItem);

  return {
    totalWalks: totalWalksFinal,
    confirmedWalks: totals.confirmedWalks,
    morningWalks: morningWalksFinal,
    cancelledWalks: cancelledWalksFinal,
    cancelledWalksList: cancelledWalksListFinal,
    eveningWalks: eveningWalksFinal,
    eveningWalksList: eveningWalksListFinal,
    totalMiles: Math.round(totals.totalMiles * 10) / 10,
    totalAttendees: totals.totalAttendees,
    activeLeaders: leaders.length,
    newLeaders: newLeaderIds.size,
    newLeadersList,
    topLeader,
    allLeaders: leaders,
    unfilledSlots: unfilledSlotsFinal,
    unfilledSlotsList: unfilledSlotsListFinal,
    morningWalksList: morningWalksListFinal
  };
}

async function allHistoricalLeaders(beforeDate: number): Promise<Set<string>> {
  const config = await systemConfig();
  const isWalksManager = config.group.walkPopulation === EventPopulation.WALKS_MANAGER;

  const leaderIdFields = isWalksManager
    ? [`$${GroupEventField.WALK_LEADER_NAME}`, `$${EventField.CONTACT_DETAILS_MEMBER_ID}`]
    : [`$${EventField.CONTACT_DETAILS_MEMBER_ID}`, `$${GroupEventField.WALK_LEADER_ID}`];

  const confirmedStatusMatch = isWalksManager
    ? {
        $or: [
          {[`${GroupEventField.STATUS}`]: "confirmed"},
          {[`${GroupEventField.STATUS}`]: {$exists: false}},
          {[`${GroupEventField.STATUS}`]: null},
          {[`${GroupEventField.STATUS}`]: ""}
        ]
      }
    : {[`${GroupEventField.STATUS}`]: "confirmed"};

  const pipeline: PipelineStage[] = [
    {
      $match: {
        [`${GroupEventField.START_DATE}`]: {
          $lt: dateTimeFromMillis(beforeDate).toISO()
        },
        ...confirmedStatusMatch
      }
    },
    {
      $addFields: {
        leaderId: {
          $reduce: {
            input: leaderIdFields,
            initialValue: "",
            in: {
              $cond: [
                {
                  $and: [
                    {$eq: ["$$value", ""]},
                    {$ne: ["$$this", null]},
                    {$ne: ["$$this", ""]}
                  ]
                },
                "$$this",
                "$$value"
              ]
            }
          }
        }
      }
    },
    {
      $group: {
        _id: {$ifNull: ["$leaderId", ""]}
      }
    }
  ];

  const result = await extendedGroupEvent.aggregate(pipeline);
  return new Set(result.map((r: any) => r._id).filter(id => id));
}

async function calculateSocialStats(fromDate: number, toDate: number): Promise<SocialAGMStats> {
  const config = await systemConfig();
  const isSocialsWalksManager = config.group.socialEventPopulation === EventPopulation.WALKS_MANAGER;

  debugLog(`calculateSocialStats: isSocialsWalksManager=${isSocialsWalksManager}, fromDate=${dateTimeFromMillis(fromDate).toISO()}, toDate=${dateTimeFromMillis(toDate).toISO()}`);

  const organiserNameFields = isSocialsWalksManager
    ? [`$${GroupEventField.EVENT_ORGANISER_NAME}`, `$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`, `$${EventField.CONTACT_DETAILS_MEMBER_ID}`]
    : [`$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`, `$${GroupEventField.EVENT_ORGANISER_NAME}`, `$${EventField.CONTACT_DETAILS_MEMBER_ID}`];

  const organiserIdFields = isSocialsWalksManager
    ? [`$${GroupEventField.EVENT_ORGANISER_NAME}`, `$${EventField.CONTACT_DETAILS_MEMBER_ID}`, `$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`]
    : [`$${EventField.CONTACT_DETAILS_MEMBER_ID}`, `$${GroupEventField.EVENT_ORGANISER_ID}`, `$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`, `$${GroupEventField.EVENT_ORGANISER_NAME}`];

  const socialPipeline: PipelineStage[] = [
    {
      $match: {
        [`${GroupEventField.ITEM_TYPE}`]: "group-event",
        [`${GroupEventField.START_DATE}`]: {
          $gte: dateTimeFromMillis(fromDate).toISO(),
          $lte: dateTimeFromMillis(toDate).toISO()
        }
      }
    },
    {
      $facet: {
        events: [
          {
            $project: {
              date: `$${GroupEventField.START_DATE}`,
              description: {$ifNull: [`$${GroupEventField.TITLE}`, `$${GroupEventField.DESCRIPTION}`]},
              link: `$${GroupEventField.EXTERNAL_URL}`,
              linkTitle: {$ifNull: [`$${GroupEventField.TITLE}`, `$${GroupEventField.DESCRIPTION}`]},
              organiserName: {$ifNull: organiserNameFields}
            }
          },
          {
            $sort: {date: 1}
          }
        ],
        organisers: [
          {
            $group: {
              _id: {$ifNull: organiserIdFields},
              name: {$first: {$ifNull: organiserNameFields}},
              eventCount: {$sum: 1}
            }
          },
          {
            $sort: {eventCount: -1}
          }
        ]
      }
    }
  ];

  const result = await extendedGroupEvent.aggregate(socialPipeline);
  const data = result[0];

  let socialsList = (data.events || []).map((event: any) => ({
    date: event.date,
    description: event.description || "Social event",
    link: event.link,
    linkTitle: event.linkTitle,
    organiserName: event.organiserName || "Unknown"
  }));

  let organisersList = (data.organisers || []).map((org: any) => ({
    id: org._id || "",
    name: org.name || "Unknown",
    eventCount: org.eventCount || 0
  }));

  if (isSocialsWalksManager) {
    const remoteEvents = await fetchMappedEvents(config, fromDate, toDate);
    debugLog(`calculateSocialStats: fetchMappedEvents returned ${remoteEvents.length} events`);

    const socials = remoteEvents.filter(event => {
      if (event.groupEvent?.item_type !== RamblersEventType.GROUP_EVENT) {
        return false;
      }
      const start = event.groupEvent?.start_date_time;
      if (!start) {
        return false;
      }
      const startMillis = dateTimeFromIso(start).toMillis();
      return startMillis >= fromDate && startMillis <= toDate;
    });

    debugLog(`calculateSocialStats: filtered to ${socials.length} social events`);

    socials.forEach(event => {
      debugLog(`calculateSocialStats: RAW EVENT - title="${event.groupEvent?.title}", event_organiser=${JSON.stringify(event.groupEvent?.event_organiser)}, contactDetails=${JSON.stringify(event.fields?.contactDetails)}`);
    });

    socialsList = socials.map(event => {
      const organiserName = event.groupEvent?.event_organiser?.name
        || event.fields?.contactDetails?.displayName
        || "Unknown";

      debugLog(`calculateSocialStats: event="${event.groupEvent?.title}", event_organiser.name="${event.groupEvent?.event_organiser?.name}", contactDetails.displayName="${event.fields?.contactDetails?.displayName}", final organiserName="${organiserName}"`);

      return {
        date: event.groupEvent?.start_date_time,
        description: event.groupEvent?.title || "Social event",
        link: event.groupEvent?.external_url || event.groupEvent?.url,
        linkTitle: event.groupEvent?.title,
        organiserName
      };
    });
    socialsList = socialsList.sort(sortBy("date"));

    const organiserMap = new Map<string, { id: string; name: string; eventCount: number }>();
    socials.forEach(event => {
      const name = event.groupEvent?.event_organiser?.name
        || event.fields?.contactDetails?.displayName
        || "";
      const id = name || "";
      if (!id) {
        debugLog(`calculateSocialStats: skipping event with no organiser id/name - event="${event.groupEvent?.title}"`);
        return;
      }
      const existing = organiserMap.get(id) || {id, name, eventCount: 0};
      existing.eventCount += 1;
      organiserMap.set(id, existing);
    });

    organisersList = Array.from(organiserMap.values()).sort(sortBy("-eventCount", "name"));
    debugLog(`calculateSocialStats: organisersList has ${organisersList.length} organisers:`, organisersList);
  }

  debugLog(`calculateSocialStats: returning ${socialsList.length} socials and ${organisersList.length} organisers`);

  return {
    totalSocials: socialsList.length,
    socialsList,
    uniqueOrganisers: organisersList.length,
    organisersList
  };
}

async function calculateMembershipStats(fromDate: number, toDate: number): Promise<MembershipAGMStats> {
  debugLog(`calculateMembershipStats: fromDate=${dateTimeFromMillis(fromDate).toISO()}, toDate=${dateTimeFromMillis(toDate).toISO()}`);

  const startSnapshot = await memberBulkLoadAudit.findOne({
    createdDate: {$lte: fromDate}
  }).sort({createdDate: -1});

  const endSnapshot = await memberBulkLoadAudit.findOne({
    createdDate: {$lte: toDate}
  }).sort({createdDate: -1});

  const startMembers = new Set((startSnapshot?.members || []).map(m => m.membershipNumber || m.email));
  const endMembers = new Set((endSnapshot?.members || []).map(m => m.membershipNumber || m.email));

  const totalMembers = endMembers.size;

  const joiners = [...endMembers].filter(m => !startMembers.has(m)).length;

  const leavers = [...startMembers].filter(m => !endMembers.has(m)).length;

  const deletionsInPeriod = await deletedMember.countDocuments({
    deletedAt: {
      $gte: fromDate,
      $lte: toDate
    }
  });

  debugLog(`Membership stats: total=${totalMembers}, joiners=${joiners}, leavers=${leavers}, deletions=${deletionsInPeriod}`);

  return {
    totalMembers,
    newJoiners: joiners,
    leavers,
    deletions: deletionsInPeriod
  };
}

async function earliestDataDate(): Promise<number | null> {
  const [walks, socials, expenses] = await Promise.all([
    extendedGroupEvent.aggregate([
      {
        $group: {
          _id: null,
          minDate: {$min: `$${GroupEventField.START_DATE}`}
        }
      }
    ]),
    socialEvent.aggregate([
      {
        $group: {
          _id: null,
          minDate: {$min: "$eventDate"}
        }
      }
    ]),
    expenseClaim.aggregate([
      {
        $project: {
          paidEvents: {
            $filter: {
              input: {$ifNull: ["$expenseEvents", []]},
              as: "event",
              cond: {$eq: ["$$event.eventType.description", "Paid"]}
            }
          }
        }
      },
      {$unwind: {path: "$paidEvents", preserveNullAndEmptyArrays: false}},
      {
        $group: {
          _id: null,
          minDate: {$min: "$paidEvents.date"}
        }
      }
    ])
  ]);

  const dates: number[] = [];
  const walkDate = walks?.[0]?.minDate ? dateTimeInTimezone(walks[0].minDate).toMillis() : null;
  const socialDate = socials?.[0]?.minDate || null;
  const expenseDate = expenses?.[0]?.minDate || null;

  [walkDate, socialDate, expenseDate].forEach(d => {
    if (isNumber(d) && d > 0) {
      dates.push(d);
    }
  });

  if (!dates.length) {
    return null;
  }

  return Math.min(...dates);
}
