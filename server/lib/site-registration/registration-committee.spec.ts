import expect from "expect";
import {describe, it} from "mocha";
import {PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {keys} from "es-toolkit/compat";
import {committeeMemberUpsert, importRegistrationCommittee, registrationCommitteeCandidates, registrationContactUsRows} from "./registration-committee";
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

  it("ignores role labels, placeholders and names that are not a person", async () => {
    const pages = [{path: "contact-us", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Webmaster\n\nWebmaster\n\nWalks Coordinator\n\n[Walk Leader Name]\n\nSecretary\n\nSam Jordan"}]}]}];
    expect(await registrationCommitteeCandidates(pages, {enabled: false} as any)).toEqual([
      {role: "Secretary", name: "Sam Jordan", email: ""}
    ]);
  });

  it("does not create committee members from walk pages", async () => {
    const pages = [{path: "walks/saturday", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Walk Leader\n\nSam Jordan"}]}]}];
    expect(await registrationCommitteeCandidates(pages, {enabled: false} as any)).toEqual([]);
  });

  it("does not infer committee members from ordinary prose", async () => {
    const pages = [{path: "about", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Our volunteers organise walks throughout the year."}]}]}];
    expect(await registrationCommitteeCandidates(pages, {enabled: false} as any)).toEqual([]);
  });

  it("creates members and assigns matching existing committee roles", async () => {
    const pages = [{path: "committee", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "**Chair:** Jane Doe <jane@example.org>"}]}]}];
    const captured = {roles: null as any, memberUpdate: null as any, contactRows: null as any};
    const chairman = {type: "chairman", description: "Chairman", email: "", fullName: "(Vacant)", roleType: RoleType.COMMITTEE_MEMBER, vacant: true};
    const db = {collection: (name: string) => name === "members" ? {
      find: () => ({toArray: async () => []}),
      findOneAndUpdate: async (_query, update) => {
        captured.memberUpdate = update;
        return {_id: {toString: () => "member-id"}, memberId: "member-id"};
      }
    } : name === "pageContent" ? {
      findOne: async () => null,
      updateOne: async (_query, update) => { captured.contactRows = update.$set.rows; }
    } : {
      findOne: async query => query.key === ConfigKey.COMMITTEE ? {key: ConfigKey.COMMITTEE, value: {roles: [chairman], contactUs: {chairman}, fileTypes: [], expenses: {costPerMile: 0.28}}} : null,
      updateOne: async (_query, update) => { captured.roles = update.$set["value.roles"]; }
    }} as any;
    const count = await importRegistrationCommittee(db, pages, {} as any, {enabled: false} as any);
    expect(count).toBe(1);
    expect(captured.roles).toEqual([expect.objectContaining({type: "chairman", fullName: "Jane Doe", memberId: "member-id", vacant: false})]);
    expect(keys(captured.memberUpdate.$set).filter(key => key in captured.memberUpdate.$setOnInsert)).toEqual([]);
    expect(captured.contactRows[1].columns[0].rows[0].columns[0].contentText).toContain("## Jane Doe");
    expect(captured.contactRows[1].columns[0].rows[0].columns[0].contentText).toContain("### Chair");
    expect(captured.contactRows[1].columns[0].rows[0].columns[0].contentText).toContain("?contact-us&role=chairman&redirect=contact-us");
    expect(captured.contactRows[1].columns[0].rows[0].columns[1].showPlaceholderImage).toBe(true);
  });

  it("reads a role heading, name link and phone number as published on a group contact page", async () => {
    const pages = [{path: "contact-us", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "## Contacts\n\nChairman\n\n[Pat Taylor](mailto:chairman@group.example)\n\n07700 900123\n\nSecretary\n\n[Sam Jordan](mailto:secretary@group.example)"}]}]}];
    expect(await registrationCommitteeCandidates(pages, {enabled: false} as any)).toEqual([
      {role: "Chairman", name: "Pat Taylor", email: "chairman@group.example", phone: "07700 900123"},
      {role: "Secretary", name: "Sam Jordan", email: "secretary@group.example"}
    ]);
  });

  it("builds contact-us cards with secure role links and no mailto addresses", () => {
    const rows = registrationContactUsRows(
      [{type: "secretary", description: "Secretary", fullName: "Sam Jordan", vacant: false, roleType: RoleType.COMMITTEE_MEMBER, email: "secretary@example.org", memberId: "1", nameAndDescription: "Sam Jordan - Secretary"}],
      [{role: "Secretary", name: "Sam Jordan", email: "secretary@example.org", phone: "07700 900456"}]
    );
    const heading = rows[1].columns[0].rows[0].columns[0].contentText;
    const photo = rows[1].columns[0].rows[0].columns[1];
    expect(rows[0].columns[0].contentText).toBe("# Contact Us");
    expect(heading).toContain("## Sam Jordan");
    expect(heading).toContain("### Secretary");
    expect(heading).toContain("[Contact Sam](?contact-us&role=secretary&redirect=contact-us)");
    expect(heading).not.toContain("07700 900456");
    expect(heading).not.toContain("mailto:");
    expect(heading).not.toContain("secretary@example.org");
    expect(photo.showPlaceholderImage).toBe(true);
    expect(photo.imageSource).toBe("");
    expect(rows[1].columns[0].rows[1].columns[0].contentText).toBe("Profile to follow....");
  });

  it("keeps the joining notes, drops the old comment form, and records where the page came from", () => {
    const rows = registrationContactUsRows(
      [{type: "publicity", description: "Publicity", fullName: "Lisa Ord", vacant: false, roleType: RoleType.COMMITTEE_MEMBER, email: "publicity@hikeessex.org.uk", memberId: "1", nameAndDescription: "Lisa Ord - Publicity"}],
      [{role: "Publicity", name: "Lisa Ord", email: "publicity@hikeessex.org.uk"}],
      [
        "Each button opens a secure form for that committee role.",
        "Profile to follow....",
        "If you want to join Hike Essex, please join the Ramblers and put Hike Essex (ES50) as your group.",
        "If you would like to join the committee, please fill in the form here",
        "Leave a Reply Cancel reply",
        "Your email address will not be published."
      ].join("\n"),
      null,
      "https://www.hikeessex.org.uk/contact-us/"
    );
    const prose = rows.find(row => row.type === PageContentType.TEXT && row.marginTop === 2)?.columns[0].contentText || "";
    const note = rows[rows.length - 1];
    expect(prose).toContain("If you want to join Hike Essex");
    expect(prose).not.toContain("Leave a Reply");
    expect(prose).not.toContain("fill in the form");
    expect(prose).not.toContain("Each button opens a secure form");
    expect(note.type).toBe(PageContentType.MIGRATION_NOTE);
    expect(note.migrationNote.sourceUrl).toBe("https://www.hikeessex.org.uk/contact-us/");
    expect(note.migrationNote.label).toBe("Migrated from");
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
