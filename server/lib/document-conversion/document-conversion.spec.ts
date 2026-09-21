import expect from "expect";
import { describe, it } from "mocha";
import AdmZip from "adm-zip";
import { convertBufferToMarkdown, convertHtmlToMarkdown, convertWordClipboardHtml, replacePdfImagePlaceholders } from "./document-conversion";

describe("clipboard HTML conversion", () => {
  it("reconstructs Word headings and pseudo lists and moves floating images after their paragraph", async () => {
    const html = `<p class="MsoTitle">Walk programme</p><p class="MsoSubtitle">Overview</p>
      <p class="BodyA">Choose “Add non-Sunday <img src="api/aws/s3/example.png" alt="Screenshot"> Walk”.</p>
      <p style="mso-list:l6 level1 lfo2"><span>1.   </span><b>Main Details</b></p>
      <p style="mso-list:l9 level1 lfo4"><span>·   </span>Walk Date</p>
      <p style="mso-list:l9 level1 lfo4"><span>·   </span>Start Time</p>`;
    const result = await convertWordClipboardHtml(html);
    expect(result.markdown).toContain("# Walk programme");
    expect(result.markdown).toContain("## Overview");
    expect(result.markdown).toContain("Choose “Add non-Sunday Walk”.");
    expect(result.markdown).toContain("![Screenshot](api/aws/s3/example.png)");
    expect(result.markdown.indexOf("Walk”.")).toBeLessThan(result.markdown.indexOf("![Screenshot]"));
    expect(result.markdown).toMatch(/1\.\s+\*\*Main Details\*\*/);
    expect(result.markdown).toMatch(/\* Walk Date\n\* Start Time/);
  });
  it("uses the document converter for paragraphs, lists, tables and uploaded images", async () => {
    const html = "<p>Overview.</p><p>We will soon be moving to a new platform provided by</p><p>NGX-Ramblers.</p>"
      + "<ul><li>Walk Date</li><li>Start Time</li></ul>"
      + "<table><tr><td>Role</td><td>Name</td></tr><tr><td>Leader</td><td>Sam</td></tr></table>"
      + "<p><img src=\"api/aws/s3/site-content/example.png\" alt=\"Screenshot\"></p>";
    const result = await convertHtmlToMarkdown(html);
    expect(result.markdown).toContain("* Walk Date");
    expect(result.markdown).toContain("| Role");
    expect(result.markdown).toContain("![Screenshot](api/aws/s3/site-content/example.png)");
  });
});

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

  it("supports a two-pass substitution: a collector echoing the placeholder defers replacement to a later pass", () => {
    const markdown = "## Section\n![](pdf-image:img_p0_1)\nbody text.";
    const collectorPass = replacePdfImagePlaceholders(markdown, new Map([["img_p0_1", "pdf-image:img_p0_1"]]));
    expect(collectorPass).toEqual(markdown);
    const finalPass = replacePdfImagePlaceholders(collectorPass, new Map([["img_p0_1", "api/aws/s3/committeeFiles/converted-images/real.png"]]));
    expect(finalPass).toEqual("## Section\n![](api/aws/s3/committeeFiles/converted-images/real.png)\nbody text.");
  });

  it("leaves ordinary markdown images alone", () => {
    const markdown = "![photo](https://example.com/photo.jpg)";
    expect(replacePdfImagePlaceholders(markdown, new Map())).toEqual(markdown);
  });

  it("replaces Word image placeholders while preserving their alt text and surrounding content", () => {
    const markdown = "Before ![Route map](pdf-image:docx-image-1) after";
    const imagePaths = new Map([["docx-image-1", "api/aws/s3/committeeFiles/converted-images/map.png"]]);
    expect(replacePdfImagePlaceholders(markdown, imagePaths)).toEqual("Before ![Route map](api/aws/s3/committeeFiles/converted-images/map.png) after");
  });
});

describe("convertBufferToMarkdown for Word documents", () => {

  it("uploads embedded images in document order and reports upload failures", async () => {
    const imageXml = `<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
                  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <w:body><w:p><w:r><w:t>Before image</w:t></w:r></w:p>
          <w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="image"/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
          <w:p><w:r><w:t>After image</w:t></w:r></w:p></w:body>
      </w:document>`;
    const imageRelationships = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image.png"/>
    </Relationships>`;
    const zip = new AdmZip(minimalDocx(imageXml, imageRelationships));
    zip.addFile("word/media/image.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/kXcAAAAASUVORK5CYII=", "base64"));
    const document = zip.toBuffer();
    const uploaded = await convertBufferToMarkdown(document, "images.docx", async image => {
      expect(image.buffer.subarray(0, 8).toString("hex")).toEqual("89504e470d0a1a0a");
      return "https://example.test/uploaded.png";
    });
    expect(uploaded.markdown).toContain("Before image");
    expect(uploaded.markdown).toContain("![](https://example.test/uploaded.png)");
    expect(uploaded.markdown).toContain("After image");
    expect(uploaded.markdown.indexOf("Before image")).toBeLessThan(uploaded.markdown.indexOf("![]("));
    expect(uploaded.markdown.indexOf("![](")).toBeLessThan(uploaded.markdown.indexOf("After image"));
    await expect(convertBufferToMarkdown(document, "images.docx", async () => null)).rejects.toThrow("Could not upload embedded image");
  });

  const documentXml = `<?xml version="1.0"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <w:body>
        <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>February 2026 Committee Meeting Agenda</w:t></w:r></w:p>
        <w:p>
          <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Zoom Link: </w:t></w:r>
          <w:hyperlink r:id="rId2"><w:r><w:t>Join the meeting</w:t></w:r></w:hyperlink>
        </w:p>
        <w:p><w:r><w:t xml:space="preserve">Developed since last meeting: onboarding </w:t></w:r><w:hyperlink r:id="rId3"><w:r><w:t>group.ngx-ramblers.org.uk</w:t></w:r></w:hyperlink></w:p>
        <w:p><w:r><w:t>The Ramblers' Association is a registered charity (England and Wales no 1093577).</w:t></w:r></w:p>
      </w:body>
    </w:document>`;

  const relationshipsXml = `<?xml version="1.0"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://us06web.zoom.us/j/3706479967" TargetMode="External"/>
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.group.ngx-ramblers.org.uk/" TargetMode="External"/>
    </Relationships>`;

  it("preserves embedded hyperlinks as markdown links", async () => {
    const result = await convertBufferToMarkdown(minimalDocx(documentXml, relationshipsXml), "agenda.docx");
    expect(result.markdown).toContain("[Join the meeting](https://us06web.zoom.us/j/3706479967)");
    expect(result.markdown).toContain("[group.ngx-ramblers.org.uk](https://www.group.ngx-ramblers.org.uk/)");
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
