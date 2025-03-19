import { AnswersQuestions, MetaQuestion, Question, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummary } from "../../../models/ramblersWalkSummary";
import { WalksTargets } from "../../ui/ramblers/walksTargets";
import { CheckedValue } from "../common/checkedValue";
import { Attribute, PageElement, Text } from "@serenity-js/web";

export const CANCELLED_INDICATOR = "Cancelled: ";

export class RamblersWalkSummaries extends Question<Promise<RamblersWalkSummary[]>> {

  static displayed = () => new RamblersWalkSummaries(`displayed walks`);

  answeredBy(actor: AnswersQuestions & UsesAbilities): Promise<RamblersWalkSummary[]> {
    return actor.answer(WalksTargets.walkListviewTableRows.eachMappedTo(RamblersWalkSummaryDetails));
  }

}

const RamblersWalkSummaryDetails: MetaQuestion<PageElement, Question<Promise<RamblersWalkSummary>>> = {
  of: (tableRow: PageElement) =>
    Question.about("walk summary record", async actor => {
      const columns = await actor.answer(Text.ofAll(WalksTargets.columnsForRow(tableRow)));
      const walkId = await actor.answer(Attribute.called("href").of(WalksTargets.hrefForRow(tableRow)));
      const target = WalksTargets.checkboxSelector(tableRow, columns[2]);
      const currentlySelected = await CheckedValue.of(target).answeredBy(actor);
      return {
        tableRow,
        title: columns[1].replace(CANCELLED_INDICATOR, ""),
        walkDate: columns[2],
        status: columns[3],
        walkId,
        currentlySelected,
        cancelled: columns[1].includes(CANCELLED_INDICATOR)
      };
    })
};

