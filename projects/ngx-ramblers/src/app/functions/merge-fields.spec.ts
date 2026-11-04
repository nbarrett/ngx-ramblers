import {appearanceForToken, exampleValueForToken, friendlyFieldLabel} from "./merge-fields";
import {MergeFieldAppearance, ProgrammeEventToken} from "../models/email-composer.model";

describe("programme event merge fields", () => {
  it("treats grid reference and postcode as links with sample values", () => {
    expect(appearanceForToken(ProgrammeEventToken.GRID_REFERENCE)).toBe(MergeFieldAppearance.LINK);
    expect(appearanceForToken(ProgrammeEventToken.POSTCODE)).toBe(MergeFieldAppearance.LINK);
    expect(exampleValueForToken(ProgrammeEventToken.GRID_REFERENCE)).toBe("TQ123456");
    expect(friendlyFieldLabel(ProgrammeEventToken.GRID_REFERENCE)).toBe("Grid reference");
  });

  it("treats the image token as an image placeholder", () => {
    expect(appearanceForToken(ProgrammeEventToken.IMAGE)).toBe(MergeFieldAppearance.IMAGE);
    expect(appearanceForToken("image:160")).toBe(MergeFieldAppearance.IMAGE);
    expect(friendlyFieldLabel("image:160")).toBe("Image");
  });

  it("exposes end time and other event fields with link appearance where the output is a link", () => {
    expect(friendlyFieldLabel(ProgrammeEventToken.END_TIME)).toBe("End time");
    expect(exampleValueForToken(ProgrammeEventToken.END_TIME)).toBe("4:00 pm");
    expect(friendlyFieldLabel(ProgrammeEventToken.GRADE)).toBe("Grade");
    expect(appearanceForToken(ProgrammeEventToken.MAP)).toBe(MergeFieldAppearance.LINK);
    expect(appearanceForToken(ProgrammeEventToken.EVENT_URL)).toBe(MergeFieldAppearance.LINK);
    expect(appearanceForToken(ProgrammeEventToken.CONTACT_EMAIL)).toBe(MergeFieldAppearance.LINK);
    expect(friendlyFieldLabel(ProgrammeEventToken.CONTACT_NAME)).toBe("Contact name");
    expect(exampleValueForToken(ProgrammeEventToken.EVENT_URL)).toBe("Event page");
  });
});
