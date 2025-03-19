import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("log-message"));
debugLog.enabled = false;


export class Log extends Interaction {

  static message(message: string) {
    return new Log(message);
  }

  constructor(private message: string) {
    super(`#actor logs message ${message}`);
  }

  performAs(actor: UsesAbilities): Promise<void> {
    debugLog(this.message);
    return Promise.resolve();
  }

}
