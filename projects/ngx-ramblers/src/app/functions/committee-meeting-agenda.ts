export function committeeMeetingAgendaMarkdown(input: {
  heading: string;
  dateLine: string;
  joinUrl: string;
  itemsMarkdown: string;
}): string {
  return [
    `# ${input.heading}`,
    "",
    "## Agenda",
    "",
    `**Date:** ${input.dateLine}`,
    "",
    "**Location:** Online",
    "",
    `**Meeting link:** [${input.joinUrl}](${input.joinUrl})`,
    "",
    (input.itemsMarkdown || "").trim(),
    ""
  ].join("\n");
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
