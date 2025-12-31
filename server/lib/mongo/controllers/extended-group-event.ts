import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { isEmpty, isString, kebabCase } from "es-toolkit/compat";
import { extendedGroupEvent } from "../models/extended-group-event";
import * as crudController from "./crud-controller";
import { EventSource, ExtendedGroupEvent } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  DocumentField,
  EventField,
  GroupEventField
} from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { parseError } from "./transforms";
import { dateTimeFromIso } from "../../shared/dates";
import { systemConfig } from "../../config/system-config";

const controller = crudController.create<ExtendedGroupEvent>(extendedGroupEvent, true);
const debugLog = debug(envConfig.logNamespace("extended-group-event"));
debugLog.enabled = true;
const LOCAL_ACTIVE_FILTER = {
  $or: [
    {[DocumentField.SOURCE]: {$ne: EventSource.LOCAL}},
    {[DocumentField.SOURCE]: EventSource.LOCAL, [GroupEventField.STATUS]: {$ne: "deleted"}}
  ]
};

function convertTitleToSlug(title: string) {
  if (title) {
    const stopwords = new Set(["a", "an", "the", "to", "by", "via", "in", "of", "from"]);
    return kebabCase(title).split("-").filter(item => !stopwords.has(item)).join("-");
  } else {
    return title;
  }
}

export async function urlFromTitle(req: Request, res: Response) {
  try {
    const {title, id} = req.body as { title: string; id?: string };
    if (!title) {
      debugLog("generateTitleFromUrl: missing title");
      return res.json({url: ""});
    }
    const kebabCaseSlug = convertTitleToSlug(title);
    const {slug, document} = await findBySlug(kebabCaseSlug);

    if (!document) {
      debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "-> base slug available");
      return res.json({url: slug});
    } else if (id && document.id === id) {
      debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "id:", id, "-> slug owned by current event");
      return res.json({url: slug});
    } else {
    let suffix = 0;
    let url;
    while (true) {
      url = `${slug}-${suffix++}`;
      const {document} = await findBySlug(url);
      if (!document || (document.id === id)) {
        debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "id:", id, "suffix:", suffix - 1, "-> using suffixed slug:", url);
        break;
      }
    }
    res.json({url});
    }
  } catch (error) {
    controller.errorDebugLog("urlFromTitle: error:", error);
    res.status(500).json({error: error.message});
  }
}

export async function findBySlug(slugOrTitle: string): Promise<{ slug: string; document: ExtendedGroupEvent }> {
  const kebabCaseSlug = convertTitleToSlug(slugOrTitle);
  const queriedSlug = identifierMatchesSlugFormat(slugOrTitle) ? slugOrTitle : kebabCaseSlug;
  const regex = slugRegexFor(queriedSlug);
  debugLog("findBySlug: requested:", slugOrTitle, "queriedSlug:", queriedSlug, "regex:", regex);
  const document = await controller.findOneDocument({
    criteria: {
      [GroupEventField.URL]: {
        $regex: regex
      }
    }
  });
  debugLog("findBySlug: result for queriedSlug:", queriedSlug, "document:", document?.groupEvent?.url, "id:", document?.id);
  if (document || (kebabCaseSlug === slugOrTitle)) {
    debugLog("findBySlug:queriedSlug", queriedSlug, "document:", document);
    return {slug: queriedSlug, document};
  } else {
    debugLog("findBySlug:failed with provided slug", slugOrTitle, "falling back to search by kebabCaseSlug:", kebabCaseSlug);
    return findBySlug(kebabCaseSlug);
  }
}

