import {GroupEventSummary, GroupEventsFilter} from "../models/committee.model";
import {EmailComposerProgramme, EVENT_EMAIL_IMAGE_HEIGHT, ProgrammeEventFormat, ProgrammeEventSection, ProgrammeEventToken, PROGRAMME_EVENT_TEMPLATES} from "../models/email-composer.model";
import {LocationDetails} from "../models/ramblers-walks-manager";
import {locatePagePath} from "./locate";
import {normaliseMarkdownText} from "./markdown";
import {awsImageResourcePath} from "./aws-image-paths";

export function programmeLocation(location: LocationDetails | null): Pick<GroupEventSummary, "gridReference" | "mapUrl"> {
  return {
    gridReference: location?.grid_reference_10 || location?.grid_reference_8 || location?.grid_reference_6 || null,
    mapUrl: location ? locatePagePath({
      lat: location.latitude, lon: location.longitude,
      gridRef: location.grid_reference_10 || location.grid_reference_8 || location.grid_reference_6 || null,
      postcode: location.postcode
    }) : null
  };
}

export function programmeEventFieldName(token: string): string {
  const match = /^(image):(\d+)$/.exec((token || "").trim());
  return match ? match[1] : (token || "").trim();
}

export function programmeImageMergeToken(height: number): string {
  return `${ProgrammeEventToken.IMAGE}:${height}`;
}

export function programmeImageHeightFromMarkdown(markdown: string, fallback = EVENT_EMAIL_IMAGE_HEIGHT): number {
  const match = /\{\{\s*image:(\d+)\s*}}/.exec(markdown || "");
  return match ? Number(match[1]) : fallback;
}

export function programmeMarkdown(events: GroupEventSummary[], settings: EmailComposerProgramme, filter: GroupEventsFilter | null,
                                  dateLabel: (value: number) => string, emailMarkdown: Record<string, string> = {}): string {
  return events.filter(event => event.selected && !event.deleted)
    .sort((left, right) => left.eventDate - right.eventDate)
    .map(event => {
      const format = settings.eventFormats[event.id] || settings.format;
      const template = (format === ProgrammeEventFormat.CUSTOM || (format === settings.format && settings.templateId) ? settings.customTemplate : PROGRAMME_EVENT_TEMPLATES[format]).trim();
      const hideLocation = filter?.includeLocation === false;
      const hideContact = filter?.includeContact === false;
      const contact = [event.contactName, event.contactPhone, event.contactEmail].filter(Boolean).map(markdownText).join(" · ");
      const tokens: Record<ProgrammeEventToken, string> = {
        [ProgrammeEventToken.TITLE]: markdownText(event.title),
        [ProgrammeEventToken.DATE]: dateLabel(event.eventDate),
        [ProgrammeEventToken.TIME]: markdownText(event.eventTime),
        [ProgrammeEventToken.END_TIME]: markdownText(event.eventEndTime),
        [ProgrammeEventToken.DISTANCE]: markdownText(event.distance),
        [ProgrammeEventToken.GRADE]: markdownText(event.grade),
        [ProgrammeEventToken.ASCENT]: markdownText(event.ascent),
        [ProgrammeEventToken.SHAPE]: markdownText(event.shape),
        [ProgrammeEventToken.LOCATION]: hideLocation ? "" : markdownText(event.location),
        [ProgrammeEventToken.GRID_REFERENCE]: hideLocation ? "" : markdownLink(event.gridReference, event.mapUrl),
        [ProgrammeEventToken.POSTCODE]: hideLocation ? "" : markdownLink(event.postcode, event.mapUrl),
        [ProgrammeEventToken.MAP]: hideLocation ? "" : markdownLink("Map", event.mapUrl),
        [ProgrammeEventToken.CONTACT]: hideContact ? "" : contact,
        [ProgrammeEventToken.CONTACT_NAME]: hideContact ? "" : markdownText(event.contactName),
        [ProgrammeEventToken.CONTACT_PHONE]: hideContact ? "" : markdownText(event.contactPhone),
        [ProgrammeEventToken.CONTACT_EMAIL]: hideContact ? "" : markdownLink(event.contactEmail, event.contactHref),
        [ProgrammeEventToken.EVENT_URL]: markdownLink("Event page", event.eventUrl),
        [ProgrammeEventToken.DESCRIPTION]: filter?.includeDescription === false ? "" : normaliseMarkdownText(event.description) || "",
        [ProgrammeEventToken.IMAGE]: filter?.includeImage && event.image ? markdownLink(event.title || "Event image", awsImageResourcePath(event.image), true) : ""
      };
      const markdown = format === ProgrammeEventFormat.EMAIL ? emailMarkdown[event.id] : template.replace(/\{\{\s*[a-z-]+(?::\d+)?\s*}}(?:[ \t]*·[ \t]*\{\{\s*[a-z-]+(?::\d+)?\s*}})*/g, group => {
        const value = [...group.matchAll(/\{\{\s*([a-z-]+(?::\d+)?)\s*}}/g)]
          .map(([match, token]) => tokens[programmeEventFieldName(token) as ProgrammeEventToken] ?? match)
          .filter(value => value.trim()).join(" · ");
        return template.startsWith("|")
          ? value.replace(/\|/g, "&#124;").replace(/\r?\n/g, "<br>")
          : value;
      });
      if (markdown === null || markdown === undefined) {
        throw new Error("Choose an email template before generating the default layout.");
      }
      return {format, markdown: markdown
        .replace(/\n{3,}/g, "\n\n").trim()};
    }).reduce((sections: ProgrammeEventSection[], event) => {
      const previous = sections[sections.length - 1];
      const tableHeading = event.markdown.split("\n").slice(0, 2).join("\n");
      const table = /^\|.*\n\|\s*:?-{3}/.test(tableHeading);
      if (table && previous?.markdown.startsWith(`${tableHeading}\n`)) {
        return [...sections.slice(0, -1), {...previous, markdown: `${previous.markdown}\n${event.markdown.split("\n").slice(2).join("\n")}`}];
      } else {
        return [...sections, event];
      }
    }, []).map(section => section.markdown).join("\n\n");
}

function markdownText(value: string | null): string {
  return (value || "").replace(/[\\`*_[\]<>]/g, "\\$&").replace(/\r?\n/g, " ");
}

function markdownLink(label: string | null, url: string | null, image = false): string {
  const text = markdownText(label);
  return text && url && /^(https?:\/\/|mailto:|\/(?!\/)|api\/aws\/s3\/)/i.test(url)
    ? `${image ? "!" : ""}[${text}](${url.replace(/[\s()<>]/g, character => encodeURIComponent(character))})`
    : image ? "" : text;
}
