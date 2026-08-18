export function trimmedOsMapsLogin(email: string, password: string): {email: string; password: string} {
  return {email: (email || "").trim(), password: (password || "").trim()};
}

export function uniqueOsMapsIdentityErrors(texts: string[]): string {
  return texts
    .map(text => text.trim())
    .filter(text => text.length > 0)
    .filter((text, index, all) => all.indexOf(text) === index)
    .join("; ");
}
