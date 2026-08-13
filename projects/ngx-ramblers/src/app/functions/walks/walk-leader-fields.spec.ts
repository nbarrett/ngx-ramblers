import { describe, expect, it } from "vitest";
import {
  remoteWalksManagerContactNameForCompare,
  walkLeaderFirstNameForAlbumThanks,
  websiteWalkLeaderDisplayName,
  walksManagerContactNamesForCsv,
  walksManagerWalkLeaderNameFromGroupEvent
} from "./walk-leader-fields";

describe("walk leader field accessors", () => {
  it("reads website display name only from contactDetails.displayName", () => {
    const walk = {
      fields: {
        contactDetails: {displayName: "Kerry O"},
        publishing: {ramblers: {contactName: "Kerry O'Grady", publish: true}}
      },
      groupEvent: {walk_leader: {name: "Kerry O'Grady"}}
    } as any;

    expect(websiteWalkLeaderDisplayName(walk)).toBe("Kerry O");
    expect(walksManagerContactNamesForCsv(walk)).toBe("Kerry O'Grady");
    expect(walksManagerWalkLeaderNameFromGroupEvent(walk.groupEvent)).toBe("Kerry O'Grady");
  });

  it("credits the locally held walk leader for album thanks rather than the Ramblers contact name", () => {
    const walk = {
      fields: {
        contactDetails: {displayName: "Kerry O'Grady"},
        publishing: {ramblers: {contactName: "Someone Else", publish: true}}
      }
    } as any;

    expect(walkLeaderFirstNameForAlbumThanks(walk)).toBe("Kerry");
  });

  it("falls back to the Ramblers contact name only when nothing is held locally", () => {
    const walk = {
      fields: {
        contactDetails: {displayName: ""},
        publishing: {ramblers: {contactName: "Kerry O'Grady", publish: true}}
      }
    } as any;

    expect(walkLeaderFirstNameForAlbumThanks(walk)).toBe("Kerry");
  });

  it("returns nothing to credit when neither source holds a leader", () => {
    const walk = {fields: {contactDetails: {displayName: ""}, publishing: {ramblers: {contactName: null}}}} as any;

    expect(walkLeaderFirstNameForAlbumThanks(walk)).toBe("");
  });

  it("uses first name from Walks Manager contact name for album thanks, not jammed display names", () => {
    const walk = {
      fields: {
        contactDetails: {displayName: "JayneM"},
        publishing: {ramblers: {contactName: "Jayne Mattocks", publish: true}}
      }
    } as any;

    expect(walkLeaderFirstNameForAlbumThanks(walk)).toBe("Jayne");
  });

  it("falls back to the first word of a spaced display name for album thanks", () => {
    const walk = {
      fields: {
        contactDetails: {displayName: "Nick B"},
        publishing: {ramblers: {contactName: null, publish: true}}
      }
    } as any;

    expect(walkLeaderFirstNameForAlbumThanks(walk)).toBe("Nick");
  });

  it("never falls back from contact name to display name for CSV", () => {
    const walk = {
      fields: {
        contactDetails: {displayName: "Nick B"},
        publishing: {ramblers: {contactName: null, publish: true}}
      }
    } as any;

    expect(websiteWalkLeaderDisplayName(walk)).toBe("Nick B");
    expect(walksManagerContactNamesForCsv(walk)).toBe("");
  });

  it("blends live Walks Manager listed name with prior history contact name", () => {
    expect(remoteWalksManagerContactNameForCompare("Deborah Kellond", "Nick Barrett")).toBe("Deborah Kellond");
    expect(remoteWalksManagerContactNameForCompare("", "Deborah Kellond")).toBe("Deborah Kellond");
    expect(remoteWalksManagerContactNameForCompare("", "")).toBe("");
  });
});
