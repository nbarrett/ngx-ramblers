import { Ensure, equals, isPresent } from "@serenity-js/assertions";
import { AnswersQuestions, Check, Duration, Masked, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Enter, isClickable, isVisible, Text } from "@serenity-js/web";
import { SystemConfig } from "../../../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import * as mongooseClient from "../../../../../mongo/mongoose-client";
import { systemConfig } from "../../../../../config/system-config";
import { Log } from "./log";

export class Login extends Task {

  static toRamblers() {
    return new Login("#actor logs into Walks and Events Manager");
  }

  performAs(actor: PerformsActivities & AnswersQuestions): Promise<void> {
    return mongooseClient.execute(() => systemConfig()
      .then((systemConfig: SystemConfig) => {
        const username = systemConfig?.national?.walksManager?.userName;
        const password = systemConfig?.national?.walksManager?.password;
        return actor.attemptsTo(
          Check.whether(WalksPageElements.createDropdown, isPresent())
            .andIfSo(Log.message("Session is already logged in so no need to login again"))
            .otherwise(
              Wait.until(WalksPageElements.authHeader, isVisible()),
              Wait.until(WalksPageElements.userName, isClickable()),
              Enter.theValue(username).into(WalksPageElements.userName),
              Enter.theValue(Masked.valueOf(password)).into(WalksPageElements.password),
              ClickWhenReady.on(WalksPageElements.loginSubmitButton),
              Wait.upTo(Duration.ofSeconds(20)).until(WalksPageElements.createDropdown, isVisible()),
              Ensure.that(Text.of(WalksPageElements.createDropdown), equals("Create"))),
        );
      }));
  }

}
