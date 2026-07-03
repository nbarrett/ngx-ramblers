import { Activity, AnswersQuestions, PerformsActivities, Task } from "@serenity-js/core";
import { Navigate } from "@serenity-js/web";
import { Log } from "../ramblers/common/log";

export class Retry extends Task {

  static times(maxRetries: number) {
    return {
      each: (...activities: Activity[]) => new Retry(maxRetries, activities)
    };
  }

  constructor(
    private readonly maxRetries: number,
    private readonly activities: Activity[]
  ) {
    super(`#actor retries activities up to ${maxRetries} times`);
  }

  performAs(actor: PerformsActivities & AnswersQuestions): Promise<void> {
    return this.attempt(actor, 0);
  }

  private attempt(actor: PerformsActivities & AnswersQuestions, retryCount: number): Promise<void> {
    return actor.attemptsTo(...this.activities)
      .catch(error => {
        if (retryCount < this.maxRetries) {
          return actor.attemptsTo(
            Log.message(`Attempt failed: ${error.message} -- retry ${retryCount + 1}/${this.maxRetries}`),
            Navigate.reloadPage(),
          ).then(() => this.attempt(actor, retryCount + 1));
        }
        throw error;
      });
  }
}
