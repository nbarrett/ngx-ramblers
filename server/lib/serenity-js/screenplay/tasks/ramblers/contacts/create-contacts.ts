import { PerformsActivities, Task } from "@serenity-js/core";
import { Contact } from "../../../questions/ramblers/contact-listing";
import { CreateContact } from "./create-contact";

export class CreateContacts extends Task {

  static usingData(contacts) {
    return new CreateContacts(contacts);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      ...this.contacts.map(
        contact => CreateContact.usingData(new Contact(contact.firstName, contact.lastName, contact.displayName, contact.email, contact.contactNumber))));
  }

  constructor(public contacts) {
    super("Create Contacts");
  }

}