export async function count(req: Request, res: Response) {
  try {
    const criteria = req.query.criteria ? JSON.parse(req.query.criteria as string) : {};
    debugLog("count: criteria:", criteria);
    const count = await extendedGroupEvent.countDocuments(criteria);
    res.json({ count });
  } catch (error) {
    controller.errorDebugLog("count: error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function queryWalkLeaders(req: Request, res: Response) {
  try {
    debugLog("queryWalkLeaders: query params:", req.query);
    const filters: any[] = [
      {
        $or: [
          {
            [EventField.CONTACT_DETAILS_MEMBER_ID]: { $exists: true, $ne: null }
          },
          {
            [GroupEventField.WALK_LEADER_ID]: { $exists: true, $ne: null }
          },
          {
            [GroupEventField.WALK_LEADER_NAME]: { $exists: true, $nin: [null, ""] }
          }
        ]
      },
      LOCAL_ACTIVE_FILTER
    ];
    const parseDateValue = (value: string): string | undefined => {
      if (isEmpty(value)) {
        return undefined;
      }
      try {
        return dateTimeFromIso(value).toISO();
      } catch (error) {
        debugLog("queryWalkLeaders: failed to parse date:", value, error);
        return undefined;
      }
    };
    const dateFrom = parseDateValue(req.query.dateFrom as string);
    const dateTo = parseDateValue(req.query.dateTo as string);
    if (dateFrom) {
      filters.push({
        [GroupEventField.START_DATE]: {$gte: dateFrom}
      });
    }
    if (dateTo) {
      filters.push({
        [GroupEventField.START_DATE]: {$lte: dateTo}
      });
    }
    const matchStage = filters.length === 1 ? filters[0] : { $and: filters };


    function isMongoId(id: string): boolean {
      return isString(id) && /^[a-fA-F0-9]{24}$/.test(id);
    }

    function isValidMemberId(id: string, source: string): boolean {
      const hasValue = !isEmpty(id) && isString(id);
      const isLocalMongoId = isMongoId(id);
      const isPurelyNumeric = /^\d+$/.test(id);

      if (source === EventSource.LOCAL) {
        return hasValue && isLocalMongoId;
      } else {
        return hasValue && !isPurelyNumeric;
      }
    }

    const grouped = await extendedGroupEvent.aggregate([
      { $match: matchStage },
      {
        $project: {
          source: `$${DocumentField.SOURCE}`,
          groupCode: `$${GroupEventField.GROUP_CODE}`,
          groupName: `$${GroupEventField.GROUP_NAME}`,
          contactMemberId: `$${EventField.CONTACT_DETAILS_MEMBER_ID}`,
          contactDisplayName: `$${EventField.CONTACT_DETAILS_DISPLAY_NAME}`,
          contactId: `$${EventField.CONTACT_DETAILS_CONTACT_ID}`,
          walkLeaderId: `$${GroupEventField.WALK_LEADER_ID}`,
          walkLeaderName: `$${GroupEventField.WALK_LEADER_NAME}`,
          walkLeaderTelephone: "$groupEvent.walk_leader.telephone"
        }
      },
      {
        $group: {
          _id: null,
          contacts: {
            $push: {
              $cond: [
                { $and: [
                    {$ne: ["$contactMemberId", null]},
                    {$ne: ["$contactMemberId", ""]}
                ]},
                {
                  id: "$contactMemberId",
                  displayName: "$contactDisplayName",
                  source: "$source"
                },
                null
              ]
            }
          },
          walkLeaders: {
            $push: {
              $cond: [
                { $and: [
                    {$ne: ["$source", EventSource.LOCAL]},
                    { $or: [
                        { $and: [{$ne: ["$walkLeaderId", null]}, {$ne: ["$walkLeaderId", ""]}] },
                        { $and: [{$ne: ["$walkLeaderName", null]}, {$ne: ["$walkLeaderName", ""]}] }
                    ]}
                ]},
                {
                  id: {
                    $concat: [
                      { $ifNull: ["$groupCode", ""] },
                      "-",
                      {
                        $ifNull: [
                          { $cond: [{ $and: [{$ne: ["$walkLeaderId", null]}, {$ne: ["$walkLeaderId", ""]}] }, "$walkLeaderId", null] },
                          { $cond: [{ $and: [{$ne: ["$walkLeaderTelephone", null]}, {$ne: ["$walkLeaderTelephone", ""]}] }, "$walkLeaderTelephone", "$walkLeaderName"] }
                        ]
                      }
                    ]
                  },
                  displayName: "$walkLeaderName",
                  groupCode: "$groupCode",
                  groupName: "$groupName",
                  source: "$source"
                },
                null
              ]
            }
          }
        }
      },
      { $project: { allLeaders: { $concatArrays: ["$contacts", "$walkLeaders"] } } },
      { $unwind: "$allLeaders" },
      { $match: { "allLeaders.id": { $ne: null } } },
      {
        $group: {
          _id: "$allLeaders.id",
          displayNames: { $addToSet: "$allLeaders.displayName" },
          id: {$first: "$allLeaders.id"},
          source: {$first: "$allLeaders.source"},
          groupCode: {$first: "$allLeaders.groupCode"},
          groupName: {$first: "$allLeaders.groupName"}
        }
      }
    ]);
    debugLog("queryWalkLeaders: aggregation returned", grouped?.length || 0, "results");
    const filteredItems = (grouped || [])
      .filter(item => !isEmpty(item?._id) && isValidMemberId(item._id, item.source));

    const config = await systemConfig();
    const configuredGroupCode = config?.group?.groupCode || "";
    const isAreaMode = configuredGroupCode.length === 2;
    const hasMultipleGroups = configuredGroupCode.includes(",");
    const showGroupName = isAreaMode || hasMultipleGroups;
    debugLog("queryWalkLeaders: configuredGroupCode:", configuredGroupCode, "isAreaMode:", isAreaMode, "hasMultipleGroups:", hasMultipleGroups, "showGroupName:", showGroupName);

    function removeTrailingDot(name: string): string {
      return name.replace(/\.$/, "");
    }

    const leaderMap = new Map<string, { label: string; allLabels: string[]; source: string }>();
    filteredItems.forEach(item => {
      const labels = (item.displayNames || [])
        .map((name: string) => removeTrailingDot((name || "").trim()))
        .filter((name: string) => name.length > 0);

      if (labels.length === 0) {
        labels.push(item._id);
      }

      const sortedLabels: string[] = labels.sort((a: string, b: string) => b.length - a.length);
      let bestLabel = sortedLabels[0];
      const uniqueLabels: string[] = [...new Set(sortedLabels)];
      const finalId = item.source === EventSource.LOCAL ? item._id : kebabCase(item._id);

      if (showGroupName && item.source !== EventSource.LOCAL && item.groupName) {
        bestLabel = `${bestLabel} (${item.groupName})`;
      }

      leaderMap.set(finalId, {
        label: bestLabel,
        allLabels: uniqueLabels,
        source: item.source
      });
    });

    const leaders = Array.from(leaderMap.entries()).map(([id, data]) => ({
      id,
      label: data.label,
      allLabels: data.allLabels
    }));
    const leaderIds = leaders.map(item => item.id);
    debugLog("queryWalkLeaders: returning", leaderIds.length, "leader IDs:", leaderIds);
    return res.status(200).json({
      action: ApiAction.QUERY,
      response: leaderIds,
      labels: leaders
    });
  } catch (error) {
    controller.errorDebugLog(`queryWalkLeaderMemberIds: ${extendedGroupEvent.modelName} error: ${error}`);
    res.status(500).json({
      message: `${extendedGroupEvent.modelName} query failed`,
      request: req.query,
      error: parseError(error)
    });
  }
}

export async function dateRange(req: Request, res: Response) {
  try {
    const totalDocs = await extendedGroupEvent.countDocuments({});
    debugLog("dateRange: total documents in collection:", totalDocs);

    const [result] = await extendedGroupEvent.aggregate([
      {
        $group: {
          _id: null,
          minDate: { $min: `$${GroupEventField.START_DATE}` },
          maxDate: { $max: `$${GroupEventField.START_DATE}` }
        }
      }
    ]);
    debugLog("dateRange: aggregation result:", result);
    const minMillis = result?.minDate ? dateTimeFromIso(result.minDate).toMillis() : null;
    const maxMillis = result?.maxDate ? dateTimeFromIso(result.maxDate).toMillis() : null;
    debugLog("dateRange: returning minMillis:", minMillis, "maxMillis:", maxMillis);
    res.status(200).json({ minDate: minMillis, maxDate: maxMillis });
  } catch (error) {
    controller.errorDebugLog("dateRange error:", error);
    res.status(500).json({
      message: "Failed to fetch date range",
      error: parseError(error)
    });
  }
}

export function identifierMatchesSlugFormat(identifier: string): boolean {
  const trimmedIdentifier = (identifier || "").trim();
  const isMongoObjectId = /^[a-f\d]{24}$/i.test(trimmedIdentifier);
  const isNumeric = /^\d+$/.test(trimmedIdentifier);
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const looksLikeASlug = Boolean(trimmedIdentifier) && !isMongoObjectId && !isNumeric && slugPattern.test(trimmedIdentifier);
  debugLog("identifierMatchesSlugFormat:", identifier, "returning:", looksLikeASlug);
  return looksLikeASlug;
}

export function escapeSlugForRegex(slug: string): string {
  return (slug || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugRegexFor(identifier: string): RegExp {
  const escapedSlug = escapeSlugForRegex(identifier);
  return new RegExp(`(?:/)?${escapedSlug}$`, "i");
}

export function identifierCanBeConvertedToSlug(identifier: string): boolean {
  const trimmedIdentifier = (identifier || "").trim();
  if (!trimmedIdentifier) {
    return false;
  }
  const isMongoObjectId = /^[a-f\d]{24}$/i.test(trimmedIdentifier);
  const isNumeric = /^\d+$/.test(trimmedIdentifier);
  const canConvert = !isMongoObjectId && !isNumeric;
  debugLog("identifierCanBeConvertedToSlug:", identifier, "returning:", canConvert);
  return canConvert;
}
