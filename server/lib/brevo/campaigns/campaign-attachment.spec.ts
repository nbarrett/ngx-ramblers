import expect from "expect";
import { describe, it } from "mocha";
import { attachmentExtensionFromUrl, meetingRoomFromAttachmentUrl } from "./campaign-attachment";

describe("campaign attachment URLs", () => {

  it("reads the extension from the last path segment", () => {
    expect(attachmentExtensionFromUrl("https://www.ekwg.co.uk/api/calendar/meeting/ngx-room.ics")).toEqual("ics");
    expect(attachmentExtensionFromUrl("https://www.ekwg.co.uk/api/aws/s3/email-attachments/file.pdf")).toEqual("pdf");
  });

  it("treats a calendar meeting URL with no extension as having none", () => {
    expect(attachmentExtensionFromUrl("http://localhost:4200/api/calendar/meeting/ngx-4lrfx7-caqrtx-3ahfr6")).toEqual("");
  });

  it("extracts the meeting room from a calendar attachment URL", () => {
    expect(meetingRoomFromAttachmentUrl("http://localhost:4200/api/calendar/meeting/ngx-4lrfx7-caqrtx-3ahfr6"))
      .toEqual("ngx-4lrfx7-caqrtx-3ahfr6");
    expect(meetingRoomFromAttachmentUrl("https://www.ekwg.co.uk/api/calendar/meeting/ngx-room.ics"))
      .toEqual("ngx-room");
  });

  it("returns null when the URL is not a meeting calendar", () => {
    expect(meetingRoomFromAttachmentUrl("https://www.ekwg.co.uk/api/aws/s3/email-attachments/notes.pdf")).toEqual(null);
  });

});
