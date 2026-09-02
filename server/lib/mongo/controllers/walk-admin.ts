import { Request, Response } from "express";
import { extendedGroupEvent } from "../models/extended-group-event";
import { socialEvent } from "../models/social-event";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import { deletedMember } from "../models/deleted-member";
import { EventField, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { CsvZipRequest, RamblersEventType } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import AdmZip from "adm-zip";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import {
  AgmStatsPeriod,
  AGMStatsRequest,
  AGMStatsResponse,
  EditableEventStats,
  EventStats,
  EventStatsRequest,
  ExtendedGroupEvent,
  MembershipAGMStats,
  SocialAGMStats,
  YearComparison
} from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { PipelineStage } from "mongoose";
import * as transforms from "./transforms";

import { isArray, isNumber } from "es-toolkit/compat";
import { sortBy } from "../../../../projects/ngx-ramblers/src/app/functions/arrays";
import { dateTimeFromIso, dateTimeFromMillis, dateTimeInTimezone } from "../../shared/dates";
import { systemConfig } from "../../config/system-config";
import { EventPopulation } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import * as crudController from "./crud-controller";

import { fetchMappedEvents } from "../../ramblers/list-events";
import { calculateExpenseStats } from "./agm-expense-stats";
import { expenseClaim } from "../models/expense-claim";
import { calculateWalkStats, totalMilesFromWalks } from "./walk-stats-agm";

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
            groupName: `$${GroupEventField.GROUP_NAME}`,
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
            groupName: "$_id.groupName",
            inputSource: "$_id.inputSource"
          },
          duplicateCount: { $sum: { $subtract: ["$count", 1] } }
        }
      }
    ];

    const duplicates = await extendedGroupEvent.aggregate(duplicatePipeline);
    const duplicateMap = new Map<string, number>();
    duplicates.forEach((d: any) => {
      const key = `${d._id.itemType}|${d._id.groupCode}|${d._id.groupName}|${d._id.inputSource}`;
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
      const key = `${stat.itemType}|${stat.groupCode}|${stat.groupName}|${stat.inputSource}`;
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

export async function csvZip(req: Request, res: Response) {
  try {
    const request: CsvZipRequest = req.body;
    const zip = new AdmZip();
    (request.files || []).forEach(file => zip.addFile(file.name, Buffer.from(file.content, "utf8")));
    debugLog("csvZip:", request.files?.length, "files zipped as", request.fileName);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${request.fileName || "export.zip"}"`);
    res.send(zip.toBuffer());
  } catch (error) {
    debugLog("csvZip error:", error);
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
    const {fromDate, toDate, periods} = req.body as AGMStatsRequest;
    debugLog("agmStats request:", {fromDate, toDate, periods});

    const earliestDate = await earliestDataDate();
    const requestedPeriods = statsPeriodsFromRequest(fromDate, toDate, periods);
    debugLog(`Periods: ${requestedPeriods.length}`);
    const yearlyStats: YearComparison[] = await requestedPeriods.reduce<Promise<YearComparison[]>>(
      async (promise, period) => {
        const acc = await promise;
        debugLog(`Period: from=${dateTimeFromMillis(period.fromDate).toISO()}, to=${dateTimeFromMillis(period.toDate).toISO()}`);
        const stats = await calculateYearStats(period.fromDate, period.toDate, dateTimeFromMillis(period.fromDate).year);
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

export { totalMilesFromWalks };

export function morningWalksCount(totalWalks: number, cancelledWalks: number, eveningWalks: number, unfilledSlots: number): number {
  const value = (totalWalks || 0) - (cancelledWalks || 0) - (eveningWalks || 0) - (unfilledSlots || 0);
  return value > 0 ? value : 0;
}

export function statsPeriodsFromRequest(fromDate: number, toDate: number, periods?: AgmStatsPeriod[]): AgmStatsPeriod[] {
  const explicit = (periods || []).filter(period => period?.fromDate > 0 && period?.toDate > 0);
  if (explicit.length) {
    return explicit;
  } else {
    const from = dateTimeFromMillis(fromDate);
    const to = dateTimeFromMillis(toDate);
    const rangeInYears = to.diff(from, "years").years;
    const numPeriods = Math.max(1, Math.round(rangeInYears || 1));
    return Array.from({length: numPeriods}, (_, index) => ({
      fromDate: (index === 0 ? from : from.plus({years: index})).toMillis(),
      toDate: (index === numPeriods - 1 ? to : from.plus({years: index + 1})).toMillis()
    }));
  }
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
