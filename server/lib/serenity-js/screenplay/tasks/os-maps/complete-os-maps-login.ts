import { equals, includes, isPresent, matches, not } from "@serenity-js/assertions";
import { AnswersQuestions, Check, Masked, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Enter, isVisible, Navigate, Page, Switch } from "@serenity-js/web";
import {
  OS_MAPS_EXPLORE_URL,
  OS_MAPS_IDENTITY_URL_PATTERN,
  OsMapsPageState
} from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { CurrentOsMapsPageState } from "../../questions/os-maps/current-os-maps-page-state";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";
import { ClearOsMapsObstructions } from "./clear-os-maps-obstructions";
import { ClickOsMapsControlResiliently } from "./click-os-maps-control-resiliently";

export class CompleteOsMapsLogin extends Task {

  static with(email: string, password: string): CompleteOsMapsLogin {
    return new CompleteOsMapsLogin(email, password);
  }

  constructor(private readonly email: string, private readonly password: string) {
    super("#actor completes OS Maps identity login");
  }

  performAs(actor: PerformsActivities & AnswersQuestions): Promise<void> {
    return actor.attemptsTo(
      ClearOsMapsObstructions.before(
        Wait.until(CurrentOsMapsPageState.now(), not(equals(OsMapsPageState.UNRECOGNISED))),
        Check.whether(CurrentOsMapsPageState.now(), equals(OsMapsPageState.LOGIN_REQUIRED))
          .andIfSo(
            ClickOsMapsControlResiliently.on(OsMapsPageElements.loginButton),
            Wait.until(Page.whichUrl(matches(OS_MAPS_IDENTITY_URL_PATTERN)), isPresent()),
            Switch.to(Page.whichUrl(matches(OS_MAPS_IDENTITY_URL_PATTERN)))
          ),
        Check.whether(CurrentOsMapsPageState.now(), equals(OsMapsPageState.ROUTE_UNAVAILABLE))
          .andIfSo(
            Navigate.to(OS_MAPS_EXPLORE_URL),
            Wait.until(OsMapsPageElements.loginButton, isVisible()),
            ClickOsMapsControlResiliently.on(OsMapsPageElements.loginButton),
            Wait.until(Page.whichUrl(matches(OS_MAPS_IDENTITY_URL_PATTERN)), isPresent()),
            Switch.to(Page.whichUrl(matches(OS_MAPS_IDENTITY_URL_PATTERN)))
          ),
        Check.whether(CurrentOsMapsPageState.now(), equals(OsMapsPageState.IDENTITY_PROVIDER))
          .andIfSo(
            Wait.until(OsMapsPageElements.emailField, isVisible()),
            Enter.theValue(this.email).into(OsMapsPageElements.emailField),
            Check.whether(OsMapsPageElements.passwordField, not(isVisible()))
              .andIfSo(
                ClickOsMapsControlResiliently.on(OsMapsPageElements.loginSubmit),
                Wait.until(OsMapsPageElements.passwordField, isVisible())
              ),
            Enter.theValue(Masked.valueOf(this.password)).into(OsMapsPageElements.passwordField),
            ClickOsMapsControlResiliently.on(OsMapsPageElements.loginSubmit),
            Wait.until(Page.whichUrl(matches(OS_MAPS_IDENTITY_URL_PATTERN)), not(isPresent())),
            Switch.to(Page.whichUrl(includes("explore.osmaps.com"))),
            Wait.until(OsMapsPageElements.loginButton, not(isVisible()))
          )
      )
    );
  }

}
