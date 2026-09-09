import { Check, PerformsActivities, Task } from "@serenity-js/core";
import { isVisible } from "@serenity-js/web";
import { Environment } from "../../../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { ClearOsMapsObstructions } from "./clear-os-maps-obstructions";
import { CompleteOsMapsLogin } from "./complete-os-maps-login";
import { WaitUntilOnOsMaps } from "./wait-until-on-os-maps";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";

export class LoginToOsMaps extends Task {

  static withConfiguredCredentials() {
    return new LoginToOsMaps();
  }

  constructor() {
    super("#actor logs into OS Maps");
  }

  performAs(actor: PerformsActivities): Promise<void> {
    const email = (process.env[Environment.OS_EMAIL] || "").trim();
    const password = (process.env[Environment.OS_PASSWORD] || "").trim();
    if (!email || !password) {
      throw new Error("OS_EMAIL and OS_PASSWORD must be set to export an OS Maps route");
    } else {
      return actor.attemptsTo(
        ClearOsMapsObstructions.now(),
        CompleteOsMapsLogin.with(email, password),
        ClearOsMapsObstructions.now(),
        WaitUntilOnOsMaps.site()
      );
    }
  }

}
