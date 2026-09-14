import expect from "expect";
import {describe, it} from "mocha";
import {PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {registrationCommitteeCandidates} from "./registration-committee";

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
});
