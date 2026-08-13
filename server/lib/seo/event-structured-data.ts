import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { LocationDetails, WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  SchemaOrgEvent,
  SchemaOrgEventStatus,
  SchemaOrgPlace
} from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { eventUrlFor } from "../shared/event-url";
import { dateTimeFromIsoWithZone } from "../shared/dates";

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
    return structuredData;
  } else {
    return null;
  }
}
