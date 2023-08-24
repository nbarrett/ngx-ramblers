import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { ElementFinder, promise } from "protractor";
import { RamblersWalkSummary } from "../../../models/ramblersWalkSummary";
import { WalksTargets } from "../../ui/ramblers/walksTargets";
import { CheckedValue } from "../common/checkedValue";

export const CANCELLED_INDICATOR = "Cancelled: ";

export class RamblersWalkSummaries implements Question<Promise<RamblersWalkSummary[]>> {

  static displayed = () => new RamblersWalkSummaries();

  extractPartialRamblersWalkSummary(tableRow: ElementFinder, rowIndex: number): promise.Promise<RamblersWalkSummary> {
    return WalksTargets.columnsForRow(tableRow)
      .map((element: ElementFinder) => element.getText())
      .then((columns: string[]) => ({
        rowIndex,
        title: columns[1].replace(CANCELLED_INDICATOR, ""),
        walkDate: columns[2],
        status: columns[3],
        walkId: null,
        currentlySelected: null,
        cancelled: columns[1].includes(CANCELLED_INDICATOR)
      }));
  }

  addWalkUrlAsId(ramblersWalkSummary: RamblersWalkSummary, result: ElementFinder) {
    return WalksTargets.hrefForRow(result).getAttribute("href")
      .then(walkId => ({...ramblersWalkSummary, walkId}));
  }

  addCurrentlySelected(ramblersWalkSummary: RamblersWalkSummary, rowIndex: number, actor: UsesAbilities & AnswersQuestions) {
    return CheckedValue.of(WalksTargets.checkboxSelector(rowIndex, ramblersWalkSummary.walkDate)).answeredBy(actor)
      .then(selected => ({...ramblersWalkSummary, currentlySelected: selected}));
  }

  answeredBy(actor: AnswersQuestions & UsesAbilities): Promise<RamblersWalkSummary[]> {
    return promiseOf(WalksTargets.walkListviewTableRows.answeredBy(actor)
      .map((tableRow: ElementFinder, rowIndex: number) => this.extractPartialRamblersWalkSummary(tableRow, rowIndex)
        .then(ramblersWalkSummary => this.addWalkUrlAsId(ramblersWalkSummary, tableRow))
        .then(ramblersWalkSummary => this.addCurrentlySelected(ramblersWalkSummary, rowIndex, actor))
        .catch(error => {
          console.log("retrying", this.toString(), "due to", error.name);
          return this.answeredBy(actor) as Promise<any>;
        })));
  }

  toString = () => `displayed walks`;

}
