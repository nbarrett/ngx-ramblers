import {GroupEventSummary, GroupEventsFilter} from "../models/committee.model";
import {EmailComposerProgramme, ProgrammeEventFormat, ProgrammeEventSection, ProgrammeEventToken, PROGRAMME_EVENT_TEMPLATES} from "../models/email-composer.model";
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

export function programmeMarkdown(events: GroupEventSummary[], settings: EmailComposerProgramme, filter: GroupEventsFilter | null,
                                  dateLabel: (value: number) => string, emailMarkdown: Record<string, string> = {}): string {
  return events.filter(event => event.selected && !event.deleted)
    .sort((left, right) => left.eventDate - right.eventDate)
    .map(event => {
      const format = settings.eventFormats[event.id] || settings.format;
      const template = (format === ProgrammeEventFormat.CUSTOM ? settings.customTemplate : PROGRAMME_EVENT_TEMPLATES[format]).trim();
      const contact = [event.contactName, event.contactPhone, event.contactEmail].filter(Boolean).map(markdownText).join(" · ");
      const tokens: Record<ProgrammeEventToken, string> = {
        [ProgrammeEventToken.TITLE]: markdownText(event.title),
        [ProgrammeEventToken.DATE]: dateLabel(event.eventDate),
        [ProgrammeEventToken.TIME]: markdownText(event.eventTime),
        [ProgrammeEventToken.DISTANCE]: markdownText(event.distance),
        [ProgrammeEventToken.LOCATION]: filter?.includeLocation === false ? "" : markdownText(event.location),
        [ProgrammeEventToken.GRID_REFERENCE]: filter?.includeLocation === false ? "" : markdownLink(event.gridReference, event.mapUrl),
        [ProgrammeEventToken.POSTCODE]: filter?.includeLocation === false ? "" : markdownLink(event.postcode, event.mapUrl),
        [ProgrammeEventToken.CONTACT]: filter?.includeContact === false ? "" : contact,
        [ProgrammeEventToken.DESCRIPTION]: filter?.includeDescription === false ? "" : normaliseMarkdownText(event.description) || "",
        [ProgrammeEventToken.IMAGE]: filter?.includeImage && event.image ? markdownLink(event.title || "Event image", awsImageResourcePath(event.image), true) : ""
      };
      const markdown = format === ProgrammeEventFormat.EMAIL ? emailMarkdown[event.id] : template.replace(/\{\{\s*[a-z-]+\s*}}(?:[ \t]*·[ \t]*\{\{\s*[a-z-]+\s*}})*/g, group => {
        const value = [...group.matchAll(/\{\{\s*([a-z-]+)\s*}}/g)]
          .map(([match, token]) => tokens[token as ProgrammeEventToken] ?? match)
          .filter(value => value.trim()).join(" · ");
        return template.startsWith("|")
          ? value.replace(/\|/g, "&#124;").replace(/\r?\n/g, "<br>")
          : value;
      });
      if (markdown === null || markdown === undefined) {
        throw new Error("Choose an email template before generating the existing email layout.");
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
  return text && url && /^(https?:\/\/|\/(?!\/)|api\/aws\/s3\/)/i.test(url)
    ? `${image ? "!" : ""}[${text}](${url.replace(/[\s()<>]/g, character => encodeURIComponent(character))})`
    : image ? "" : text;
}
