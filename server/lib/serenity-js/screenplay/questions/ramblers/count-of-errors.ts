import { Question, UsesAbilities } from "@serenity-js/core";

export class CountOfErrors extends Question<number> {
  constructor(private count: number) {
    super("the count of upload errors");
  }

  static displayed(count): Question<number> {
    return new CountOfErrors(count);
  }

  answeredBy(actor: UsesAbilities): number {
    return this.count;
  }
}
