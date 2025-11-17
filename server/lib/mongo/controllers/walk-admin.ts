import { Request, Response } from "express";
import { extendedGroupEvent } from "../models/extended-group-event";
import { socialEvent } from "../models/social-event";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import { deletedMember } from "../models/deleted-member";
import { EventField, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import {
  AGMStatsRequest,
  AGMStatsResponse,
  EditableEventStats,
  EventStats,
  EventStatsRequest,
  ExpenseAGMStats,
  LeaderStats,
  MembershipAGMStats,
  SocialAGMStats,
  WalkAGMStats,
  YearComparison
} from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { PipelineStage } from "mongoose";
import { expenseClaim } from "../models/expense-claim";
import * as transforms from "./transforms";
import { clampMillisToEarliest, dateTimeFromMillis, dateTimeFromObject, dateTimeInTimezone } from "../../shared/dates";
import { DateTime } from "luxon";

const debugLog = debug(envConfig.logNamespace("walk-admin"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("walk-admin"));
errorDebugLog.enabled = true;
const controller = {errorDebugLog};

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
    const oldIndexFields = ["groupEvent.start_date_time", "groupEvent.item_type", "groupEvent.group_code"];
    const indexes = await extendedGroupEvent.collection.indexInformation();
    debugLog("recreateIndex: existing indexes:", JSON.stringify(indexes, null, 2));

    const oldIndexName = Object.keys(indexes).find(name => {
      const indexKeyObj = Object.fromEntries(indexes[name]);
      const indexFields = Object.keys(indexKeyObj).sort();
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
    const totalRange = toDate - fromDate;
    const rangeInYears = totalRange / (365.25 * 24 * 60 * 60 * 1000);
    const numPeriods = Math.max(1, Math.round(rangeInYears));
    const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;

    debugLog(`Range: ${rangeInYears.toFixed(2)} years, numPeriods: ${numPeriods}`);
    const yearlyStats: YearComparison[] = [];

    for (let i = 0; i < numPeriods; i++) {
      const periodFrom = i === 0 ? fromDate : fromDate + i * oneYearMs;
      const periodTo = i === numPeriods - 1 ? toDate : fromDate + (i + 1) * oneYearMs;
      const periodYear = dateTimeFromMillis(periodFrom).year;

      debugLog(`Period ${i + 1}: from=${dateTimeFromMillis(periodFrom).toISO()}, to=${dateTimeFromMillis(periodTo).toISO()}, year=${periodYear}`);

      const stats = await calculateYearStats(periodFrom, periodTo, periodYear);
      yearlyStats.push(stats);
    }

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

    debugLog("agmStats response:", response);
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

async function calculateWalkStats(fromDate: number, toDate: number): Promise<WalkAGMStats> {
  const walkPipeline: PipelineStage[] = [
    {
      $match: {
        [`${GroupEventField.START_DATE}`]: {
          $gte: dateTimeFromMillis(fromDate).toISO(),
          $lte: dateTimeFromMillis(toDate).toISO()
        }
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
                  $cond: [{$eq: [`$${GroupEventField.STATUS}`, "confirmed"]}, 1, 0]
                }
              },
              eveningWalks: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {$eq: [`$${GroupEventField.STATUS}`, "confirmed"]},
                        {
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
                            18
                          ]
                        }
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
              walksAwaitingLeader: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {$eq: [`$${GroupEventField.ITEM_TYPE}`, "group-walk"]},
                        {$lte: [{$toDate: `$${GroupEventField.START_DATE}`}, new Date()]},
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
                    {$eq: [`$${GroupEventField.STATUS}`, "confirmed"]},
                    {$ifNull: ["$groupEvent.distance_miles", 0]},
                    0
                  ]
                }
              },
              totalAttendees: {
                $sum: {
                  $cond: [
                    {$eq: [`$${GroupEventField.STATUS}`, "confirmed"]},
                    {$size: {$ifNull: ["$fields.attendees", []]}},
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
              [`${GroupEventField.STATUS}`]: "confirmed"
            }
          },
          {
          $group: {
            _id: {$ifNull: ["$fields.contactDetails.memberId", "$groupEvent.walk_leader.id", "$fields.contactDetails.email", "$groupEvent.walk_leader.name", "$fields.contactDetails.displayName"]},
            name: {$first: {$ifNull: ["$fields.contactDetails.displayName", "$groupEvent.walk_leader.name", "$groupEvent.walk_leader.id", "$fields.contactDetails.memberId", "Unknown"]}},
            email: {$first: {$ifNull: ["$fields.contactDetails.email", "$groupEvent.walk_leader.email", ""]}},
              walkCount: {$sum: 1},
              totalMiles: {
                $sum: {$ifNull: ["$groupEvent.distance_miles", 0]}
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
        [`${GroupEventField.STATUS}`]: "confirmed"
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

  const leaders: LeaderStats[] = (data.leaders || []).map((leader: any) => ({
    id: leader._id || "",
    name: leader.name || "",
    email: leader.email || "",
    walkCount: leader.walkCount || 0,
    totalMiles: Math.round(leader.totalMiles * 10) / 10
  }));

  const topLeader = leaders.length > 0 ? leaders[0] : {
    id: "",
    name: "None",
    email: "",
    walkCount: 0,
    totalMiles: 0
  };

  const previousYearFrom = fromDate - (365 * 24 * 60 * 60 * 1000);
  const previousYearTo = fromDate - 1;
  const previousYearLeaders = await getPreviousYearLeaders(previousYearFrom, previousYearTo);
  const newLeaderIds = new Set(leaders.map(l => l.id).filter(id => !previousYearLeaders.has(id)));

  return {
    totalWalks: totals.totalWalks,
    confirmedWalks: totals.confirmedWalks,
    cancelledWalks: totals.cancelledWalks,
    eveningWalks: totals.eveningWalks || 0,
    totalMiles: Math.round(totals.totalMiles * 10) / 10,
    totalAttendees: totals.totalAttendees,
    activeLeaders: leaders.length,
    newLeaders: newLeaderIds.size,
    topLeader,
    allLeaders: leaders,
    unfilledSlots: totals.walksAwaitingLeader || 0
  };
}

async function getPreviousYearLeaders(fromDate: number, toDate: number): Promise<Set<string>> {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        [`${GroupEventField.START_DATE}`]: {
          $gte: dateTimeFromMillis(fromDate).toISO(),
          $lte: dateTimeFromMillis(toDate).toISO()
        },
        [`${GroupEventField.STATUS}`]: "confirmed"
      }
    },
    {
      $group: {
        _id: {$ifNull: ["$fields.contactDetails.memberId", "$groupEvent.walk_leader.id"]}
      }
    }
  ];

  const result = await extendedGroupEvent.aggregate(pipeline);
  return new Set(result.map((r: any) => r._id).filter(id => id));
}

async function calculateSocialStats(fromDate: number, toDate: number): Promise<SocialAGMStats> {
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
              organiserName: {
                $ifNull: [
                  "$fields.contactDetails.displayName",
                  "$groupEvent.event_organiser.name",
                  "$fields.contactDetails.memberId"
                ]
              }
            }
          },
          {
            $sort: {date: 1}
          }
        ],
        organisers: [
          {
            $group: {
              _id: {
                $ifNull: [
                  "$fields.contactDetails.memberId",
                  "$groupEvent.event_organiser.id",
                  "$fields.contactDetails.displayName",
                  "$groupEvent.event_organiser.name"
                ]
              },
              name: {
                $first: {
                  $ifNull: [
                    "$fields.contactDetails.displayName",
                    "$groupEvent.event_organiser.name",
                    "$fields.contactDetails.memberId"
                  ]
                }
              },
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

  const socialsList = (data.events || []).map((event: any) => ({
    date: event.date,
    description: event.description || "Social event",
    link: event.link,
    linkTitle: event.linkTitle,
    organiserName: event.organiserName || "Unknown"
  }));

  const organisersList = (data.organisers || []).map((org: any) => ({
    id: org._id || "",
    name: org.name || "Unknown",
    eventCount: org.eventCount || 0
  }));

  return {
    totalSocials: socialsList.length,
    socialsList,
    uniqueOrganisers: organisersList.length,
    organisersList
  };
}

async function calculateExpenseStats(fromDate: number, toDate: number): Promise<ExpenseAGMStats> {
  debugLog(`calculateExpenseStats: fromDate=${dateTimeFromMillis(fromDate).toISO()}, toDate=${dateTimeFromMillis(toDate).toISO()}, fromMillis=${fromDate}, toMillis=${toDate}`);
  const expensePipeline: PipelineStage[] = [
    {
      $addFields: {
        expenseEvents: {$ifNull: ["$expenseEvents", []]},
        expenseItems: {$ifNull: ["$expenseItems", []]},
        paidEvents: {
          $filter: {
            input: {$ifNull: ["$expenseEvents", []]},
            as: "event",
            cond: {$eq: ["$$event.eventType.description", "Paid"]}
          }
        }
      }
    },
    {
      $addFields: {
        paidDate: {
          $ifNull: [
            {$first: "$paidEvents.date"},
            {$min: "$expenseItems.expenseDate"},
            toDate
          ]
        },
        createdBy: {
          $ifNull: [
            {$first: "$expenseEvents.memberId"},
            "unknown"
          ]
        },
        createdByName: {
          $ifNull: [
            {$first: "$expenseEvents.name"},
            {$first: "$expenseEvents.displayName"},
            "Unknown"
          ]
        }
      }
    },
    {
      $match: {
        paidDate: {
          $gte: fromDate,
          $lte: toDate
        }
      }
    },
    {
      $project: {
        paidDate: "$paidDate",
        createdBy: "$createdBy",
        createdByName: "$createdByName",
        expenseItems: "$expenseItems",
        costField: "$cost"
      }
    },
    {
      $addFields: {
        itemDetails: {
          $map: {
            input: {$ifNull: ["$expenseItems", []]},
            as: "item",
            in: {
              description: {$ifNull: ["$$item.description", "Expense item"]},
              cost: {$ifNull: ["$$item.cost", 0]},
              paidDate: "$paidDate"
            }
          }
        },
        itemCount: {
          $size: {
            $ifNull: ["$expenseItems", []]
          }
        },
        totalCost: {
          $sum: {
            $map: {
              input: {$ifNull: ["$expenseItems", []]},
              as: "item",
              in: {$ifNull: ["$$item.cost", 0]}
            }
          }
        }
      }
    },
    {
      $addFields: {
        totalCost: {
          $cond: [
            {$gt: ["$totalCost", 0]},
            "$totalCost",
            {$ifNull: ["$costField", 0]}
          ]
        }
      }
    },
    {
      $lookup: {
        from: "members",
        let: {memberId: "$createdBy"},
        pipeline: [
          {
            $match: {
              $expr: {$eq: ["$memberId", "$$memberId"]}
            }
          },
          {
            $project: {
              displayName: 1
            }
          }
        ],
        as: "claimant"
      }
    },
    {
      $addFields: {
        claimantName: {$ifNull: [{$first: "$claimant.displayName"}, "$createdByName", "Unknown"]}
      }
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalClaims: {$sum: 1},
              totalItems: {$sum: "$itemCount"},
              totalCost: {$sum: "$totalCost"}
            }
          }
        ],
        payees: [
          {
            $group: {
              _id: {$ifNull: ["$createdBy", "unknown"]},
              name: {$first: {$ifNull: ["$claimantName", "Unknown"]}},
              totalCost: {$sum: "$totalCost"},
              totalItems: {$sum: "$itemCount"},
              claimCount: {$sum: 1},
              items: {$push: "$itemDetails"}
            }
          },
          {
            $sort: {totalCost: -1}
          },
          {
            $addFields: {
              items: {
                $reduce: {
                  input: {$ifNull: ["$items", []]},
                  initialValue: [],
                  in: {$concatArrays: ["$$value", {$ifNull: ["$$this", []]}]}
                }
              }
            }
          }
        ]
      }
    }
  ];

  const result = await expenseClaim.aggregate(expensePipeline);
  const totals = result[0]?.totals[0] || {totalClaims: 0, totalItems: 0, totalCost: 0};
  const payees = result[0]?.payees || [];
  debugLog(`calculateExpenseStats: found ${totals.totalClaims} claims, ${totals.totalItems} items, £${totals.totalCost}, ${payees.length} payees`);

  return {
    totalClaims: totals.totalClaims || 0,
    totalItems: totals.totalItems || 0,
    totalCost: Math.round((totals.totalCost || 0) * 100) / 100,
    payees: payees.map((payer: any) => ({
      id: payer._id || "",
      name: payer.name || "Unknown",
      totalCost: Math.round((payer.totalCost || 0) * 100) / 100,
      totalItems: payer.totalItems || 0,
      claimCount: payer.claimCount || 0,
      items: (payer.items || []).map((item: any) => ({
        description: item.description || "Expense item",
        cost: Math.round((item.cost || 0) * 100) / 100,
        paidDate: item.paidDate || null
      }))
    }))
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
    leavers: leavers,
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
    if (typeof d === "number" && d > 0) {
      dates.push(d);
    }
  });

  if (!dates.length) {
    return null;
  }

  return Math.min(...dates);
}
