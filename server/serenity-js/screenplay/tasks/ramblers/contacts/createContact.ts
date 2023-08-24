import { Duration, PerformsActivities, Task } from "@serenity-js/core";
import { Click, Enter, isVisible, Wait } from "@serenity-js/protractor";
import { Contact } from "../../../questions/ramblers/contactListing";
import { ContactsTargets } from "../../../ui/ramblers/contactsTargets";
import { SaveBrowserSource } from "../../common/saveBrowserSource";

export class CreateContact implements Task {

  static usingData(contactData: Contact) {
    return new CreateContact(contactData);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Enter.theValue(this.contactData.firstName).into(ContactsTargets.firstName),
      Enter.theValue(this.contactData.lastName).into(ContactsTargets.lastName),
      Enter.theValue(this.contactData.displayName).into(ContactsTargets.displayName),
      Enter.theValue(this.contactData.email).into(ContactsTargets.email),
      Enter.theValue(this.contactData.contactNumber).into(ContactsTargets.contactNumber),
      Click.on(ContactsTargets.save),
      SaveBrowserSource.toFile(this.contactData.firstName + this.contactData.lastName + "-post-save.html"),
      Wait.upTo(Duration.ofSeconds(20)).until(ContactsTargets.addAnotherContact, isVisible()),
      Click.on(ContactsTargets.addAnotherContact),
    );
  }

  constructor(public contactData: Contact) {
  }

}
