export function apexHost(host: string | undefined | null): string {
  return (host || "").replace(/^www\./, "");
}
