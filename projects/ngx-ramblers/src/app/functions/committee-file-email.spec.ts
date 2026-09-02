import {
  committeeFileEmailHtml,
  committeeMarkdownForEmail,
  hasCommitteeDocumentContent,
  resolvedCommitteeFileEmailInclude
} from "./committee-file-email";
import { CommitteeFile } from "../models/committee.model";
import { CommitteeFileEmailInclude } from "../models/email-composer.model";

describe("committee file email", () => {

  it("treats a markdown document as having content and strips page breaks before render", () => {
    const file = {document: {title: "Minutes", markdown: "# Hello\n\nPAGEBREAK\n\nWorld"}} as CommitteeFile;
    expect(hasCommitteeDocumentContent(file)).toBe(true);
    expect(hasCommitteeDocumentContent({document: {title: "Empty", markdown: "  "}} as CommitteeFile)).toBe(false);
    expect(committeeMarkdownForEmail("# Hello\n\nPAGEBREAK\n\nWorld")).toBe("# Hello\n\n\n\nWorld");
  });

  it("inlines markdown for content, the view button for link, and both when asked", () => {
    const markdown = "# Video call\n\nNick said hello.";
    const link = {href: "https://example.org/doc", label: "View Meeting minutes"};
    const sourcePage = {href: "https://example.org/committee/2026", groupName: "NGX-Ramblers", pageTitle: "committee / 2026"};
    const content = committeeFileEmailHtml({
      subject: "Minutes - Video call",
      markdown,
      link,
      sourcePage,
      include: CommitteeFileEmailInclude.CONTENT
    });
    expect(content).toContain("<h1>Video call</h1>");
    expect(content).toContain("Nick said hello.");
    expect(content).toContain("Also available on our NGX-Ramblers");
    expect(content).not.toContain("View Meeting minutes");
    expect(content).not.toContain("background-color: #F9B104");

    const button = committeeFileEmailHtml({
      subject: "Minutes - Video call",
      markdown,
      link,
      sourcePage,
      include: CommitteeFileEmailInclude.LINK
    });
    expect(button).toContain("View Meeting minutes");
    expect(button).toContain("background-color: #F9B104");
    expect(button).not.toContain("<h1>Video call</h1>");

    const both = committeeFileEmailHtml({
      subject: "Minutes - Video call",
      markdown,
      link,
      sourcePage,
      include: CommitteeFileEmailInclude.BOTH
    });
    expect(both).toContain("<h1>Video call</h1>");
    expect(both).toContain("View Meeting minutes");
    expect(both).toContain("background-color: #F9B104");
  });

  it("keeps the download button for files without markdown", () => {
    expect(resolvedCommitteeFileEmailInclude({document: {markdown: ""}}, CommitteeFileEmailInclude.CONTENT))
      .toBe(CommitteeFileEmailInclude.LINK);
    const html = committeeFileEmailHtml({
      subject: "Agenda - March",
      markdown: "",
      link: {href: "https://example.org/file.pdf", label: "Download Agenda"},
      sourcePage: null,
      include: CommitteeFileEmailInclude.CONTENT
    });
    expect(html).toContain("Download Agenda");
    expect(html).toContain("https://example.org/file.pdf");
    expect(html).toContain("background-color: #F9B104");
    expect(html).not.toContain("Also available");
  });
});
