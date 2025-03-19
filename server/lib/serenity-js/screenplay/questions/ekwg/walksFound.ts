import { contain, Ensure } from "@serenity-js/assertions";
import { AnswersQuestions, MetaQuestion, Question, UsesAbilities } from "@serenity-js/core";
import { WalksTargets } from "../../ui/ramblers/walksTargets";
import { PageElement, Text } from "@serenity-js/web";

export class WalkSummary {

  constructor(public action: string,
              public walkDate: string,
              public startTime: string,
              public briefDescription: string,
              public longerDescription: string,
              public distance: string,
              public gridReference: string,
              public postcode: string,
              public contactEmail: string,
              public contactPhone: string) {
  }

}

export class WalkSummaries extends Question<Promise<WalkSummary[]>> {

  static displayed = () => new WalkSummaries(`displayed walks`);

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<WalkSummary[]> {
    return actor.answer(WalksTargets.walkListviewTableRows.eachMappedTo(WalkSummaryDetails));
  }

}


const WalkSummaryDetails: MetaQuestion<PageElement, Question<Promise<WalkSummary>>> = {

  of: (listItem: PageElement) =>
    Question.about("upload error", async actor => {
      const columns = await actor.answer(Text.ofAll(WalksTargets.tdsForRow(listItem)));
      console.log("columns", columns);
      return ({
        action: columns[0],
        walkDate: columns[1],
        startTime: columns[2],
        briefDescription: columns[3],
        longerDescription: columns[4],
        distance: columns[5],
        gridReference: columns[6],
        postcode: columns[7],
        contactEmail: columns[8],
        contactPhone: columns[9],
      });
    })
};

export const showsAWalkOn = (expectedDate: string) => showWalksOnAllOf([expectedDate]);
export const showWalksOnAllOf = (expectedDates: string[]) => foundWalks => {
  return foundWalks.then(walks => {
    console.log("walks:", walks);
    const walkDates = walks.map(walk => walk.walkDate);
    console.log("walks dates:", walkDates);
    Ensure.that(walkDates, contain(expectedDates));
  });
};
