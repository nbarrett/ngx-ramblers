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
