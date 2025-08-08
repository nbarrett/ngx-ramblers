import { Ensure, equals, isPresent } from "@serenity-js/assertions";
import { AnswersQuestions, Check, Masked, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Enter, isClickable, isVisible, Text } from "@serenity-js/web";
import { SystemConfig } from "../../../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import * as mongooseClient from "../../../../../mongo/mongoose-client";
import { systemConfig } from "../../../../../config/system-config";
import { Log } from "./log";
import {
  AuthErrorCookieBannerOrCreateMenuDropdown
} from "../../../questions/ramblers/auth-error-cookie-banner-or-create-menu-dropdown";
import { Accept } from "./accept-cookie-prompt";

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
          Check.whether(WalksPageElements.createMenuDropdown, isPresent())
            .andIfSo(Log.message("Session is already logged in so no need to login again"))
            .otherwise(
              Wait.until(WalksPageElements.authHeader, isVisible()),
              Wait.until(WalksPageElements.userName, isClickable()),
              Enter.theValue(username).into(WalksPageElements.userName),
              Enter.theValue(Masked.valueOf(password)).into(WalksPageElements.password),
              ClickWhenReady.on(WalksPageElements.loginSubmitButton),
              Wait.until(AuthErrorCookieBannerOrCreateMenuDropdown.isDisplayed(), equals(true)),
              Accept.cookieBannerIfVisible(),
              Check.whether(WalksPageElements.createMenuDropdown, isVisible())
                .andIfSo(Ensure.that(Text.of(WalksPageElements.createMenuDropdown), equals("Create"))),
              Check.whether(WalksPageElements.authErrorMessage, isVisible())
                .andIfSo(Ensure.that(Text.of(WalksPageElements.authErrorMessage), equals("")))));
      }));
  }

}
