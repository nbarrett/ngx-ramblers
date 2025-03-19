import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { ContactListing } from "../../../questions/ramblers/contact-listing";

export class ListContacts extends Task {

  static andAppendTo(results: object[]) {
    return new ListContacts(results);
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    return ContactListing.displayed().answeredBy(actor).then(contacts => {
      return contacts.map(contact => {
        const {displayName, contactId} = contact;
        this.results.push({displayName, contactId});
        return {displayName, contactId};
      });
    });
  }

  constructor(private results: object[]) {
    super("List Contacts");
  }

}
