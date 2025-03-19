import { AnswersQuestions, MetaQuestion, PerformsActivities, Question, UsesAbilities } from "@serenity-js/core";
import { ContactsTargets } from "../../ui/ramblers/contacts-targets";
import { PageElement, Text } from "@serenity-js/web";

export class Contact {
  constructor(public firstName: string,
              public lastName: string,
              public displayName: string,
              public emailAddress: string,
              public contactNumber: string) {
  }
}

export class ContactSummary extends Contact {
  constructor(public firstName: string,
              public lastName: string,
              public displayName: string,
              public emailAddress: string,
              public contactNumber: string,
              public contactId: string,
              public checkboxTarget: any) {
    super(firstName, lastName, displayName, emailAddress, contactNumber);
    this.contactId = contactId;
    this.checkboxTarget = checkboxTarget;
  }
}

const ContactSummaryDetails: MetaQuestion<PageElement, Question<Promise<ContactSummary>>> = {

  of: (listItem: PageElement) =>
    Question.about("contact summary error", async actor => {
      const columns = await actor.answer(Text.ofAll(ContactsTargets.colsForRow(listItem)));
      const contactInfo = columns[4].split("\n");
      const value: ContactSummary = {
        firstName: columns[1],
        lastName: columns[2],
        displayName: columns[3],
        emailAddress: contactInfo[0],
        contactNumber: contactInfo[1],
        contactId: columns[5],
        checkboxTarget: ContactsTargets.checkboxSelector(listItem, columns[3]),
      };
      return value;
    })
};

export class ContactListing extends Question<Promise<ContactSummary[]>> {

  static displayed = () => new ContactListing(`displayed contacts`);

  answeredBy(actor: PerformsActivities & AnswersQuestions & UsesAbilities): Promise<ContactSummary[]> {
    return actor.answer(ContactsTargets.contacts.eachMappedTo(ContactSummaryDetails));
  }
}
