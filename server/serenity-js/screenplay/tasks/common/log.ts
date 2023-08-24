import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";

export class Log implements Interaction {

  static message(message: string) {
    return new Log(message);
  }

  constructor(private message: string) {
  }

  performAs(actor: UsesAbilities): Promise<void> {
    console.log(this.message);
    return Promise.resolve();
  }

}
