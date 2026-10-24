import { describe, expect, it } from "vitest";
import { marked } from "marked";
import { markdownOptions } from "./markdown-options";

describe("website Markdown image rendering", () => {
  it("renders stored object keys as website image URLs without changing the Markdown", () => {
    const markdown = `![Preview](site-content/app.png)\n\n<img src="logos/group.png" width="240">`;
    const html = marked.parse(markdown, {...markdownOptions(), async: false}) as string;
    expect(html).toContain(`src="/api/aws/s3/site-content/app.png"`);
    expect(html).toContain(`src="/api/aws/s3/logos/group.png"`);
    expect(markdown).not.toContain("api/aws/s3/");
  });
});
