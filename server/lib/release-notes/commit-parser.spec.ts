import expect from "expect";
import { describe, it } from "mocha";
import { parseCommit } from "./commit-parser";

describe("commit-parser", () => {

  describe("parseCommit", () => {

    function createRawCommit(subject: string, body: string = ""): string {
      const lines = [
        "abc123def456",
        "abc123d",
        "2026-01-20",
        subject
      ];
      if (body) {
        lines.push("");
        lines.push(body);
      }
      return lines.join("\n");
    }

    describe("issue reference extraction", () => {

      it("should extract issue from ref: #123 in subject", () => {
        const raw = createRawCommit("feat(scope): add feature (ref: #123)");
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("123");
      });

      it("should extract issue from fixes #456 in subject", () => {
        const raw = createRawCommit("fix(bug): resolve issue fixes #456");
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("456");
        expect(result?.issueReferences[0].action).toEqual("fixes");
      });

      it("should extract issue from closes #789 in subject", () => {
        const raw = createRawCommit("feat: complete feature closes #789");
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("789");
        expect(result?.issueReferences[0].action).toEqual("closes");
      });

      it("should extract standalone #120 from body", () => {
        const raw = createRawCommit(
          "feat(album): add focal point picker",
          "Implements adjustable crop positioning (#120)."
        );
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("120");
      });

      it("should extract standalone #120 at start of line", () => {
        const raw = createRawCommit(
          "feat: add feature",
          "#120 is the related issue"
        );
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("120");
      });

      it("should extract standalone #120 after space", () => {
        const raw = createRawCommit(
          "feat: add feature",
          "Related to #120 for tracking"
        );
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("120");
      });

      it("should extract multiple issues from body", () => {
        const raw = createRawCommit(
          "feat: add feature",
          "This addresses #100 and also relates to #200"
        );
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(2);
        expect(result?.issueReferences.map(r => r.issue)).toEqual(["100", "200"]);
      });

      it("should not duplicate issues found by both patterns", () => {
        const raw = createRawCommit(
          "feat: add feature ref: #123",
          "More details about #123 here"
        );
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("123");
      });

      it("should extract issue from GitHub URL", () => {
        const raw = createRawCommit(
          "feat: add feature",
          "See https://github.com/owner/repo/issues/456"
        );
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(1);
        expect(result?.issueReferences[0].issue).toEqual("456");
      });

      it("should return empty array when no issues referenced", () => {
        const raw = createRawCommit("feat: add feature without issue");
        const result = parseCommit(raw);
        expect(result?.issueReferences).toHaveLength(0);
      });

    });

    describe("conventional commit parsing", () => {

      it("should parse type and scope", () => {
        const raw = createRawCommit("feat(auth): add login feature");
        const result = parseCommit(raw);
        expect(result?.type).toEqual("feat");
        expect(result?.scope).toEqual("auth");
        expect(result?.subject).toEqual("add login feature");
      });

      it("should parse type without scope", () => {
        const raw = createRawCommit("fix: resolve bug");
        const result = parseCommit(raw);
        expect(result?.type).toEqual("fix");
        expect(result?.scope).toBeNull();
        expect(result?.subject).toEqual("resolve bug");
      });

      it("should detect breaking change marker", () => {
        const raw = createRawCommit("feat(api)!: change response format");
        const result = parseCommit(raw);
        expect(result?.breakingChange).toBe(true);
      });

      it("should parse body content", () => {
        const raw = createRawCommit(
          "feat: add feature",
          "This is the body content.\nWith multiple lines."
        );
        const result = parseCommit(raw);
        expect(result?.body).toContain("This is the body content");
      });

    });

  });

});
