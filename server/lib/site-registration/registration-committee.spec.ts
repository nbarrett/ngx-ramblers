import expect from "expect";
import {describe, it} from "mocha";
import {PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {keys} from "es-toolkit/compat";
import {committeeMemberUpsert, importRegistrationCommittee, registrationCommitteeCandidates} from "./registration-committee";
import {RoleType} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {ConfigKey} from "../../../projects/ngx-ramblers/src/app/models/config.model";

describe("registration committee import", () => {
  it("extracts only committee details present in the migrated source content", async () => {
    const pages = [{path: "committee", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "## Committee\n\n**Chair:** Jane Doe <jane@example.org>\n\n**Treasurer:** John Smith"}]}]}];
    const candidates = await registrationCommitteeCandidates(pages, {enabled: false} as any);
    expect(candidates).toEqual([
      {role: "Chair", name: "Jane Doe", email: "jane@example.org"},
      {role: "Treasurer", name: "John Smith", email: ""}
    ]);
  });

  it("does not infer committee members from ordinary prose", async () => {
    const pages = [{path: "about", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Our volunteers organise walks throughout the year."}]}]}];
    expect(await registrationCommitteeCandidates(pages, {enabled: false} as any)).toEqual([]);
  });

  it("creates members and assigns matching existing committee roles", async () => {
    const pages = [{path: "committee", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "**Chair:** Jane Doe <jane@example.org>"}]}]}];
    const captured = {roles: null as any, memberUpdate: null as any};
    const chairman = {type: "chairman", description: "Chairman", email: "", fullName: "(Vacant)", roleType: RoleType.COMMITTEE_MEMBER, vacant: true};
    const db = {collection: (name: string) => name === "members" ? {
      findOneAndUpdate: async (_query, update) => {
        captured.memberUpdate = update;
        return {_id: {toString: () => "member-id"}, memberId: "member-id"};
      }
    } : {
      findOne: async query => query.key === ConfigKey.COMMITTEE ? {key: ConfigKey.COMMITTEE, value: {roles: [chairman], contactUs: {chairman}, fileTypes: [], expenses: {costPerMile: 0.28}}} : null,
      updateOne: async (_query, update) => { captured.roles = update.$set["value.roles"]; }
    }} as any;
    const count = await importRegistrationCommittee(db, pages, {} as any, {enabled: false} as any);
    expect(count).toBe(1);
    expect(captured.roles).toEqual([expect.objectContaining({type: "chairman", fullName: "Jane Doe", memberId: "member-id", vacant: false})]);
    expect(keys(captured.memberUpdate.$set).filter(key => key in captured.memberUpdate.$setOnInsert)).toEqual([]);
  });

  it("never names the same member field in both $set and $setOnInsert, which MongoDB rejects", () => {
    const update = committeeMemberUpsert({
      userName: "jane@example.org", email: "jane@example.org", firstName: "Jane", lastName: "Doe", displayName: "Jane Doe",
      groupMember: true, committee: true, revoked: false, createdDate: 1, createdBy: "site-registration", updatedDate: 1, updatedBy: "site-registration"
    });
    expect(keys(update.$set).filter(key => key in update.$setOnInsert)).toEqual([]);
    expect(update.$set).toEqual({committee: true, groupMember: true, updatedDate: 1, updatedBy: "site-registration"});
    expect(update.$setOnInsert).toEqual(expect.objectContaining({userName: "jane@example.org", createdBy: "site-registration", revoked: false}));
  });
});
