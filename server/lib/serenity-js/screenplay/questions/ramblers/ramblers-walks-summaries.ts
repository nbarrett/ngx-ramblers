import { AnswersQuestions, MetaQuestion, Question, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummary } from "../../../models/ramblers-walk-summary";
import { WalksPageElements } from "../../ui/ramblers/walks-page-elements";
import { CheckedValue } from "../common/checked-value";
import { Attribute, PageElement, Text } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("RamblersWalkSummaries"));
debugLog.enabled = false;

export const CANCELLED_INDICATOR = "Cancelled: ";

export class RamblersWalkSummaries extends Question<Promise<RamblersWalkSummary[]>> {
  static displayed = () => new RamblersWalkSummaries(`displayed walks`);

  answeredBy(actor: AnswersQuestions & UsesAbilities): Promise<RamblersWalkSummary[]> {
    return actor.answer(WalksPageElements.walkListTableRows.eachMappedTo(RamblersWalkSummaryDetails));
  }
}

const RamblersWalkSummaryDetails: MetaQuestion<PageElement, Question<Promise<RamblersWalkSummary>>> = {
  of: (tableRow: PageElement) =>
    Question.about("walk summary record", async actor => {
      debugLog("about to read columns");
      const columns = await actor.answer(Text.ofAll(WalksPageElements.columnsForRow(tableRow)));
      debugLog("columns:", columns);
      debugLog("about to read walkId");
      const walkId = await actor.answer(Attribute.called("href").of(WalksPageElements.hrefForRow(tableRow)));
      debugLog("walkId is", walkId);
      debugLog("about to read checkboxSelector for", columns[2]);
      const target = WalksPageElements.checkboxSelector(tableRow, columns[2]);
      debugLog("about to read currentlySelected");
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

