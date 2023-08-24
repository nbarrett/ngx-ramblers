import { Ensure, equals, not } from "@serenity-js/assertions";
import { AnswersQuestions, Duration, PerformsActivities, Task } from "@serenity-js/core";
import { Enter, isVisible, isClickable, Wait } from "@serenity-js/protractor";
import { ConfigDocument, ConfigKey } from "../../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { SystemConfig } from "../../../../../../projects/ngx-ramblers/src/app/models/system.model";
import * as config from "../../../../../lib/mongo/controllers/config";
import { WalksAndEventsManagerQuestions } from "../../../questions/ramblers/walksAndEventsManagerQuestions";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import * as mongooseClient from "../../../../../lib/mongo/mongoose-client";

export class Login implements Task {

  static toRamblers() {
    return new Login();
  }

  performAs(actor: PerformsActivities & AnswersQuestions): Promise<void> {
    return mongooseClient.execute(() => config.queryKey(ConfigKey.SYSTEM))
      .then((configDocument: ConfigDocument) => {
        const systemConfig: SystemConfig = configDocument.value;
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
      });
  }
  toString() {
    return "#actor logs into Walks and Events Manager";
  }
}
