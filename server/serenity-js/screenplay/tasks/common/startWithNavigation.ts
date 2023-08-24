import { Task } from "@serenity-js/core/lib/screenplay/Task";
import { Navigate, UseAngular } from "@serenity-js/protractor";

export class StartWithNavigation {
  static to(url: string): Task {
    return Task.where(`#actor starts with navigation to ${url}`,
      UseAngular.disableSynchronisation(),
      Navigate.to(url));
  }
}
