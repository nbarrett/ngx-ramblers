export function parseEnvContent(content: string): Record<string, string> {
  const secrets: Record<string, string> = {};

  content.split("\n").forEach((line: string) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const equalsIndex = trimmedLine.indexOf("=");
    if (equalsIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    const value = trimmedLine.slice(equalsIndex + 1).trim().replace(/^"|"$/g, "");

    if (key) {
      secrets[key] = value;
    }
  });

  return secrets;
}
