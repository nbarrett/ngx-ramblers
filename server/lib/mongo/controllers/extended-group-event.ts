import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import kebabCase from "lodash/kebabCase";
import { extendedGroupEvent } from "../models/extended-group-event";

const debugLog = debug(envConfig.logNamespace("extended-group-event"));
debugLog.enabled = true;

export function urlFromTitle() {
  return async (req: Request, res: Response) => {
    const { title, id } = req.body as { title: string; id?: string };
    if (!title) {
      debugLog("generateTitleFromUrl: missing title");
      return res.json({ url: "" });
    }

    const slug = kebabCase(title);
    const existing = await extendedGroupEvent.findOne({ "groupEvent.url": slug });

    if (!existing) {
      debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "-> base slug available");
      return res.json({ url: slug });
    }

    if (id && existing._id.equals(id)) {
      debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "id:", id, "-> slug owned by current event");
      return res.json({ url: slug });
    }

    let suffix = 1;
    let url;
    while (true) {
      url = `${slug}-${suffix++}`;
      const conflict = await extendedGroupEvent.findOne({ "groupEvent.url": url });
      if (!conflict || (id && conflict._id.equals(id))) {
        debugLog("generateTitleFromUrl: title:", title, "slug:", slug, "id:", id, "suffix:", suffix - 1, "-> using suffixed slug:", url);
        break;
      }
    }
    res.json({ url });
  };
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
