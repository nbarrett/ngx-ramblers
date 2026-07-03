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
