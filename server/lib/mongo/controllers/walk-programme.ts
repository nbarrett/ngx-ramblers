import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { extendedGroupEvent } from "../models/extended-group-event";
import * as crudController from "./crud-controller";
import { EventSource, ExtendedGroupEvent, InputSource } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { DocumentField, EventType, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { ProgrammeOverviewStatus, ProgrammeStatusCounts, WalkProgrammeSummaryResponse } from "../../../../projects/ngx-ramblers/src/app/models/walk-programme.model";
import { dateTimeFromMillis, dateTimeNow } from "../../shared/dates";
import { parseError } from "./transforms";
import { LOCAL_ACTIVE_FILTER } from "./extended-group-event";

const controller = crudController.create<ExtendedGroupEvent>(extendedGroupEvent);
const debugLog = debug(envConfig.logNamespace("walk-programme"));
debugLog.enabled = false;

const STATUS_CHANGE_EVENT_TYPES: string[] = [
  EventType.AWAITING_LEADER,
  EventType.AWAITING_WALK_DETAILS,
  EventType.AWAITING_APPROVAL,
  EventType.APPROVED,
  EventType.DELETED
];

const IMPORTED_INPUT_SOURCES: string[] = [InputSource.WALKS_MANAGER_CACHE, InputSource.FILE_IMPORT];

const ALL_OVERVIEW_STATUSES: ProgrammeOverviewStatus[] = [
  ProgrammeOverviewStatus.AWAITING_LEADER,
  ProgrammeOverviewStatus.AWAITING_WALK_DETAILS,
  ProgrammeOverviewStatus.AWAITING_APPROVAL,
  ProgrammeOverviewStatus.APPROVED,
  ProgrammeOverviewStatus.DRAFT,
  ProgrammeOverviewStatus.PUBLISHED,
  ProgrammeOverviewStatus.CANCELLED
];

function isoFromMillis(value: number, fallbackDefault: number): string {
  const millis = Number.isFinite(value) ? value : fallbackDefault;
  return dateTimeFromMillis(millis).toISO();
}

function derivedStatusStages(): any[] {
  return [
    {
      $addFields: {
        __statusChangeEvents: {
          $filter: {
            input: {$ifNull: ["$events", []]},
            as: "event",
            cond: {$in: ["$$event.eventType", STATUS_CHANGE_EVENT_TYPES]}
          }
        },
        __publishedEvents: {
          $filter: {
            input: {$ifNull: ["$events", []]},
            as: "event",
            cond: {$eq: ["$$event.eventType", EventType.PUBLISHED_TO_RAMBLERS]}
          }
        }
      }
    },
    {
      $addFields: {
        __latestStatusChange: {
          $reduce: {
            input: "$__statusChangeEvents",
            initialValue: null,
            in: {
              $cond: [
                {$or: [{$eq: ["$$value", null]}, {$gt: ["$$this.date", "$$value.date"]}]},
                "$$this",
                "$$value"
              ]
            }
          }
        },
        __latestPublishedDate: {
          $reduce: {
            input: "$__publishedEvents",
            initialValue: null,
            in: {
              $cond: [
                {$or: [{$eq: ["$$value", null]}, {$gt: ["$$this.date", "$$value"]}]},
                "$$this.date",
                "$$value"
              ]
            }
          }
        }
      }
    },
    {
      $addFields: {
        __baseStatus: {
          $cond: [
            {$ne: ["$__latestStatusChange", null]},
            "$__latestStatusChange.eventType",
            {
              $cond: [
                {$in: [{$ifNull: ["$fields.inputSource", null]}, IMPORTED_INPUT_SOURCES]},
                EventType.APPROVED,
                EventType.AWAITING_WALK_DETAILS
              ]
            }
          ]
        },
        __isCancelled: {$eq: [{$toLower: {$ifNull: [`$${GroupEventField.STATUS}`, ""]}}, ProgrammeOverviewStatus.CANCELLED]},
        __isRamblersDraft: {$eq: [{$toLower: {$ifNull: [`$${GroupEventField.STATUS}`, ""]}}, ProgrammeOverviewStatus.DRAFT]},
        __isWalksManagerSourced: {$eq: [{$ifNull: [`$${DocumentField.SOURCE}`, null]}, EventSource.WALKS_MANAGER]},
        __hasRamblersPublicationIdentity: {
          $and: [
            {$gt: [{$strLenCP: {$trim: {input: {$ifNull: [`$${GroupEventField.ID}`, ""]}}}}, 0]},
            {
              $or: [
                {
                  $regexMatch: {
                    input: {$ifNull: [`$${GroupEventField.URL}`, ""]},
                    regex: "^https?://(?:www\\.)?ramblers\\.org\\.uk/",
                    options: "i"
                  }
                },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: {$ifNull: ["$fields.links", []]},
                          as: "link",
                          cond: {
                            $and: [
                              {$eq: ["$$link.source", "ramblers"]},
                              {$gt: [{$strLenCP: {$trim: {input: {$ifNull: ["$$link.href", ""]}}}}, 0]}
                            ]
                          }
                        }
                      }
                    },
                    0
                  ]
                }
              ]
            }
          ]
        },
        __publishedAfterStatus: {
          $and: [
            {$ne: ["$__latestPublishedDate", null]},
            {$or: [{$eq: ["$__latestStatusChange", null]}, {$gte: ["$__latestPublishedDate", "$__latestStatusChange.date"]}]}
          ]
        }
      }
    },
    {
      $addFields: {
        derivedStatus: {
          $switch: {
            branches: [
              {case: "$__isCancelled", then: ProgrammeOverviewStatus.CANCELLED},
              {case: {$or: ["$__publishedAfterStatus", "$__hasRamblersPublicationIdentity"]}, then: EventType.PUBLISHED_TO_RAMBLERS},
              {case: {$and: ["$__isWalksManagerSourced", "$__isRamblersDraft"]}, then: ProgrammeOverviewStatus.DRAFT},
              {case: "$__isWalksManagerSourced", then: EventType.PUBLISHED_TO_RAMBLERS}
            ],
            default: "$__baseStatus"
          }
        }
      }
    },
    {$match: {derivedStatus: {$ne: EventType.DELETED}}}
  ];
}

