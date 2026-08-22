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
