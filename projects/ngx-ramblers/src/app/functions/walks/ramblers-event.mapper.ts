import { ExtendedGroupEvent, GroupEvent, InputSource } from "../../models/group-event.model";
import { LinkSource, LinkWithSource } from "../../models/walk.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";

export interface RamblersEventMapperOptions {
  inputSource: InputSource;
  migratedFromId?: string;
  displayNameBuilder?: (contactName: string) => string;
  localLinkBuilder?: (groupEvent: GroupEvent) => string | null;
  additionalLinksBuilder?: (groupEvent: GroupEvent) => LinkWithSource[];
}

interface ContactDetailsResult {
  contactName: string;
  displayName: string;
  email: string;
  phone: string;
  contactId: string;
}

export function mapRamblersEventToExtendedGroupEvent(groupEvent: GroupEvent, options: RamblersEventMapperOptions): ExtendedGroupEvent {
  const contactDetails = contactDetailsFrom(groupEvent, options.displayNameBuilder);
  const links = createLinks(groupEvent, options);

  return {
    groupEvent,
    fields: {
      inputSource: options.inputSource,
      migratedFromId: options.migratedFromId || null,
      attachment: null,
      attendees: [],
      contactDetails: {
        contactId: contactDetails.contactId,
        memberId: null,
        displayName: contactDetails.displayName,
        email: contactDetails.email,
        phone: contactDetails.phone
      },
      imageConfig: null,
      links,
      meetup: null,
      milesPerHour: 0,
      notifications: [],
      publishing: {
        ramblers: {
          publish: true,
          contactName: contactDetails.contactName
        },
        meetup: {
          publish: false,
          contactName: null
        }
      },
      riskAssessment: [],
      venue: null
    },
    events: []
  };
}

export function defaultDisplayName(contactName: string): string {
  if (!contactName) {
    return "";
  }
  const parts = contactName.trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");
  const initial = (lastName || "").trim().substring(0, 1).toUpperCase();
  return `${firstName} ${initial}`.trim();
}

function contactDetailsFrom(groupEvent: GroupEvent, displayNameBuilder?: (contactName: string) => string): ContactDetailsResult {
  const contact = groupEvent.item_type === RamblersEventType.GROUP_EVENT ? groupEvent.event_organiser : groupEvent.walk_leader;
  const contactName = contact?.name || "";
  const displayName = displayNameBuilder ? displayNameBuilder(contactName) : defaultDisplayName(contactName);
  return {
    contactName,
    displayName,
    email: contact?.email_form || null,
    phone: contact?.telephone || null,
    contactId: contact?.id || null
  };
}

function createLinks(groupEvent: GroupEvent, options: RamblersEventMapperOptions): LinkWithSource[] {
  const links: LinkWithSource[] = [];
  const isWalk = groupEvent.item_type === RamblersEventType.GROUP_WALK;

  if (options.localLinkBuilder) {
    const localLink = options.localLinkBuilder(groupEvent);
    if (localLink) {
      links.push({
        title: `this ${isWalk ? "walk" : "social event"}`,
        href: localLink,
        source: LinkSource.LOCAL
      });
    }
  }

  if (options.additionalLinksBuilder) {
    const additionalLinks = options.additionalLinksBuilder(groupEvent) || [];
    links.push(...additionalLinks.filter(link => link?.href));
  }

  if (groupEvent.url) {
    links.push({
      title: groupEvent.title,
      href: groupEvent.url,
      source: LinkSource.RAMBLERS
    });
  }

  return links;
}
