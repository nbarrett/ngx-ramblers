import { PerformsActivities, Task } from "@serenity-js/core";
import { Contact } from "../../../questions/ramblers/contactListing";
import { CreateContact } from "./createContact";

export class CreateContacts implements Task {

  static usingData(contacts) {
    return new CreateContacts(contacts);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      ...this.contacts.map(
        contact => CreateContact.usingData(new Contact(contact.firstName, contact.lastName, contact.displayName, contact.email, contact.contactNumber))));
  }

  constructor(public contacts) {
  }

}
