import expect from "expect";
import { Dirent, existsSync, readFileSync, readdirSync } from "fs";
import { relative, resolve } from "path";
import { describe, it } from "mocha";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry: Dirent) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
        ? [path]
        : [];
  });
}

function relativeSourcePath(root: string, file: string): string {
  return relative(root, file).replace(/\\/g, "/");
}

describe("external transactional mail boundary", () => {
  const workingDirectoryLibrary = resolve(process.cwd(), "lib");
  const libraryRoot = existsSync(resolve(workingDirectoryLibrary, "brevo"))
    ? workingDirectoryLibrary
    : resolve(process.cwd(), "server/lib");
  const sources = sourceFiles(libraryRoot);

  it("allows direct Brevo delivery only inside the adapter and named external notification boundaries", () => {
    const allowedOutsideAdapter = new Set([
      "alerts/admin-alerts.ts",
      "inbox/inbox-message-digest.ts",
      "video-meetings/send-guest-invite-email.ts"
    ]);
    const violations = sources
      .filter(file => readFileSync(file, "utf8").includes("transactionalEmails.sendTransacEmail"))
      .map(file => relativeSourcePath(libraryRoot, file))
      .filter(file => !file.startsWith("brevo/") && !allowedOutsideAdapter.has(file));
    expect(violations).toEqual([]);
  });

  it("allows the reusable transactional gateway only for the contact-us delivery adapter", () => {
    const violations = sources
      .filter(file => readFileSync(file, "utf8").includes("brevo/transactional-mail/send-transactional-mail"))
      .map(file => relativeSourcePath(libraryRoot, file))
      .filter(file => file !== "contact-us/resolve-and-send.ts");
    expect(violations).toEqual([]);
  });

  it("keeps video-meeting Brevo access inside the guest invitation boundary", () => {
    const videoMeetingRoot = resolve(libraryRoot, "video-meetings");
    const violations = sourceFiles(videoMeetingRoot)
      .filter(file => readFileSync(file, "utf8").includes("../brevo/"))
      .map(file => relativeSourcePath(videoMeetingRoot, file))
      .filter(file => file !== "send-guest-invite-email.ts");
    expect(violations).toEqual([]);
  });
});
