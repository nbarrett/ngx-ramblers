import { DateTime } from "luxon";
import { isString } from "es-toolkit/compat";
import { NewsletterPlan, NewsletterPlanRequest } from "../../../projects/ngx-ramblers/src/app/models/ai.model";

export const NEWSLETTER_PLAN_SYSTEM_PROMPT = [
  "A volunteer running a walking group has described the newsletter they want to send.",
  "Work out the period of the walks and social events programme it should cover, and any guidance they have given about what to emphasise.",
  "Return a single JSON object and nothing else, with these keys:",
  "fromDate (the first day covered, as YYYY-MM-DD),",
  "toDate (the last day covered, as YYYY-MM-DD),",
  "periodDescription (how you would describe that period in a sentence, such as \"the rest of August\"),",
  "guidance (anything they asked for beyond the dates, such as a walk to highlight or a tone to strike, or null when they only gave dates).",
  "Interpret relative wording such as \"the next six weeks\" or \"up to the end of September\" against the current date supplied.",
  "When they give no period at all, cover the month starting from the current date.",
  "Never return a period that ends before it starts, and never return more than a year.",
  "Return no explanation, no markdown code fence and no text outside the JSON object."
].join(" ");

export const MAX_PLAN_DAYS = 366;
export const DEFAULT_PLAN_DAYS = 30;
export const MAX_REQUEST_CHARS = 1000;

export function buildNewsletterPlanInput(request: NewsletterPlanRequest, todayMillis: number): string {
  const today = DateTime.fromMillis(todayMillis);
  return [
    `Current date: ${today.toFormat("yyyy-MM-dd")} (${today.toFormat("cccc d LLLL yyyy")})`,
    `What they asked for: ${(request?.request ?? "").trim().slice(0, MAX_REQUEST_CHARS)}`
  ].join("\n");
}

function parsedJson(candidate: string): any | null {
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

function repairedJson(candidate: string): any | null {
  const repaired = candidate
    .replace(/([{,]\s*)([A-Za-z][A-Za-z0-9_]*)"\s*:/g, "$1\"$2\":")
    .replace(/([{,]\s*)([A-Za-z][A-Za-z0-9_]*)\s*:/g, "$1\"$2\":")
    .replace(/,\s*([}\]])/g, "$1");
  return repaired === candidate ? null : parsedJson(repaired);
}

export function jsonObjectFrom(raw: string): any | null {
  const text = (raw ?? "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const candidate = start === -1 || end <= start ? null : text.slice(start, end + 1);
  return candidate ? parsedJson(candidate) ?? repairedJson(candidate) : null;
}

function dayFrom(value: any): DateTime | null {
  const parsed = isString(value) ? DateTime.fromISO(value.trim()) : null;
  return parsed?.isValid ? parsed.startOf("day") : null;
}

function textFrom(value: any): string | null {
  const trimmed = isString(value) ? value.trim() : "";
  return trimmed ? trimmed : null;
}

export function defaultNewsletterPlan(todayMillis: number): NewsletterPlan {
  const from = DateTime.fromMillis(todayMillis).startOf("day");
  const to = from.plus({ days: DEFAULT_PLAN_DAYS }).endOf("day");
  return {
    fromMillis: from.toMillis(),
    toMillis: to.toMillis(),
    periodDescription: `${from.toFormat("d LLLL")} to ${to.toFormat("d LLLL yyyy")}`,
    guidance: null,
    understood: false
  };
}

export function parseNewsletterPlan(raw: string, todayMillis: number): NewsletterPlan {
  const parsed = jsonObjectFrom(raw);
  const from = dayFrom(parsed?.fromDate);
  const to = dayFrom(parsed?.toDate);
  const usable = from && to && to > from && to.diff(from, "days").days <= MAX_PLAN_DAYS;
  return usable ? {
    fromMillis: from.toMillis(),
    toMillis: to.endOf("day").toMillis(),
    periodDescription: textFrom(parsed?.periodDescription) ?? `${from.toFormat("d LLLL")} to ${to.toFormat("d LLLL yyyy")}`,
    guidance: textFrom(parsed?.guidance),
    understood: true
  } : {
    ...defaultNewsletterPlan(todayMillis),
    guidance: textFrom(parsed?.guidance)
  };
}
