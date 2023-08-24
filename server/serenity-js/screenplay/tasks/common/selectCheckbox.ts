import { Activity, AnswersQuestions, PerformsActivities, Question, UsesAbilities } from "@serenity-js/core";
import { Click } from "@serenity-js/protractor";
import { ElementFinder } from "protractor";
import { CheckedValue } from "../../questions/common/checkedValue";

export class SelectCheckbox {
  static checkedValue(value: boolean) {
    return {from: (target: Question<ElementFinder> | ElementFinder): Activity => new SelectCheckboxValue(value, target)};
  }

  static checked() {
    return {from: (target: Question<ElementFinder> | ElementFinder): Activity => new SelectCheckboxValue(true, target)};
  }

  static unchecked() {
    return {from: (target: Question<ElementFinder> | ElementFinder): Activity => new SelectCheckboxValue(false, target)};
  }
}

class SelectCheckboxValue implements Activity {
  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions) {
    return CheckedValue.of(this.target).answeredBy(actor)
      .then(checked => {
        if (checked !== this.value) {
          // console.log(`checked value of ${this.target} is ${checked} -> checking`);
          return actor.attemptsTo(Click.on(this.target));
        } else {
          // console.log(`checked value of ${this.target} already ${this.value} -> no action`);
          return Promise.resolve();
        }
      })
      .catch(error => {
        console.log(`${error} occurred in ${this} - retrying`);
        return actor.attemptsTo(SelectCheckbox.checkedValue(this.value).from(this.target));
      });
  }

  constructor(private value: boolean, private target: Question<ElementFinder> | ElementFinder) {
  }

  toString = () => `#actor selects ${this.value} value from ${this.target}`;
}
