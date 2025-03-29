import { PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { FileSystem, Path } from "@serenity-js/core/lib/io";

export class SummariseContacts implements Task {

  static toFile(results: object[]) {
    return new SummariseContacts(results);
  }

  performAs(actor: PerformsActivities & UsesAbilities): Promise<void> {
    new FileSystem(new Path("./")).store(new Path("all-contacts.json"), JSON.stringify(this.results));
    return Promise.resolve();
  }

  constructor(private results: object[]) {
  }

}
