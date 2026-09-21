function isStandaloneBlock(line: string): boolean {
  return /^\s*$/.test(line)
    || /^\s{0,3}#{1,6}\s/.test(line)
    || /^\s*\|/.test(line)
    || /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function startsAccumulatingBlock(line: string): boolean {
  return /^\s{0,3}(?:[-*+]|\d+[.)])\s/.test(line) || /^\s{0,3}>/.test(line);
}

function isBlockLine(line: string): boolean {
  return isStandaloneBlock(line) || startsAccumulatingBlock(line);
}

export function hasSoftWrappedParagraph(text: string): boolean {
  const lines = text.split(/\r\n|\r|\n/);
  return lines.some((line, index) => index > 0 && !isBlockLine(line) && !isBlockLine(lines[index - 1]));
}

export function unwrapSoftLineBreaks(markdown: string): string {
  const lines = markdown.split(/\r\n|\r|\n/);
  const result: string[] = [];
  let current = "";
  let inCodeBlock = false;
  const flushCurrent = () => {
    if (current) {
      result.push(current);
      current = "";
    }
  };
  lines.forEach(line => {
    if (/^\s{0,3}```/.test(line)) {
      flushCurrent();
      result.push(line);
      inCodeBlock = !inCodeBlock;
    } else if (inCodeBlock) {
      result.push(line);
    } else if (isStandaloneBlock(line)) {
      flushCurrent();
      result.push(line);
    } else if (startsAccumulatingBlock(line)) {
      flushCurrent();
      current = line.replace(/[ \t]*\\?$/, "").replace(/\s+$/, "");
    } else {
      const cleaned = line.replace(/[ \t]*\\?$/, "").trim();
      current = current ? `${current} ${cleaned}` : cleaned;
    }
  });
  flushCurrent();
  return result.join("\n");
}

export function normaliseWordPasteMarkdown(markdown: string): string {
  const blocks = unwrapSoftLineBreaks(markdown).split(/\n{2,}/).map(block => block.trim().replace(/^[•·▪◦]\s*/, "- ")).filter(Boolean);
  const isStructured = (block: string) => /^(?:#{1,6}\s|[-*+](?:\s|$)|\d+[.)]\s|>\s|\||!\[|<img\b|```)/.test(block);
  return blocks.reduce<string[]>((joined, block) => {
    const previous = joined[joined.length - 1] || "";
    const previousComplete = /[.!?:;)]$/.test(previous);
    const continues = /^[a-z0-9£$(“‘]/.test(block) || previous.length >= 60 || /\b(?:the|a|an|of|to|for|on|with|from|by|at|and|or)$/i.test(previous)
      || (/^\S+$/.test(block) && !/[.!?:;)]$/.test(previous));
    const listContinuation = /^[-*+]\s/.test(previous) && !isStructured(block) && (/[–-]$/.test(previous) || /^[a-z]/.test(block) || /^\S+$/.test(block));
    if (previous === "-" && !isStructured(block)) {
      return [...joined.slice(0, -1), `- ${block}`];
    } else if (previous && !previousComplete && !isStructured(block) && (listContinuation || (!isStructured(previous) && continues))) {
      return [...joined.slice(0, -1), `${previous} ${block}`];
    } else {
      return [...joined, block];
    }
  }, []).join("\n\n");
}
