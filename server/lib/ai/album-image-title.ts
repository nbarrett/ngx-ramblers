import debug from "debug";
import {ExtendedGroupEvent} from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import {
  walkLeaderFirstNameForAlbumThanks,
  walksManagerWalkLeaderNameFromGroupEvent
} from "../../../projects/ngx-ramblers/src/app/functions/walks/walk-leader-fields";
import {envConfig} from "../env-config/env-config";
import {aiConfigFromEnvironment} from "./ai-config";
import {generate} from "./ai-generation";

const debugLog = debug(envConfig.logNamespace("album-image-title"));

function leaderFirstName(walk: ExtendedGroupEvent): string {
  const configuredFirstName = walkLeaderFirstNameForAlbumThanks(walk);
  const walksManagerName = walksManagerWalkLeaderNameFromGroupEvent(walk?.groupEvent);
  return configuredFirstName || walksManagerName.split(/\s+/).filter(Boolean)[0] || "";
}

export function fallbackAlbumImageTitle(walk: ExtendedGroupEvent, albumTitle: string): string {
  const firstName = leaderFirstName(walk);
  const walkTitle = walk?.groupEvent?.title || albumTitle || "walk";
  return firstName ? `${firstName}'s ${walkTitle}` : walkTitle;
}

function cleanGeneratedTitle(generatedTitle: string, fallback: string): string {
  const cleanedTitle = (generatedTitle || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/[.!]+$/g, "")
    .replace(/\s+/g, " ");
  return cleanedTitle && cleanedTitle.length <= 100 ? cleanedTitle : fallback;
}

export async function albumImageTitle(walk: ExtendedGroupEvent, albumTitle: string): Promise<string> {
  const fallback = fallbackAlbumImageTitle(walk, albumTitle);
  const ai = aiConfigFromEnvironment();
  if (!ai.enabled) {
    return fallback;
  } else {
    const firstName = leaderFirstName(walk);
    const systemPrompt = [
      "Write one concise, natural title for a photo being added to a walking-group carousel.",
      firstName ? `Start exactly with ${firstName}'s.` : "Do not invent a walk leader's name.",
      "Summarise the recognisable place or route using between four and ten words.",
      "Use the supplied walk title and description, but do not include dates, hashtags, quotation marks or a full stop.",
      "Return only the title and do not invent any detail."
    ].join(" ");
    const input = `Walk title: ${walk?.groupEvent?.title || albumTitle || ""}\nWalk description: ${walk?.groupEvent?.description || ""}`;
    try {
      const generatedTitle = await generate(ai, systemPrompt, input);
      return cleanGeneratedTitle(generatedTitle, fallback);
    } catch (error) {
      debugLog("using fallback title after AI generation failed", error);
      return fallback;
    }
  }
}
