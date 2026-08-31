import { describe, expect, it } from "vitest";
import { committeeDocumentSlug, meetingMinutesDocumentSlug } from "./committee-documents-page";

describe("meetingMinutesDocumentSlug", () => {

  it("is derived from the room, so it is unique per meeting even on the same day", () => {
    const first = meetingMinutesDocumentSlug("video-call-monday-31-august-2026-3895");
    const second = meetingMinutesDocumentSlug("video-call-monday-31-august-2026-7412");
    expect(first).toEqual("video-call-monday-31-august-2026-3895");
    expect(second).toEqual("video-call-monday-31-august-2026-7412");
    expect(first).not.toEqual(second);
  });

  it("stays the same regardless of the document title or file type, since it only uses the room", () => {
    const room = "video-call-monday-31-august-2026-3895";
    expect(meetingMinutesDocumentSlug(room)).toEqual(meetingMinutesDocumentSlug(room));
  });

});

describe("committeeDocumentSlug", () => {

  it("kebab-cases the title and date and tidies ordinals", () => {
    expect(committeeDocumentSlug("Agenda", "31st August 2026")).toEqual("agenda-31st-august-2026");
  });

});
