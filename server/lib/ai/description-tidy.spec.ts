import expect from "expect";
import { describe, it } from "mocha";
import { Ai, AiProviderType } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { DESCRIPTION_TIDY_SYSTEM_PROMPT, TITLE_TIDY_SYSTEM_PROMPT, tidiedDescription, tidiedText, withOriginalApostrophes } from "./description-tidy";
import { TidyTextKind } from "../../../projects/ngx-ramblers/src/app/models/ai.model";

const enabled: Ai = {enabled: true, provider: AiProviderType.OPENAI_COMPATIBLE, model: "test"};
const original = "We starting and end at the Bell & Jorrocks, giving us a chance for a stroll in the evening sun.";

describe("tidiedDescription", () => {

  it("returns the writer's text unchanged when AI is switched off", async () => {
    const calls: string[] = [];
    const result = await tidiedDescription({...enabled, enabled: false}, original, async (_prompt, input) => {
      calls.push(input);
      return "tidied";
    });
    expect(result).toEqual(original);
    expect(calls).toEqual([]);
  });

  it("leaves very short text alone rather than sending it for tidying", async () => {
    const result = await tidiedDescription(enabled, "Short walk", async () => "A short walk.");
    expect(result).toEqual("Short walk");
  });

  it("sends the tidy prompt and returns the tidied text when it differs", async () => {
    const seen: {prompt: string; input: string}[] = [];
    const result = await tidiedDescription(enabled, original, async (prompt, input) => {
      seen.push({prompt, input});
      return "We start and end at the Bell & Jorrocks, giving us a chance for a stroll in the evening sun.";
    });
    expect(seen[0].prompt).toEqual(DESCRIPTION_TIDY_SYSTEM_PROMPT);
    expect(seen[0].input).toEqual(original);
    expect(result).toEqual("We start and end at the Bell & Jorrocks, giving us a chance for a stroll in the evening sun.");
  });

  it("returns the original when the model changes nothing but whitespace", async () => {
    const result = await tidiedDescription(enabled, original, async () => `  ${original.replace(", giving", ",  giving")}  `);
    expect(result).toEqual(original);
  });

  it("returns the original when the model fails or answers with nothing", async () => {
    expect(await tidiedDescription(enabled, original, async () => { throw new Error("boom"); })).toEqual(original);
    expect(await tidiedDescription(enabled, original, async () => "   ")).toEqual(original);
  });

  it("keeps the writer's curly apostrophes when the model straightens them", async () => {
    const curly = "We head up to St Paul’s Cathedral then on to Leadenhall Market for lunch.";
    const result = await tidiedDescription(enabled, curly, async () => "We head up to St Paul's Cathedral, then on to Leadenhall Market for lunch.");
    expect(result).toEqual("We head up to St Paul’s Cathedral, then on to Leadenhall Market for lunch.");
    expect(withOriginalApostrophes("It's straight", "It's still straight")).toEqual("It's still straight");
  });

  it("tidies a title with the title prompt and a shorter minimum length", async () => {
    const seen: string[] = [];
    const result = await tidiedText(enabled, "frittenden evening stroll", TidyTextKind.TITLE, async (prompt) => {
      seen.push(prompt);
      return "Frittenden evening stroll";
    });
    expect(seen).toEqual([TITLE_TIDY_SYSTEM_PROMPT]);
    expect(result).toEqual("Frittenden evening stroll");
    expect(await tidiedText(enabled, "Walk", TidyTextKind.TITLE, async () => "A walk")).toEqual("Walk");
  });

  it("turns a semicolon the model introduces into a spaced hyphen but keeps the writer's own semicolons", async () => {
    expect(await tidiedText(enabled, "we meet at the pub, there is parking", TidyTextKind.DESCRIPTION, async () => "We meet at the pub; there is parking.")).toEqual("We meet at the pub - there is parking.");
    expect(await tidiedText(enabled, "we meet at the pub; there is parking", TidyTextKind.DESCRIPTION, async () => "We meet at the pub; there is parking.")).toEqual("We meet at the pub; there is parking.");
  });

  it("drops a full stop the model adds to the end of a title but leaves descriptions alone", async () => {
    expect(await tidiedText(enabled, "frittenden evening stroll", TidyTextKind.TITLE, async () => "Frittenden evening stroll.")).toEqual("Frittenden evening stroll");
    expect(await tidiedText(enabled, "we meet at the car park and walk", TidyTextKind.DESCRIPTION, async () => "We meet at the car park and walk.")).toEqual("We meet at the car park and walk.");
  });

});
