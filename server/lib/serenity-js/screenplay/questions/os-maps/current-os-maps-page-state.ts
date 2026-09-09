import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { Page } from "@serenity-js/web";
import { OS_MAPS_IDENTITY_URL_PATTERN, OS_MAPS_ROUTE_UNAVAILABLE_TITLE, OsMapsPageState } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";

export class CurrentOsMapsPageState extends Question<Promise<OsMapsPageState>> {

  static now = () => new CurrentOsMapsPageState();

  constructor() {
    super("the state OS Maps has reached");
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<OsMapsPageState> {
    const url = await actor.answer(Page.current().url());
    const title = await actor.answer(Page.current().title());
    const cookiePromptVisible = await actor.answer(OsMapsPageElements.cookieAccept).then(element => element.isVisible());
    const emailFieldVisible = await actor.answer(OsMapsPageElements.emailField).then(element => element.isVisible());
    const loginButtonVisible = await actor.answer(OsMapsPageElements.loginButton).then(element => element.isVisible());
    const applicationHeaderVisible = await actor.answer(OsMapsPageElements.applicationHeader).then(element => element.isVisible());
    if (cookiePromptVisible) {
      return OsMapsPageState.COOKIE_PROMPT;
    } else if (emailFieldVisible || OS_MAPS_IDENTITY_URL_PATTERN.test(url.href)) {
      return OsMapsPageState.IDENTITY_PROVIDER;
    } else if (title === OS_MAPS_ROUTE_UNAVAILABLE_TITLE) {
      return OsMapsPageState.ROUTE_UNAVAILABLE;
    } else if (loginButtonVisible) {
      return OsMapsPageState.LOGIN_REQUIRED;
    } else if (applicationHeaderVisible) {
      return OsMapsPageState.AUTHENTICATED;
    } else {
      return OsMapsPageState.UNRECOGNISED;
    }
  }

}
