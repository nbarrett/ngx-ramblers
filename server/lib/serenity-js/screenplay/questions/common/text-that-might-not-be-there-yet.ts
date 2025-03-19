import { Answerable, Question } from "@serenity-js/core";
import debug from "debug";
import { AnswersQuestions, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { PageElement } from "@serenity-js/web";

const debugLog = debug("TextThatMightNotYetBeThere");
debugLog.enabled = false;

export class TextThatMightNotYetBeThere extends Question<Promise<string>> {
  static of = (target: Answerable<PageElement>) => new TextThatMightNotYetBeThere(target);

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<string> {
    try {
      return await actor.answer(this.target).then(item => item.text());
    } catch (e) {
      debugLog("TextThatMightNotYetBeThere:target:", this.target, "error:", e);
      return "";
    }
  }

  constructor(private target: Answerable<PageElement>) {
    super(`the text that might not yet be there in ${target}`);
  }
}
