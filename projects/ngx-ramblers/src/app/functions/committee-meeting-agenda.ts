import { CommitteeFile, CommitteeMeetingFormat } from "../models/committee.model";

export function committeeMeetingLocationLine(format: CommitteeMeetingFormat, venue: string): string {
  if (format === CommitteeMeetingFormat.ONLINE) {
    return "Online";
  } else if (format === CommitteeMeetingFormat.HYBRID) {
    return venue ? `Online, and in person at ${venue}` : "Online and in person";
  } else {
    return venue || "In person";
  }
}

export function displayMeetingTitle(title: string): string {
  const trimmed = (title || "").trim();
  if (!trimmed || trimmed.toLowerCase() === "ramblers meeting") {
    return "";
  } else {
    return trimmed;
  }
}

export function committeeFileMeetingTitle(file: Pick<CommitteeFile, "fileType" | "document" | "fileNameData" | "meeting">): string {
  return displayMeetingTitle(file?.document?.title || file?.fileNameData?.title || file?.meeting?.title || file?.fileType) || "Unnamed meeting";
}

export function committeeMeetingHeading(title: string, typeDescription?: string | null): string {
  if (typeDescription?.trim()) {
    return typeDescription.trim();
  } else {
    return displayMeetingTitle(title).split(",")[0].trim() || "Committee meeting";
  }
}

export function committeeMeetingMinutesMarkdown(input: {
  heading: string;
  dateLine: string;
  location: string;
  bodyMarkdown: string;
}): string {
  const body = committeeMeetingMinutesBody(input.bodyMarkdown);
  return [
    `# ${input.heading}`,
    "",
    "## Minutes",
    "",
    `**Date:** ${input.dateLine}`,
    "",
    `**Location:** ${input.location}`,
    "",
    body,
    ""
  ].join("\n");
}

export function committeeMeetingMinutesBody(markdown: string): string {
  return (markdown || "")
    .replace(/^# [^\n]+\n+(?:## Minutes\n+)?(?:\*\*Date:\*\*.*\n+)?(?:\*\*Location:\*\*.*\n+)*/, "")
    .trim();
}

export function committeeMeetingAgendaMarkdown(input: {
  heading: string;
  dateLine: string;
  location: string;
  joinUrl?: string;
  itemsMarkdown: string;
}): string {
  const meetingLink = input.joinUrl ? [`**Meeting link:** [${input.joinUrl}](${input.joinUrl})`, ""] : [];
  return [
    `# ${input.heading}`,
    "",
    "## Agenda",
    "",
    `**Date:** ${input.dateLine}`,
    "",
    `**Location:** ${input.location}`,
    "",
    ...meetingLink,
    (input.itemsMarkdown || "").trim(),
    ""
  ].join("\n");
}

export function withCommitteeMeetingDateLine(markdown: string, dateLine: string): string {
  const source = markdown || "";
  if (/\*\*Date:\*\*/.test(source)) {
    return source.replace(/\*\*Date:\*\*.*/, `**Date:** ${dateLine}`);
  } else {
    return source;
  }
}

export function withCommitteeMeetingLocationLine(markdown: string, location: string): string {
  const source = markdown || "";
  if (/\*\*Location:\*\*/.test(source)) {
    return source.replace(/\*\*Location:\*\*.*/, `**Location:** ${location}`);
  } else {
    return source;
  }
}

export function withCommitteeMeetingLink(markdown: string, joinUrl: string): string {
  const source = markdown || "";
  const linkLine = `**Meeting link:** [${joinUrl}](${joinUrl})`;
  if (/\*\*Meeting link:\*\*.*/.test(source)) {
    return joinUrl
      ? source.replace(/\*\*Meeting link:\*\*.*/, linkLine)
      : source.replace(/\n*\*\*Meeting link:\*\*.*(\n|$)/, "\n\n");
  } else if (joinUrl && /\*\*Location:\*\*.*/.test(source)) {
    return source.replace(/(\*\*Location:\*\*.*)/, `$1\n\n${linkLine}`);
  } else {
    return source;
  }
}

export function numberedAgendaItemsFromGenerated(raw: string): string | null {
  const lines = (raw || "").trim().split("\n");
  const firstItem = lines.findIndex(line => /^\s*\d+\.\s/.test(line));
  if (firstItem < 0) {
    return null;
  } else {
    const items = lines.slice(firstItem).join("\n").trim();
    return items || null;
  }
}
