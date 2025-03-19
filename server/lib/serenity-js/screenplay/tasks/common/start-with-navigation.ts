import { Task } from "@serenity-js/core/lib/screenplay/Task";
import { Navigate } from "@serenity-js/web";

export class StartWithNavigation {
  static to(url: string): Task {
    return Task.where(`#actor starts with navigation to ${url}`,
      Navigate.to(url));
  }
}
