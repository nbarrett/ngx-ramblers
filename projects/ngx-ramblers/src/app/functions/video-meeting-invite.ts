export function meetingInviteBodyMarkdown(input: {
  dateLabel: string;
  timeLabel: string;
  joinUrl: string;
  location: string;
  note: string;
  guestInstructions: string;
  signoff: string;
}): string {
  const note = (input.note || "").trim();
  const whereLines = [
    input.joinUrl ? `**Join:** ${input.joinUrl}` : "",
    input.location ? `**Where:** ${input.location}` : ""
  ].filter(Boolean).join("\n\n");
  const guidance = input.joinUrl
    ? `Open the link above to join the meeting. ${input.guestInstructions}`
    : "We look forward to seeing you there.";
  const signoff = (input.signoff || "").trim();
  return [
    "You are invited to a committee meeting.",
    note,
    `**When:** ${input.dateLabel} at ${input.timeLabel}`,
    whereLines,
    guidance,
    signoff
  ].filter(Boolean).join("\n\n");
}
