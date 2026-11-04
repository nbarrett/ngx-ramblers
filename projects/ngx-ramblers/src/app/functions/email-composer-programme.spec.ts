import {describe, expect, it} from "vitest";
import {programmeLocation, programmeMarkdown} from "./email-composer-programme";
import {GroupEventSummary, GroupEventsFilter} from "../models/committee.model";
import {EmailComposerProgramme, ProgrammeEventFormat, PROGRAMME_EVENT_TEMPLATES} from "../models/email-composer.model";
import {LocationDetails} from "../models/ramblers-walks-manager";
import {renderEmailComposerMarkdown} from "./email-composer-markdown";
import {StoredValue} from "../models/ui-actions";
import {Editor} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {Markdown} from "@tiptap/markdown";
import {Table, TableCell, TableHeader, TableRow} from "@tiptap/extension-table";
import {MergeField} from "../modules/common/tiptap-editor/merge-field.extension";

describe("editable event programme", () => {
  const first = {
    id: "walk-1", selected: true, eventDate: 1000, eventTime: "10:30", title: "Hillside Park",
    gridReference: "SU123456", mapUrl: "https://group.example.org.uk/locate?grid-ref=SU123456&lat=51.0000000&lon=-1.0000000",
    distance: "6 miles", location: "Village car park", postcode: "AB1 2CD",
    contactName: "Alex Reed", contactPhone: "01234 567890", contactEmail: "alex.reed@example.com",
    description: "A riverside walk.\n\nBring lunch."
  } as GroupEventSummary;
  const second = {...first, id: "walk-2", title: "Woodland trail", eventDate: 2000};
  const settings = (format = ProgrammeEventFormat.LISTING): EmailComposerProgramme => ({
    format, customTemplate: PROGRAMME_EVENT_TEMPLATES[ProgrammeEventFormat.CUSTOM], eventFormats: {}, markdown: null
  });
  const dateLabel = (value: number) => `Day ${value}`;

  it("generates one three-column listing in date order with linked grid references and editable descriptions", () => {
    const events = [second, {...first, id: "excluded", selected: false}, {...first, id: "deleted", deleted: true}, first];
    const markdown = programmeMarkdown(events, settings(), null, dateLabel);
    const html = renderEmailComposerMarkdown(markdown);
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html.match(/<tr/g)).toHaveLength(3);
    expect(html.indexOf("Hillside Park")).toBeLessThan(html.indexOf("Woodland trail"));
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector("a")?.getAttribute("href")).toBe(first.mapUrl);
    expect(html).toContain("SU123456</a>");
    expect(html).toContain("Alex Reed");
    expect(html).toContain("6 miles");
    expect(html).toContain("Bring lunch.");
    expect(events[0]).toBe(second);
  });

  it("honours information switches and keeps pipes and multiline descriptions inside their table cells", () => {
    const event = {...first, description: "Path A | Path B\n\nA second paragraph"};
    const filter = {includeLocation: false, includeContact: false, includeDescription: true} as GroupEventsFilter;
    const html = renderEmailComposerMarkdown(programmeMarkdown([event], settings(), filter, dateLabel));
    expect(html).not.toContain("Alex Reed");
    expect(html).not.toContain("SU123456");
    expect(html.match(/<td/g)).toHaveLength(3);
    expect(new DOMParser().parseFromString(html, "text/html").body.textContent).toContain("Path A | Path B");
    expect(html).toContain("A second paragraph");
  });

  it("supports per-event formats and a configurable event template", () => {
    const custom = {...settings(ProgrammeEventFormat.COMPACT), customTemplate: "## {{title}}\n\n{{grid-reference}}\n\n{{description}}",
      eventFormats: {[second.id]: ProgrammeEventFormat.CUSTOM}};
    const markdown = programmeMarkdown([first, second], custom, null, dateLabel);
    expect(markdown).toContain("### Hillside Park");
    expect(markdown).toContain("## Woodland trail");
    expect(markdown.match(/Bring lunch/g)).toHaveLength(1);
    expect(markdown).not.toContain("{{");
  });

  it.each([
    {eventTime: "10:30", distance: null, expected: "Day 1000 · 10:30"},
    {eventTime: null, distance: "6 miles", expected: "Day 1000 · 6 miles"},
    {eventTime: null, distance: null, expected: "Day 1000"}
  ])("renders detailed dates as bold Markdown when optional event details are missing: $expected", ({eventTime, distance, expected}) => {
    const markdown = programmeMarkdown([{...first, eventTime, distance}], settings(ProgrammeEventFormat.DETAILED), null, dateLabel);
    const html = new DOMParser().parseFromString(renderEmailComposerMarkdown(markdown), "text/html");
    expect(html.querySelector("strong")?.textContent).toBe(expected);
    expect(html.body.textContent).not.toContain("**");
    expect(markdown).not.toContain("· **");
  });

  it("reuses the existing email event content when the email layout is selected", () => {
    const markdown = programmeMarkdown([first], settings(ProgrammeEventFormat.EMAIL), null, dateLabel,
      {[first.id]: "## Hillside Park\n\n[View walk](https://group.example.org.uk/walks/hillside-park)"});
    expect(markdown).toContain("[View walk](https://group.example.org.uk/walks/hillside-park)");
    expect(() => programmeMarkdown([first], settings(ProgrammeEventFormat.EMAIL), null, dateLabel)).toThrow("Choose an email template");
  });

  it("renders stored event images as Markdown images and omits unsupported image URLs", () => {
    const filter = {includeImage: true} as GroupEventsFilter;
    const markdown = programmeMarkdown([{...first, image: "site-content/events/celebration.jpg"}], settings(ProgrammeEventFormat.DETAILED), filter, dateLabel);
    const html = new DOMParser().parseFromString(renderEmailComposerMarkdown(markdown), "text/html");
    expect(html.querySelector("img")?.getAttribute("src")).toBe("/api/aws/s3/site-content/events/celebration.jpg");
    const unsupported = programmeMarkdown([{...first, image: "javascript:alert(1)"}], settings(ProgrammeEventFormat.DETAILED), filter, dateLabel);
    expect(unsupported).not.toContain("!Hillside Park");
    expect(unsupported).not.toContain("javascript:");
  });

  it("takes the most precise available grid reference and opens it in the existing website locator", () => {
    expect(programmeLocation({latitude: 51, longitude: -1, grid_reference_6: "SU123456", grid_reference_10: "SU1234545678"} as LocationDetails))
      .toEqual({gridReference: "SU1234545678", mapUrl: `/locate?${StoredValue.GRID_REF}=SU1234545678&${StoredValue.LAT}=51.0000000&${StoredValue.LON}=-1.0000000`});
    expect(programmeLocation(null)).toEqual({gridReference: null, mapUrl: null});
  });

  it("preserves editable listing templates, line breaks and locator links through the rich text editor", () => {
    const templateEditor = new Editor({extensions: [StarterKit, Markdown, Table, TableCell, TableHeader, TableRow, MergeField],
      content: PROGRAMME_EVENT_TEMPLATES[ProgrammeEventFormat.LISTING], contentType: "markdown"});
    const outputEditor = new Editor({extensions: [StarterKit, Markdown, Table, TableCell, TableHeader, TableRow], content: ""});
    try {
      const savedTemplate = templateEditor.getMarkdown();
      expect(savedTemplate).toContain("{{grid-reference}}");
      const markdown = programmeMarkdown([first, second], {...settings(ProgrammeEventFormat.CUSTOM), customTemplate: savedTemplate}, null, dateLabel);
      outputEditor.commands.setContent(markdown, {contentType: "markdown"});
      const html = new DOMParser().parseFromString(renderEmailComposerMarkdown(outputEditor.getMarkdown()), "text/html");
      expect(html.querySelectorAll("table")).toHaveLength(1);
      expect(html.querySelectorAll("tbody tr"), JSON.stringify({savedTemplate, markdown, edited: outputEditor.getMarkdown()})).toHaveLength(2);
      expect(html.querySelector("tbody td")?.textContent).toContain("10:30");
      expect(html.querySelector("tbody td a")?.getAttribute("href")).toBe(first.mapUrl);
      expect(html.body.textContent).toContain("Bring lunch.");
    } finally {
      templateEditor.destroy();
      outputEditor.destroy();
    }
  });
});
