import { describe, it, test } from "@serenity-js/playwright-test";
import { Click } from "@serenity-js/web";
import { Contact } from "../screenplay/questions/ramblers/contact-listing";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { WaitFor } from "../screenplay/tasks/ramblers/common/wait-for";
import { CreateContact } from "../screenplay/tasks/ramblers/contacts/create-contact";
import { CreateContacts } from "../screenplay/tasks/ramblers/contacts/create-contacts";
import { ListContacts } from "../screenplay/tasks/ramblers/contacts/list-contacts";
import { SummariseContacts } from "../screenplay/tasks/ramblers/contacts/summarise-contacts";
import { ContactsTargets } from "../screenplay/ui/ramblers/contacts-targets";

describe("Ramblers contacts", function () {
  test.describe.configure({ timeout: 900 * 1000 });

  describe("Contacts listing", () => {
    const allContacts = [];
    it("allows scraping of all content", async ({ actorCalled }) => {
      const actor = actorCalled("nick");
      await actor.attemptsTo(
        Start.onContacts(),
        Login.toRamblers(),
        ListContacts.andAppendTo(allContacts),
        Click.on(ContactsTargets.page2),
        WaitFor.ramblersToFinishProcessing(),
        ListContacts.andAppendTo(allContacts),
        Click.on(ContactsTargets.page3),
        WaitFor.ramblersToFinishProcessing(),
        ListContacts.andAppendTo(allContacts),
        SummariseContacts.toFile(allContacts),
      );
    });

  });

  describe("Contacts individual creation", () => {
    it("allows creation of a single contact", async ({ actorCalled }) => {
      const actor = actorCalled("nick");
      await actor.attemptsTo(
        Start.onContacts(),
        Login.toRamblers(),
        CreateContact.usingData(new Contact("Person", "Surname", "Person C", "SurnamePerson@hotmail.com", "9999999 99999")),
      );
    });

  });

  describe("Contacts bulk creation", () => {
    it("allows creation of a single contact", async ({ actorCalled }) => {
      const actor = actorCalled("nick");
      await actor.attemptsTo(
        Start.onContacts(),
        Login.toRamblers(),
        Click.on(ContactsTargets.addContact),
        CreateContacts.usingData([
          {
            firstName: "FirstName",
            lastName: "LastName",
            displayName: "FirstName L",
            email: "FirstNameLastName@hotmail.com",
            contactNumber: "9999999 99999"
          },
        ]),
      );
    });

  });
});
