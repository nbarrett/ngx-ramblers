import { describe, expect, it } from "vitest";
import { meetingInviteBodyMarkdown } from "./video-meeting-invite";

describe("meetingInviteBodyMarkdown", () => {

  it("includes a short note in the body so the meeting title can stay short", () => {
    const body = meetingInviteBodyMarkdown({
      dateLabel: "Wednesday 2 September 2026",
      timeLabel: "9:00 am",
      joinUrl: "https://example.org/video-meetings/guest/room-1",
      location: "",
      note: "Please have the walk reports to hand.",
      guestInstructions: "Allow the camera and microphone.",
      signoff: "Kind regards\n\nNick Barrett"
    });
    expect(body).toContain("You are invited to a committee meeting.");
    expect(body).toContain("Please have the walk reports to hand.");
    expect(body).toContain("**When:** Wednesday 2 September 2026 at 9:00 am");
    expect(body).toContain("**Join:** https://example.org/video-meetings/guest/room-1");
    expect(body).toContain("Kind regards");
    expect(body.indexOf("Please have the walk reports to hand.")).toBeLessThan(body.indexOf("**When:**"));
  });

  it("omits the note when none is given", () => {
    const body = meetingInviteBodyMarkdown({
      dateLabel: "Wednesday 2 September 2026",
      timeLabel: "9:00 am",
      joinUrl: "",
      location: "Village Hall",
      note: "  ",
      guestInstructions: "Allow the camera and microphone.",
      signoff: ""
    });
    expect(body).toContain("**Where:** Village Hall");
    expect(body).not.toContain("Please");
    expect(body).toContain("We look forward to seeing you there.");
  });

});
