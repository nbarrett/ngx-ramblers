export type IntroTitledPastePlan =
  | { apply: false }
  | { apply: true; subject: string | null; body: string };

export function extractLeadingTitle(content: string): { title: string; body: string } | null {
  const lines = content.split(/\r?\n/);
  const firstNonBlankIdx = lines.findIndex(line => line.trim() !== "");
  let result: { title: string; body: string } | null = null;
  if (firstNonBlankIdx !== -1) {
    const match = lines[firstNonBlankIdx].trim().match(/^#{1,2}\s+(.+?)\s*#*\s*$/);
    if (match) {
      const body = lines.slice(firstNonBlankIdx + 1).join("\n").replace(/^\n+/, "");
      result = { title: match[1].trim(), body };
    }
  }
  return result;
}

export function shouldRunIntroSmartPaste(brandingIsUnbranded: boolean, isInboxReply: boolean): boolean {
  return brandingIsUnbranded && !isInboxReply;
}

export function planTitledIntroPaste(
  pasteText: string,
  titled: { title: string; body: string },
  existingSubject: string,
  hasExistingIntro: boolean
): IntroTitledPastePlan {
  let plan: IntroTitledPastePlan = { apply: false };
  if (!hasExistingIntro) {
    const subjectWasEmpty = !existingSubject?.trim();
    plan = {
      apply: true,
      subject: subjectWasEmpty ? titled.title : null,
      body: subjectWasEmpty ? titled.body : pasteText
    };
  }
  return plan;
}

export function placeForwardedIntroMarkdown(
  existingIntro: string,
  forwardedMarkdown: string,
  preferAboveExisting: boolean
): string {
  const existing = existingIntro ?? "";
  const hasExisting = existing.trim().length > 0;
  let result = forwardedMarkdown;
  if (hasExisting) {
    result = preferAboveExisting
      ? `${forwardedMarkdown}${existing.startsWith("\n") ? "" : "\n"}${existing}`
      : `${existing}${forwardedMarkdown}`;
  }
  return result;
}
