import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import kebabCase from "lodash/kebabCase";
import { extendedGroupEvent } from "../models/extended-group-event";
import * as crudController from "./crud-controller";
import { ExtendedGroupEvent } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { parseError } from "./transforms";

const controller = crudController.create<ExtendedGroupEvent>(extendedGroupEvent, true);
const debugLog = debug(envConfig.logNamespace("extended-group-event"));
debugLog.enabled = true;

export async function urlFromTitle(req: Request, res: Response) {
    const { title, id } = req.body as { title: string; id?: string };
    if (!title) {
      debugLog("generateTitleFromUrl: missing title");
      return res.json({ url: "" });
    }
    const {slug, document} = await findBySlug(title);

    if (!document) {
      debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "-> base slug available");
      return res.json({ url: slug });
    }

    if (id && document.id === id) {
      debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "id:", id, "-> slug owned by current event");
      return res.json({ url: slug });
    }

    let suffix = 1;
    let url;
    while (true) {
      url = `${slug}-${suffix++}`;
      const {document} = await findBySlug(url);
      if (!document || (document.id === id)) {
        debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "id:", id, "suffix:", suffix - 1, "-> using suffixed slug:", url);
        break;
      }
    }
    res.json({ url });
}

export async function findBySlug(slug: string): Promise<{ slug: string; document: ExtendedGroupEvent }> {
  const kebabCaseSlug = kebabCase(slug);
  const document = await controller.findOneDocument({
    criteria: {
      "groupEvent.url": {
        $regex: slug,
        $options: "i"
      }
    }
  });
  if (document || (kebabCaseSlug === slug)) {
    debugLog("findBySlug:slug", slug, "document:", document);
    return {slug, document};
  } else {
    debugLog("findBySlug:failed with provided slug", slug, "falling back to search by kebabCaseSlug:", kebabCaseSlug);
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
    debugLog("count: error:", error);
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
      debugLog(`queryWalkLeaderMemberIds: ${extendedGroupEvent.modelName} error: ${error}`);
      res.status(500).json({
        message: `${extendedGroupEvent.modelName} query failed`,
        request: req.query,
        error: parseError(error)
      });
    });
}
