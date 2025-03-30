import { Question } from "@serenity-js/core";
import { ElementFinder } from "protractor";
import debug from "debug";
import { AnswersQuestions, UsesAbilities } from "@serenity-js/core/lib/screenplay";

const debugLog = debug("TextThatMightNotYetBeThere");
debugLog.enabled = false;

export class TextThatMightNotYetBeThere implements Question<Promise<string>> {
  static of = (target: Question<ElementFinder> | ElementFinder) => new TextThatMightNotYetBeThere(target);

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<string> {
    try {
      return await this.target.answeredBy(actor).getText();
    } catch (e) {
      debugLog("TextThatMightNotYetBeThere:target:", this.target, "error:", e);
      return "";
    }
  }

  constructor(private target: Question<ElementFinder> | ElementFinder) {
  }

  toString = () => `the text that might not yet be there in ${this.target}`;
}
