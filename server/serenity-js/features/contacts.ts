import { actorCalled } from "@serenity-js/core";
import { Click } from "@serenity-js/protractor";
import { Contact } from "../screenplay/questions/ramblers/contactListing";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { WaitFor } from "../screenplay/tasks/ramblers/common/waitFor";
import { CreateContact } from "../screenplay/tasks/ramblers/contacts/createContact";
import { CreateContacts } from "../screenplay/tasks/ramblers/contacts/createContacts";
import { ListContacts } from "../screenplay/tasks/ramblers/contacts/listContacts";
import { SummariseContacts } from "../screenplay/tasks/ramblers/contacts/summariseContacts";
import { ContactsTargets } from "../screenplay/ui/ramblers/contactsTargets";

describe("Ramblers contacts", function () {
  this.timeout(900 * 1000);
  const actor = actorCalled("nick");

  beforeEach(() =>
    actor.attemptsTo(
      Start.onContacts(),
      Login.toRamblers()));

  describe("Contacts listing", () => {
    const allContacts = [];
    it("allows scraping of all content", () => actor.attemptsTo(
      ListContacts.andAppendTo(allContacts),
      Click.on(ContactsTargets.page2),
      WaitFor.ramblersToFinishProcessing(),
      ListContacts.andAppendTo(allContacts),
      Click.on(ContactsTargets.page3),
      WaitFor.ramblersToFinishProcessing(),
      ListContacts.andAppendTo(allContacts),
      SummariseContacts.toFile(allContacts),
    ));

  });

  describe("Contacts individual creation", () => {
    it("allows creation of a single contact", () => actor.attemptsTo(
      CreateContact.usingData(new Contact("Caroline", "Courtney", "Caroline C", "courtneycaroline@hotmail.com", "07425 140196")),
    ));

  });

  describe("Contacts bulk creation", () => {
    it("allows creation of a single contact", () => actor.attemptsTo(
      Click.on(ContactsTargets.addContact),
      CreateContacts.usingData([
        {firstName: "Desiree", lastName: "Nel", displayName: "Des N", email: "desireenel@hotmail.com", contactNumber: "07741485170"},
      ]),
    ));

  });
});