function summaryProjection(): any {
  return {
    _id: 0,
    id: {$toString: "$_id"},
    status: "$derivedStatus",
    startDateTime: `$${GroupEventField.START_DATE}`,
    title: {$ifNull: [`$${GroupEventField.TITLE}`, ""]},
    url: {$ifNull: [`$${GroupEventField.URL}`, ""]},
    distanceMiles: {$ifNull: [`$${GroupEventField.DISTANCE_MILES}`, null]},
    gradeCode: {$ifNull: ["$groupEvent.difficulty.code", ""]},
    gradeDescription: {$ifNull: ["$groupEvent.difficulty.description", ""]},
    shape: {$ifNull: [`$${GroupEventField.SHAPE}`, ""]},
    leaderName: {$ifNull: ["$fields.contactDetails.displayName", {$ifNull: [`$${GroupEventField.WALK_LEADER_NAME}`, ""]}]},
    leaderMemberId: {$ifNull: ["$fields.contactDetails.memberId", ""]},
    itemType: {$ifNull: [`$${GroupEventField.ITEM_TYPE}`, ""]},
    groupCode: {$ifNull: [`$${GroupEventField.GROUP_CODE}`, ""]},
    groupName: {$ifNull: [`$${GroupEventField.GROUP_NAME}`, ""]},
    thumbnailUrl: {
      $let: {
        vars: {firstStyle: {$arrayElemAt: [{$arrayElemAt: [`$${GroupEventField.MEDIA}.styles`, 0]}, 0]}},
        in: {$ifNull: ["$$firstStyle.url", ""]}
      }
    },
    hasLocation: {
      $or: [
        {$ne: [{$ifNull: [`$${GroupEventField.START_LOCATION_LATITUDE}`, null]}, null]},
        {$ne: [{$ifNull: [`$${GroupEventField.LOCATION_LATITUDE}`, null]}, null]}
      ]
    }
  };
}

function emptyCounts(): ProgrammeStatusCounts {
  return ALL_OVERVIEW_STATUSES.reduce((counts: ProgrammeStatusCounts, status: ProgrammeOverviewStatus) => {
    counts[status] = 0;
    return counts;
  }, {} as ProgrammeStatusCounts);
}

export async function programmeSummary(req: Request, res: Response) {
  try {
    const nowMillis = dateTimeNow().toMillis();
    const dateFrom = isoFromMillis(Number(req.query.dateFrom), nowMillis);
    const dateTo = isoFromMillis(Number(req.query.dateTo), nowMillis);
    const status = req.query.status as ProgrammeOverviewStatus | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 12);
    const sortDirection = req.query.sortDirection === "desc" ? -1 : 1;
    const matchStage = {
      $and: [
        {
          [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK,
          [GroupEventField.START_DATE]: {$gte: dateFrom, $lte: dateTo}
        },
        LOCAL_ACTIVE_FILTER
      ]
    };
    const statusMatch = status ? [{$match: {derivedStatus: status}}] : [];
    const pipeline: any[] = [
      {$match: matchStage},
      ...derivedStatusStages(),
      {
        $facet: {
          counts: [{$group: {_id: "$derivedStatus", count: {$sum: 1}}}],
          page: [
            ...statusMatch,
            {$sort: {[GroupEventField.START_DATE]: sortDirection}},
            {$skip: (page - 1) * limit},
            {$limit: limit},
            {$project: summaryProjection()}
          ],
          pageTotal: [...statusMatch, {$count: "total"}]
        }
      }
    ];
    debugLog("programmeSummary: dateFrom:", dateFrom, "dateTo:", dateTo, "status:", status, "page:", page, "limit:", limit);
    const [facetResult] = await extendedGroupEvent.aggregate(pipeline).allowDiskUse(true);
    const counts = (facetResult?.counts || []).reduce((accumulator: ProgrammeStatusCounts, entry: { _id: string; count: number }) => {
      if (entry?._id) {
        accumulator[entry._id] = entry.count;
      }
      return accumulator;
    }, emptyCounts());
    const total = facetResult?.pageTotal?.[0]?.total || 0;
    const response: WalkProgrammeSummaryResponse = {
      counts,
      response: facetResult?.page || [],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
    res.status(200).json(response);
  } catch (error) {
    controller.errorDebugLog("programmeSummary error:", error);
    res.status(500).json({message: "Failed to build walk programme summary", error: parseError(error)});
  }
}
