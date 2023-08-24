import { contain, Ensure } from "@serenity-js/assertions";
import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { by } from "protractor";
import { WalksTargets } from "../../ui/ramblers/walksTargets";

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

export class WalkSummaries implements Question<Promise<WalkSummary[]>> {

  static displayed = () => new WalkSummaries();

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<WalkSummary[]> {
    return promiseOf(WalksTargets.walkListviewTableRows.answeredBy(actor)
      .all(by.tagName("td")).getText()
      .then(columns => {
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
      })) as Promise<WalkSummary[]>;
  }

  toString = () => `displayed walks`;
}

export const showsAWalkOn = (expectedDate: string) => showWalksOnAllOf([expectedDate]);
export const showWalksOnAllOf = (expectedDates: string[]) => foundWalks => {
  return foundWalks.then(walks => {
    console.log("walks:", walks);
    const walkDates = walks.map(walk => walk.walkDate);
    console.log("walks dates:", walkDates);
    Ensure.that(walkDates, contain(expectedDates));
  });
};
