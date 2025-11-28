import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { kebabCase } from "es-toolkit/compat";
import { extendedGroupEvent } from "../models/extended-group-event";
import * as crudController from "./crud-controller";
import { ExtendedGroupEvent } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { parseError } from "./transforms";

const controller = crudController.create<ExtendedGroupEvent>(extendedGroupEvent, true);
const debugLog = debug(envConfig.logNamespace("extended-group-event"));
debugLog.enabled = false;

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
  const queriedSlug = identifierLooksLikeASlug(slugOrTitle) ? slugOrTitle : kebabCaseSlug;
  const escapedSlug = queriedSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  debugLog("findBySlug: requested:", slugOrTitle, "queriedSlug:", queriedSlug, "escapedSlug:", escapedSlug);
  const document = await controller.findOneDocument({
    criteria: {
      "groupEvent.url": {
        $regex: `^${escapedSlug}$`,
        $options: "i"
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

export function queryWalkLeaders(req: Request, res: Response): Promise<any> {
  return extendedGroupEvent.distinct("fields.contactDetails.memberId")
    .then((response: string[]) => {
      debugLog(req.query, "queryWalkLeaderMemberIds:response", response);
      return res.status(200).json({
        action: ApiAction.QUERY,
        response
      });
    })
    .catch(error => {
      controller.errorDebugLog(`queryWalkLeaderMemberIds: ${extendedGroupEvent.modelName} error: ${error}`);
      res.status(500).json({
        message: `${extendedGroupEvent.modelName} query failed`,
        request: req.query,
        error: parseError(error)
      });
    });
}

export function identifierLooksLikeASlug(identifier: string): boolean {
  const looksLikeASlug = /[\s-]/.test(identifier);
  debugLog("identifierLooksLikeASlug:", identifier, "returning:", looksLikeASlug);
  return looksLikeASlug;
}
