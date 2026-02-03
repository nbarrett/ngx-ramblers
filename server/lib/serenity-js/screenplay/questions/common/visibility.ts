import { Answerable, AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { PageElement } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("Visibility"));
debugLog.enabled = false;

export class Visibility extends Question<Promise<boolean>> {
  constructor(private target: Answerable<PageElement>) {
    super(`the visibility of ${target}`);
  }

  static of = (target: Answerable<PageElement>) => new Visibility(target);

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    try {
      return await actor.answer(this.target).then(item => item.isPresent());
    } catch (e) {
      debugLog("target:", this.target, "error:", e);
      return false;
    }
  }
}
