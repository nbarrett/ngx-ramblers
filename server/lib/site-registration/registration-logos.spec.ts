import expect from "expect";
import { describe, it } from "mocha";
import { RamblersDirectoryLogoKind } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {
  parseRamblersDirectoryLogoFileName, ramblersDirectoryLogoCandidates, ramblersDirectoryLogoSlug
} from "./registration-logos";

describe("registration-logos", () => {
  it("slugs group and area names used in the logo pack", () => {
    expect(ramblersDirectoryLogoSlug("Ashford (Kent)")).toBe("ashford-kent");
    expect(ramblersDirectoryLogoSlug("Cambridgeshire & Peterborough")).toBe("cambridgeshire-and-peterborough");
    expect(ramblersDirectoryLogoSlug("Berkshire Weekend Walkers ")).toBe("berkshire-weekend-walkers");
  });

  it("parses horizontal group and area filenames", () => {
    const group = parseRamblersDirectoryLogoFileName("Ramblers Group Logo Horizontal RGB Ashford (Kent).jpg");
    const area = parseRamblersDirectoryLogoFileName("Ramblers Area Logos Horizontal RGB Kent.jpg");
    expect(group).toEqual({
      kind: RamblersDirectoryLogoKind.GROUP_HORIZONTAL,
      displayName: "Ashford (Kent)",
      slug: "ashford-kent",
      originalFileName: "Ramblers Group Logo Horizontal RGB Ashford (Kent).jpg",
      awsFileName: "logos/group-horizontal-ashford-kent.jpg"
    });
    expect(area.kind).toEqual(RamblersDirectoryLogoKind.AREA_HORIZONTAL);
    expect(area.awsFileName).toEqual("logos/area-horizontal-kent.jpg");
  });

  it("prefers a group horizontal logo then the area horizontal logo", () => {
    const candidates = ramblersDirectoryLogoCandidates("Ashford (Kent)", "Kent");
    expect(candidates.map(item => item.awsFileName)).toEqual([
      "logos/group-horizontal-ashford-kent.jpg",
      "logos/group-horizontal-ashford-kent.png",
      "logos/area-horizontal-kent.jpg",
      "logos/area-horizontal-kent.png",
      "logos/group-vertical-ashford-kent.jpg",
      "logos/group-vertical-ashford-kent.png",
      "logos/area-vertical-kent.jpg",
      "logos/area-vertical-kent.png"
    ]);
  });

  it("tries the area name with and without a trailing Area for area logos", () => {
    const files = ramblersDirectoryLogoCandidates("Example Area", "Example Area").map(item => item.awsFileName);
    expect(files).toContain("logos/area-horizontal-example-area.jpg");
    expect(files).toContain("logos/area-horizontal-example.jpg");
  });

  it("parses the plural Group Logos filename used on a few groups", () => {
    const parsed = parseRamblersDirectoryLogoFileName("Ramblers Group Logos Horizontal RGB West Kent Walking Group.jpg");
    expect(parsed.slug).toBe("west-kent-walking-group");
    expect(parsed.kind).toBe(RamblersDirectoryLogoKind.GROUP_HORIZONTAL);
  });

  it("ignores files that are not directory logos", () => {
    expect(parseRamblersDirectoryLogoFileName("readme.txt")).toEqual(null);
  });
});
