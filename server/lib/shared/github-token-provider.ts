import { execSync } from "child_process";

export class GitHubTokenProvider {
  token(): string | null {
    try {
      const output = execSync("gh auth token", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim();
      return output || null;
    } catch {
      return null;
    }
  }
}
