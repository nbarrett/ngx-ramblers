import { Activity, AnswersQuestions, PerformsActivities, QuestionAdapter, UsesAbilities } from "@serenity-js/core";
import { Click, PageElement } from "@serenity-js/web";
import { CheckedValue } from "../../questions/common/checked-value";
import { Log } from "../ramblers/common/log";
import { ClickWhenReady } from "./click-when-ready";

export class SelectCheckbox {
  static checkedValue(value: boolean) {
    return {from: (target: QuestionAdapter<PageElement>): Activity => new SelectCheckboxValue(value, target)};
  }

  static checked() {
    return {from: (target: QuestionAdapter<PageElement>): Activity => new SelectCheckboxValue(true, target)};
  }

  static unchecked() {
    return {from: (target: QuestionAdapter<PageElement>): Activity => new SelectCheckboxValue(false, target)};
  }
}

class SelectCheckboxValue extends Activity {
  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions) {
    return CheckedValue.of(this.target).answeredBy(actor)
      .then(checked => {
        if (checked !== this.value) {
          return actor.attemptsTo(ClickWhenReady.on(this.target));
        } else {
          return Promise.resolve();
        }
      })
      .catch(error => {
        actor.attemptsTo(Log.message(`${error} occurred in ${this} - retrying`));
        return actor.attemptsTo(SelectCheckbox.checkedValue(this.value).from(this.target));
      });
  }

  constructor(private value: boolean, private target: QuestionAdapter<PageElement>) {
    super(`#actor selects ${value} value from ${target}`);
  }

}
