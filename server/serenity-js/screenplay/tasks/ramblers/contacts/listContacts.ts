import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { ContactListing } from "../../../questions/ramblers/contactListing";

export class ListContacts implements Task {

  static andAppendTo(results: object[]) {
    return new ListContacts(results);
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    return ContactListing.displayed().answeredBy(actor).then(contacts => {
      const mapped = contacts.map(contact => {
        const {displayName, contactId} = contact;
        this.results.push({displayName, contactId});
        return {displayName, contactId};
      });
    });
  }

  constructor(private results: object[]) {
  }

}
