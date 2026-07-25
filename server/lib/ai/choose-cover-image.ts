import sharp from "sharp";
import debugLib from "debug";
import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { CoverImageCandidate } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { envConfig } from "../env-config/env-config";
import { objectBufferForKey } from "../aws/aws-controllers";
import { contentTypeFrom } from "../aws/aws-utils";
import { aiProviderFor } from "./ai-provider-factory";

const debug = debugLib(envConfig.logNamespace("ai:choose-cover"));
debug.enabled = true;

const MAX_CANDIDATES = 8;
const VISION_MAX_EDGE = 512;

const COVER_SYSTEM_PROMPT = [
  "You pick the best cover photo for a UK Ramblers walking group photo album.",
  "Prefer a clear group shot of several people together, ideally facing the camera or photographer.",
  "If none face the camera, pick the next best group view (side-on or the group on the path still reading as a group).",
  "Then prefer scenic walk photos that still include people.",
  "Avoid blurry shots, extreme close-ups of a single face, and photos where the group is barely visible.",
  "Reply with only the label of the chosen image, such as IMAGE_1 or IMAGE_3, and nothing else.",
  "Labels are numbered from IMAGE_1 upwards."
].join(" ");

export function sampleCandidates(candidates: CoverImageCandidate[], max = MAX_CANDIDATES): CoverImageCandidate[] {
  const usable = (candidates || []).filter(candidate => candidate?.image && (candidate?.url || candidate?.s3Key));
  if (usable.length <= max) {
    return usable;
  }
  const step = usable.length / max;
  return Array.from({length: max}, (_value, index) => {
    if (index === max - 1) {
      return usable[usable.length - 1];
    }
    return usable[Math.min(usable.length - 1, Math.floor(index * step))];
  });
}

export function parseChosenImageLabel(reply: string, candidates: CoverImageCandidate[]): string | null {
  if (!reply || !candidates?.length) {
    return null;
  }
  const match = reply.trim().toUpperCase().match(/IMAGE[_\s-]?(\d+)/);
  if (!match) {
    return null;
  }
  const number = Number(match[1]);
  if (!Number.isFinite(number)) {
    return null;
  }
  if (number >= 1 && number <= candidates.length) {
    return candidates[number - 1].image || null;
  }
  if (number >= 0 && number < candidates.length) {
    return candidates[number].image || null;
  }
  return null;
}

export function s3KeyForCandidate(candidate: CoverImageCandidate, rootFolder?: string, albumName?: string): string | null {
  if (candidate?.s3Key) {
    return candidate.s3Key.replace(/^\/+/, "");
  }
  if (!candidate?.image) {
    return null;
  }
  if (candidate.image.includes("/")) {
    return candidate.image.replace(/^\/+/, "").replace(/^api\/aws\/s3\//, "");
  }
  if (rootFolder && albumName) {
    return `${rootFolder}/${albumName}/${candidate.image}`.replace(/\/+/g, "/");
  }
  return null;
}

async function dataUrlFromBuffer(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .rotate()
    .resize({
      width: VISION_MAX_EDGE,
      height: VISION_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({quality: 60})
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

export async function resolveCandidateDataUrls(
  candidates: CoverImageCandidate[],
  rootFolder?: string,
  albumName?: string
): Promise<CoverImageCandidate[]> {
  const sampled = sampleCandidates(candidates);
  const resolved = await Promise.all(sampled.map(async candidate => {
    if (candidate.url?.startsWith("data:image/")) {
      return candidate;
    }
    const key = s3KeyForCandidate(candidate, rootFolder, albumName);
    if (key) {
      try {
        const buffer = await objectBufferForKey(key);
        const dataUrl = await dataUrlFromBuffer(buffer);
        debug("resolved S3 key to data URL", key, "sourceBytes", buffer.length, "dataUrlChars", dataUrl.length);
        return {...candidate, url: dataUrl};
      } catch (error) {
        debug("failed to load S3 key for cover pick", key, (error as Error)?.message);
      }
    }
    debug("skipping candidate without usable vision data URL", candidate.image);
    return null;
  }));
  return resolved.filter((candidate): candidate is CoverImageCandidate => !!candidate?.url?.startsWith("data:image/"));
}

export async function chooseCoverImageFromCandidates(
  ai: Ai,
  candidates: CoverImageCandidate[],
  rootFolder?: string,
  albumName?: string
): Promise<string | null> {
  const sampled = await resolveCandidateDataUrls(candidates, rootFolder, albumName);
  if (sampled.length === 0) {
    return null;
  }
  if (sampled.length === 1) {
    return sampled[0].image;
  }
  const provider = aiProviderFor(ai);
  if (!provider.generateWithImages) {
    debug("provider has no generateWithImages; using first image");
    return sampled[0].image;
  }
  const labels = sampled.map((candidate, index) => `IMAGE_${index + 1}: ${candidate.image}`).join("\n");
  const userText = [
    "Choose the best cover image for this walk photo album.",
    `There are ${sampled.length} images labelled IMAGE_1 to IMAGE_${sampled.length}.`,
    "Candidate list:",
    labels,
    `Reply with only one label from IMAGE_1 to IMAGE_${sampled.length}.`
  ].join("\n");
  debug("asking vision model for cover among", sampled.length, "images");
  try {
    const reply = await provider.generateWithImages({
      systemPrompt: COVER_SYSTEM_PROMPT,
      userText,
      imageUrls: sampled.map(candidate => candidate.url),
      maxTokens: 32
    });
    debug("vision model reply:", reply);
    const chosen = parseChosenImageLabel(reply, sampled);
    if (!chosen) {
      debug("could not parse vision reply; using first image");
      return sampled[0].image;
    }
    return chosen;
  } catch (error) {
    debug("vision model failed; using first image", (error as Error)?.message);
    return sampled[0].image;
  }
}
