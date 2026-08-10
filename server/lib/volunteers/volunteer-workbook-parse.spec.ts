import expect from "expect";
import { describe, it } from "mocha";
import { assignmentsFrom, contactsFrom, parishesFrom } from "./volunteer-import-upload";
import { VolunteerAssignmentScope } from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";

describe("generic volunteer workbook parsing", () => {
  it("maps the Parishes sheet to parish records keyed on ONS code", () => {
    const parishes = parishesFrom([
      {"parish code": "E04001129", "parish name": "Allhallows", "local authority": "Medway", "sector": "West Kent", "rights of way group": "Medway", "membership group": "Medway", "no public rights of way": "No", "notes": ""},
      {"parish code": "E04001131", "parish name": "Cooling", "no public rights of way": "Yes"},
      {"parish code": "", "parish name": "No code here"}
    ]);
    expect(parishes.length).toEqual(2);
    expect(parishes[0]).toEqual({reference: "E04001129", parishCode: "E04001129", parishName: "Allhallows", localAuthorityName: "Medway", sectorCode: "West Kent", rightsOfWayGroupCode: "Medway", membershipGroupCode: "Medway", noPublicRightsOfWay: false, notes: undefined});
    expect(parishes[1].noPublicRightsOfWay).toEqual(true);
  });

  it("links assignments to volunteers by email and derives the volunteer list", () => {
    const {assignments, volunteers} = assignmentsFrom([
      {"scope": "Parish", "covers": "E04001129", "role": "Local Footpath Officer", "volunteer email": "Ada.Lovelace@example.org", "volunteer name": "Ada Lovelace", "cover": "Permanent"},
      {"scope": "Parish", "covers": "E04001129", "role": "Parish Footpath Observer", "volunteer email": "ada.lovelace@example.org", "volunteer name": "Ada Lovelace", "cover": "Temporary"},
      {"scope": "Rights of Way Group", "covers": "Ashford", "role": "Group Coordinator", "volunteer email": "grace@example.org", "volunteer name": "Grace Hopper", "cover": "Permanent"}
    ]);
    expect(volunteers.length).toEqual(2);
    expect(volunteers[0]).toEqual({reference: "ada.lovelace@example.org", email: "Ada.Lovelace@example.org", firstName: "Ada", lastName: "Lovelace"});
    expect(assignments[0].parishReference).toEqual("E04001129");
    expect(assignments[0].scope).toEqual(VolunteerAssignmentScope.PARISH);
    expect(assignments[1].temporary).toEqual(true);
    const coordinator = assignments[2];
    expect(coordinator.scope).toEqual(VolunteerAssignmentScope.RIGHTS_OF_WAY_GROUP);
    expect(coordinator.scopeReference).toEqual("Ashford");
    expect(coordinator.parishReference).toEqual("");
  });

  it("maps the Contacts sheet, keeping rows with an email or organisation", () => {
    const contacts = contactsFrom([
      {"organisation": "Shoreham Parish Council", "contact name": "Amanda Barlow", "role": "Clerk", "email": "clerk@shoreham-pc.gov.uk", "parish code": "E04001129"},
      {"organisation": "", "contact name": "", "email": ""}
    ]);
    expect(contacts.length).toEqual(1);
    expect(contacts[0].organisationName).toEqual("Shoreham Parish Council");
    expect(contacts[0].parishReference).toEqual("E04001129");
  });
});
