import { AnswersQuestions, PerformsActivities, Question, UsesAbilities } from "@serenity-js/core";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { by } from "protractor";
import { ContactsTargets } from "../../ui/ramblers/contactsTargets";
import { tail } from "../../util/util";

export class Contact {
  constructor(public firstName: string,
              public lastName: string,
              public displayName: string,
              public email: string,
              public contactNumber: string) {
  }

}

export class ContactSummary extends Contact {
  constructor(public rowIndex: number,
              public firstName: string,
              public lastName: string,
              public displayName: string,
              public emailAddress: string,
              public contactNumber: string,
              public contactId: number) {
    super(firstName, lastName, displayName, emailAddress, contactNumber);
    this.rowIndex = rowIndex;
    this.contactId = contactId;
  }

}

export class ContactListing implements Question<Promise<ContactSummary[]>> {

  static displayed = () => new ContactListing();

  extractSummaryRow(result, rowIndex): Promise<ContactSummary> {
    return result.all(by.css("[class^='col - ']")).getText()
      .then(columns => {
        const contactInfo = columns[4].split("\n");
        return ({
          rowIndex,
          firstName: columns[1],
          lastName: columns[2],
          displayName: columns[3],
          emailAddress: contactInfo[0],
          contactNumber: contactInfo[1],
          contactId: columns[5],
          checkboxTarget: ContactsTargets.checkboxSelector(rowIndex),
        });
      });
  }

  answeredBy(actor: PerformsActivities & AnswersQuestions & UsesAbilities): Promise<ContactSummary[]> {
    return promiseOf(ContactsTargets.contacts.answeredBy(actor)
      .map((result, rowIndex) => this.extractSummaryRow(result, rowIndex))
      .then(results => tail(results))) as Promise<ContactSummary[]>;
  }

  toString = () => `displayed contacts`;

}
