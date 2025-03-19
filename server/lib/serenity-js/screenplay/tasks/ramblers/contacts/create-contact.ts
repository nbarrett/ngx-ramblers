import { Duration, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Contact } from "../../../questions/ramblers/contact-listing";
import { ContactsTargets } from "../../../ui/ramblers/contacts-targets";
import { SaveBrowserSource } from "../../common/save-browser-source";
import { Click, Enter, isVisible } from "@serenity-js/web";

export class CreateContact extends Task {

  static usingData(contactData: Contact) {
    return new CreateContact(contactData);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Enter.theValue(this.contactData.firstName).into(ContactsTargets.firstName),
      Enter.theValue(this.contactData.lastName).into(ContactsTargets.lastName),
      Enter.theValue(this.contactData.displayName).into(ContactsTargets.displayName),
      Enter.theValue(this.contactData.emailAddress).into(ContactsTargets.email),
      Enter.theValue(this.contactData.contactNumber).into(ContactsTargets.contactNumber),
      Click.on(ContactsTargets.save),
      SaveBrowserSource.toFile(this.contactData.firstName + this.contactData.lastName + "-post-save.html"),
      Wait.upTo(Duration.ofSeconds(20)).until(ContactsTargets.addAnotherContact, isVisible()),
      Click.on(ContactsTargets.addAnotherContact),
    );
  }

  constructor(public contactData: Contact) {
    super("Create Contact");
  }

}
