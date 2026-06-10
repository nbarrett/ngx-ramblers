import expect from "expect";
import { describe, it } from "mocha";
import AdmZip from "adm-zip";
import { convertBufferToMarkdown, replacePdfImagePlaceholders } from "./document-conversion";

function minimalDocx(documentXml: string, relationshipsXml: string): Buffer {
  const contentTypes = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const packageRels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(contentTypes));
  zip.addFile("_rels/.rels", Buffer.from(packageRels));
  zip.addFile("word/document.xml", Buffer.from(documentXml));
  zip.addFile("word/_rels/document.xml.rels", Buffer.from(relationshipsXml));
  return zip.toBuffer();
}

describe("replacePdfImagePlaceholders", () => {
  it("replaces uploaded image placeholders with markdown image references", () => {
    const markdown = "## Section\n![](pdf-image:img_p0_1)\nbody text.";
    const imagePaths = new Map([["img_p0_1", "api/aws/s3/committeeFiles/converted-images/abc.png"]]);
    expect(replacePdfImagePlaceholders(markdown, imagePaths)).toEqual("## Section\n![](api/aws/s3/committeeFiles/converted-images/abc.png)\nbody text.");
  });

  it("drops placeholders whose upload failed", () => {
    const markdown = "## Section\n![](pdf-image:img_p0_1)\nbody text.";
    const imagePaths = new Map([["img_p0_1", null]]);
    expect(replacePdfImagePlaceholders(markdown, imagePaths)).toEqual("## Section\nbody text.");
  });

  it("leaves ordinary markdown images alone", () => {
    const markdown = "![photo](https://example.com/photo.jpg)";
    expect(replacePdfImagePlaceholders(markdown, new Map())).toEqual(markdown);
  });
});

describe("convertBufferToMarkdown for Word documents", () => {

  const documentXml = `<?xml version="1.0"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <w:body>
        <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>February 2026 Committee Meeting Agenda</w:t></w:r></w:p>
        <w:p>
          <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Zoom Link: </w:t></w:r>
          <w:hyperlink r:id="rId2"><w:r><w:t>Join the meeting</w:t></w:r></w:hyperlink>
        </w:p>
        <w:p><w:r><w:t xml:space="preserve">Developed since last meeting: onboarding </w:t></w:r><w:hyperlink r:id="rId3"><w:r><w:t>northwestkent.ngx-ramblers.org.uk</w:t></w:r></w:hyperlink></w:p>
        <w:p><w:r><w:t>The Ramblers' Association is a registered charity (England and Wales no 1093577).</w:t></w:r></w:p>
      </w:body>
    </w:document>`;

  const relationshipsXml = `<?xml version="1.0"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://us06web.zoom.us/j/3706479967" TargetMode="External"/>
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.northwestkent.ngx-ramblers.org.uk/" TargetMode="External"/>
    </Relationships>`;

  it("preserves embedded hyperlinks as markdown links", async () => {
    const result = await convertBufferToMarkdown(minimalDocx(documentXml, relationshipsXml), "agenda.docx");
    expect(result.markdown).toContain("[Join the meeting](https://us06web.zoom.us/j/3706479967)");
    expect(result.markdown).toContain("[northwestkent.ngx-ramblers.org.uk](https://www.northwestkent.ngx-ramblers.org.uk/)");
  });

  it("promotes the leading bold paragraph to the title and suggests it", async () => {
    const result = await convertBufferToMarkdown(minimalDocx(documentXml, relationshipsXml), "agenda.docx");
    expect(result.markdown.startsWith("# February 2026 Committee Meeting Agenda")).toBe(true);
    expect(result.suggestedTitle).toEqual("February 2026 Committee Meeting Agenda");
  });

  it("keeps the bold label ahead of a link and strips charity boilerplate", async () => {
    const result = await convertBufferToMarkdown(minimalDocx(documentXml, relationshipsXml), "agenda.docx");
    expect(result.markdown).toContain("**Zoom Link:** [Join the meeting]");
    expect(result.markdown).not.toContain("registered charity");
  });

  it("converts Word tables to markdown tables, keeping rows that contain emails", async () => {
    const tableDocumentXml = `<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Date</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Walk</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Leader</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Wed 01/10</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Shoreham Circular</w:t></w:r></w:p><w:p><w:r><w:t>10 miles</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>mike@example.com</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
        </w:body>
      </w:document>`;
    const emptyRelationships = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
    const result = await convertBufferToMarkdown(minimalDocx(tableDocumentXml, emptyRelationships), "programme.docx");
    expect(result.markdown).toContain("| Date | Walk | Leader |");
    expect(result.markdown).toContain("| --- | --- | --- |");
    expect(result.markdown).toContain("| Wed 01/10 | Shoreham Circular 10 miles | mike@example.com |");
  });

  it("declines old binary .doc files with a clear message", async () => {
    await expect(convertBufferToMarkdown(Buffer.from("legacy"), "minutes.doc")).rejects.toThrow("not supported");
  });
});
