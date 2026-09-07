import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { TidyTextKind } from "../../../projects/ngx-ramblers/src/app/models/ai.model";

export const DESCRIPTION_TIDY_SYSTEM_PROMPT = [
  "You tidy the description of an upcoming group walk or social event for a walking group's website.",
  "Correct spelling, grammar and punctuation.",
  "Write in the present or future tense, as an invitation to something still to happen, never as a report of something that has already happened.",
  "Keep the writer's meaning, tone, facts and any emoji. Do not add, remove or invent details such as places, times, distances, prices or people, and write numbers, distances and times exactly as typed: never add a hyphen to something like '7 mile walk' or '10 minute break'.",
  "Keep any existing markdown links and formatting exactly as they are, and keep the writer's apostrophes and quotation marks as typed rather than swapping curly for straight or the reverse.",
  "Turn any bare web address into a markdown link whose text says plainly what it leads to, such as the name of the pub, cafe, car park, bus route or organisation the address is for, using the surrounding text to decide; keep the address itself exactly as written and never invent one.",
  "Write in British English. Do not use em dashes. Never introduce a semicolon: keep the writer's commas, full stops and sentence breaks, and if a sentence must be split start a new sentence or use a plain hyphen with a space either side.",
  "If the text is already correct, return it unchanged.",
  "Return only the tidied description, with no preamble, heading, explanation or quotation marks."
].join(" ");

export const TITLE_TIDY_SYSTEM_PROMPT = [
  "You tidy the title of an upcoming group walk or social event for a walking group's website.",
  "Correct spelling, grammar, capitalisation and punctuation, keeping it a short title rather than a sentence, with no full stop at the end.",
  "Keep the writer's meaning and facts. Do not add, remove or invent details such as places, distances or times, and keep it under 100 characters.",
  "Keep the writer's apostrophes and quotation marks as typed rather than swapping curly for straight or the reverse.",
  "Write in British English. Do not use em dashes or semicolons.",
  "If the title is already correct, return it unchanged.",
  "Return only the tidied title, with no preamble, explanation or quotation marks."
].join(" ");

export const MIN_DESCRIPTION_LENGTH_TO_TIDY = 20;
export const MIN_TITLE_LENGTH_TO_TIDY = 8;

function promptFor(kind: TidyTextKind): string {
  return kind === TidyTextKind.TITLE ? TITLE_TIDY_SYSTEM_PROMPT : DESCRIPTION_TIDY_SYSTEM_PROMPT;
}

function minimumLengthFor(kind: TidyTextKind): number {
  return kind === TidyTextKind.TITLE ? MIN_TITLE_LENGTH_TO_TIDY : MIN_DESCRIPTION_LENGTH_TO_TIDY;
}

export type DescriptionTextGenerator = (systemPrompt: string, input: string) => Promise<string>;

function normalisedForComparison(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

export function withOriginalApostrophes(original: string, output: string): string {
  const originalUsesCurly = /’/.test(original) && !/'/.test(original);
  return originalUsesCurly ? output.replace(/'/g, "’") : output;
}

export function withoutIntroducedSemicolons(original: string, output: string): string {
  return original.includes(";") ? output : output.replace(/\s*;\s*/g, " - ");
}

export function withoutTrailingFullStop(kind: TidyTextKind, output: string): string {
  return kind === TidyTextKind.TITLE ? output.replace(/\.+$/, "").trim() : output;
}

export async function tidiedText(ai: Ai, input: string, kind: TidyTextKind, generateText: DescriptionTextGenerator): Promise<string> {
  const original = (input || "").trim();
  if (!ai?.enabled || original.length < minimumLengthFor(kind)) {
    return original;
  } else {
    try {
      const output = withoutTrailingFullStop(kind, withoutIntroducedSemicolons(original, withOriginalApostrophes(original, (await generateText(promptFor(kind), original)).trim())));
      return output.length > 0 && normalisedForComparison(output) !== normalisedForComparison(original) ? output : original;
    } catch {
      return original;
    }
  }
}

export function tidiedDescription(ai: Ai, input: string, generateText: DescriptionTextGenerator): Promise<string> {
  return tidiedText(ai, input, TidyTextKind.DESCRIPTION, generateText);
}
