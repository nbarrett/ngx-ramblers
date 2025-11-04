import { Task, Answerable, Duration } from "@serenity-js/core";
import { Navigate } from "@serenity-js/web";

export class NavigateAndWait {
  static to(url: Answerable<string>, timeout: Duration = Duration.ofSeconds(30)): Task {
    return Task.where(`navigate to page and wait for load`,
      Navigate.to(url)
    );
  }
}