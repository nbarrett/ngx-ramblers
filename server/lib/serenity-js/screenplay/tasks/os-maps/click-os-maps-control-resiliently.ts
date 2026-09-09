import { Answerable, AnswersQuestions, PerformsActivities, Task } from "@serenity-js/core";
import { Click, PageElement } from "@serenity-js/web";
import { ClearOsMapsObstructions } from "./clear-os-maps-obstructions";

const MAX_ATTEMPTS = 5;

export class ClickOsMapsControlResiliently extends Task {

  static on(target: Answerable<PageElement>): ClickOsMapsControlResiliently {
    return new ClickOsMapsControlResiliently(target);
  }

  constructor(private readonly target: Answerable<PageElement>) {
    super(`#actor clicks on ${target}, dismissing the OS Maps cookie banner if it intervenes`);
  }

  async performAs(actor: PerformsActivities & AnswersQuestions): Promise<void> {
    const attempt = async (attemptsRemaining: number): Promise<void> => {
      try {
        await actor.attemptsTo(
          ClearOsMapsObstructions.now(),
          Click.on(this.target)
        );
      } catch (error) {
        if (attemptsRemaining <= 1) {
          throw error;
        } else {
          await attempt(attemptsRemaining - 1);
        }
      }
    };
    return attempt(MAX_ATTEMPTS);
  }

}
