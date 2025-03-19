import { Ensure, equals } from "@serenity-js/assertions";
import { AnswersQuestions, Duration, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Enter, isClickable, isVisible } from "@serenity-js/web";
import { SystemConfig } from "../../../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { WalksAndEventsManagerQuestions } from "../../../questions/ramblers/walksAndEventsManagerQuestions";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import * as mongooseClient from "../../../../../mongo/mongoose-client";
import { systemConfig } from "../../../../../config/system-config";

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
          Wait.upTo(Duration.ofSeconds(10)).until(WalksTargets.authHeader, isVisible()),
          Wait.upTo(Duration.ofSeconds(10)).until(WalksTargets.userName, isClickable()),
          Enter.theValue(username).into(WalksTargets.userName),
          Enter.theValue(password).into(WalksTargets.password),
          ClickWhenReady.on(WalksTargets.loginSubmitButton),
          Wait.upTo(Duration.ofSeconds(10)).until(WalksTargets.createDropdown, isVisible()),
          Ensure.that(WalksAndEventsManagerQuestions.CreateButton, equals("Create")),
        );
      }));
  }
  toString() {
    return "#actor logs into Walks and Events Manager";
  }
}
