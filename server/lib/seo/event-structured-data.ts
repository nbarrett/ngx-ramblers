import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { LocationDetails, WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  SchemaOrgEvent,
  SchemaOrgEventStatus,
  SchemaOrgOffer,
  SchemaOrgOfferAvailability,
  SchemaOrgPerformerType,
  SchemaOrgPlace
} from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { eventUrlFor } from "../shared/event-url";
import { dateTimeFromIsoWithZone } from "../shared/dates";
import { walkLeaderDisplayName } from "../../../projects/ngx-ramblers/src/app/functions/walks/walk-leader-fields";

const OFFLINE_ATTENDANCE_MODE = "https://schema.org/OfflineEventAttendanceMode";

function plainTextFromMarkdown(markdown: string): string {
  return (markdown || "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function schemaOrgPlace(location: LocationDetails): SchemaOrgPlace {
  const name = location?.description || location?.postcode;
  if (name) {
    const place: SchemaOrgPlace = {"@type": "Place", name};
    const address = [location?.description, location?.postcode].filter(Boolean).join(", ");
    if (address) {
      place.address = address;
    }
    if (location?.latitude && location?.longitude) {
      place.geo = {"@type": "GeoCoordinates", latitude: location.latitude, longitude: location.longitude};
    }
    return place;
  } else {
    return null;
  }
}

function isoOrNull(value: string): string {
  const dateTime = value ? dateTimeFromIsoWithZone(value) : null;
  return dateTime?.isValid ? dateTime.toISO() : null;
}

export function eventStructuredData(
  event: ExtendedGroupEvent,
  config: SystemConfig,
  baseUrl: string,
  imageUrls: string[]
): SchemaOrgEvent {
  const groupEvent = event?.groupEvent;
  if (groupEvent?.title) {
    const location = schemaOrgPlace(groupEvent.start_location || groupEvent.location);
    const structuredData: SchemaOrgEvent = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: groupEvent.title,
      eventStatus: groupEvent.status === WalkStatus.CANCELLED
        ? SchemaOrgEventStatus.CANCELLED
        : SchemaOrgEventStatus.SCHEDULED,
      eventAttendanceMode: OFFLINE_ATTENDANCE_MODE
    };
    const description = plainTextFromMarkdown(groupEvent.description);
    if (description) {
      structuredData.description = description;
    }
    const startDate = isoOrNull(groupEvent.start_date_time);
    if (startDate) {
      structuredData.startDate = startDate;
    }
    const endDate = isoOrNull(groupEvent.end_date_time);
    if (endDate) {
      structuredData.endDate = endDate;
    }
    const url = eventUrlFor(event, config?.group, baseUrl);
    if (url) {
      structuredData.url = url;
    }
    if (imageUrls.length > 0) {
      structuredData.image = imageUrls;
    }
    if (location) {
      structuredData.location = location;
    }
    const organiserName = groupEvent.group_name || config?.group?.longName;
    if (organiserName) {
      structuredData.organizer = {
        "@type": "Organization",
        name: organiserName,
        url: (baseUrl || "").replace(/\/+$/, "") || null
      };
    }
    const performerName = walkLeaderDisplayName(event) || groupEvent.event_organiser?.name;
    if (performerName) {
      structuredData.performer = {
        "@type": SchemaOrgPerformerType.PERSON,
        name: performerName
      };
    } else if (organiserName) {
      structuredData.performer = {
        "@type": SchemaOrgPerformerType.PERFORMING_GROUP,
        name: organiserName
      };
    }
    const offer: SchemaOrgOffer = {
      "@type": "Offer",
      price: 0,
      priceCurrency: "GBP",
      availability: groupEvent.status === WalkStatus.CANCELLED
        ? SchemaOrgOfferAvailability.SOLD_OUT
        : SchemaOrgOfferAvailability.IN_STOCK
    };
    if (url) {
      offer.url = url;
    }
    const validFrom = isoOrNull(groupEvent.date_created);
    if (validFrom) {
      offer.validFrom = validFrom;
    }
    structuredData.offers = offer;
    return structuredData;
  } else {
    return null;
  }
}
