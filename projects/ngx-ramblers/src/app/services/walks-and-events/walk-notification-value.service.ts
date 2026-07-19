import { inject, Injectable } from "@angular/core";
import { compact, groupBy, isArray, isBoolean, isNull, isObject, isUndefined, startCase, toPairs } from "es-toolkit/compat";
import { FileNameData } from "../../models/aws-object.model";
import { ContactDetails, Publishing } from "../../models/group-event.model";
import { MeetupConfig } from "../../models/meetup-config.model";
import { Contact, LocationDetails, Media, Metadata } from "../../models/ramblers-walks-manager";
import { ImageConfig, ImageSource, LINK_CONFIG, LinkSource, LinkWithSource, RiskAssessmentRecord } from "../../models/walk.model";
import { Venue } from "../../models/event-venue.model";
import { WALK_NOTIFICATION_FIELDS } from "../../models/walk-notification-fields";
import { WalkNotificationValueFormat as Format } from "../../models/walk-notification-field.model";
import { DateUtilsService } from "../date-utils.service";
import { DistanceValidationService } from "../walks/distance-validation.service";

@Injectable({providedIn: "root"})
export class WalkNotificationValueService {
  private dateUtils = inject(DateUtilsService);
  private distanceValidation = inject(DistanceValidationService);

  public format(fieldName: string, value: any): string {
    const format = WALK_NOTIFICATION_FIELDS[fieldName]?.format;
    if (this.empty(value)) {
      return "(not set)";
    } else {
      switch (format) {
      case Format.ATTENDEES:
        return this.attendees(value);
      case Format.BOOLEAN:
        return this.yesNo(value);
      case Format.CONTACT:
        return this.contact(value);
      case Format.CONTACT_DETAILS:
        return this.contactDetails(value);
      case Format.DATE_TIME:
        return this.dateUtils.displayDateAndTime(value);
      case Format.FILE:
        return this.file(value);
      case Format.IMAGE_CONFIG:
        return this.imageConfig(value);
      case Format.LINKS:
        return this.links(value);
      case Format.LOCATION:
        return this.location(value);
      case Format.MEDIA:
        return this.media(value);
      case Format.MEETUP:
        return this.meetup(value);
      case Format.METADATA:
        return this.metadata(value);
      case Format.PUBLISHING:
        return this.publishing(value);
      case Format.RISK_ASSESSMENT:
        return this.riskAssessment(value);
      case Format.SPEED:
        return this.speed(value);
      case Format.VENUE:
        return this.venue(value);
      default:
        return this.text(value);
      }
    }
  }

  private attendees(value: object[]): string {
    const count = value?.length || 0;
    return count === 1 ? "1 attendee recorded" : `${count} attendees recorded`;
  }

  private contact(value: Contact): string {
    const email = value?.email_form?.replace(/^mailto:/, "");
    return compact([
      value?.name,
      value?.telephone ? `telephone ${value.telephone}` : null,
      value?.has_email && email ? email : null,
      value?.has_email && !email ? "email contact available" : null
    ]).join(", ") || "(not set)";
  }

  private contactDetails(value: ContactDetails): string {
    return compact([
      value?.displayName,
      value?.email,
      value?.phone
    ]).join(", ") || "(not set)";
  }

  private file(value: FileNameData): string {
    const name = value?.title || value?.originalFileName;
    return name ? `“${name}”` : "File attached";
  }

  private imageConfig(value: ImageConfig): string {
    if (value?.source === ImageSource.NONE) {
      return "No image selected";
    } else if (value?.source === ImageSource.LOCAL) {
      return "Image uploaded directly to this walk";
    } else if (value?.source === ImageSource.WALKS_MANAGER) {
      return "Image imported from another published walk";
    } else {
      return "Image source selected";
    }
  }

  private links(value: LinkWithSource[]): string {
    const summaries = value?.map(link => {
      const source = link.source === LinkSource.LOCAL
        ? "Group website"
        : LINK_CONFIG.find(config => config.code === link.source)?.description || startCase(link.source);
      if (link.source === LinkSource.LOCAL) {
        return `${source}: link to ${link.title || "this walk"}`;
      } else {
        return link.title ? `${source}: “${link.title}”` : `${source}: ${link.href || "link available"}`;
      }
    }) || [];
    return this.list(summaries, "No related links");
  }

  private location(value: LocationDetails): string {
    const gridReference = value?.grid_reference_10 || value?.grid_reference_8 || value?.grid_reference_6;
    return compact([
      value?.description,
      value?.postcode,
      gridReference ? `grid reference ${gridReference}` : null,
      value?.w3w ? `what3words ${value.w3w}` : null
    ]).join(", ") || "(not set)";
  }

  private media(value: Media[]): string {
    const summaries = value?.map((image, index) => {
      const description = image?.title || image?.alt || image?.caption || `Image ${index + 1}`;
      const accessibleDescription = image?.alt && image.alt !== description ? `description “${image.alt}”` : null;
      const caption = image?.caption && image.caption !== description ? `caption “${image.caption}”` : null;
      return compact([`“${description}”`, accessibleDescription, caption]).join(", ");
    }) || [];
    const groupedSummaries = toPairs(groupBy(summaries, summary => summary))
      .map(([summary, matches]) => matches.length > 1 ? `${matches.length} × ${summary}` : summary);
    const count = summaries.length;
    const heading = count === 1 ? "1 image" : `${count} images`;
    return count > 0 ? `${heading}: ${groupedSummaries.join("; ")}` : "No walk images";
  }

  private meetup(value: MeetupConfig): string {
    return compact([
      value?.publishStatus ? `status ${startCase(value.publishStatus)}` : null,
      value?.guestLimit ? `guest limit ${value.guestLimit}` : "no guest limit",
      `announce to members: ${this.yesNo(value?.announce)}`,
      value?.defaultContent ? "custom description supplied" : null
    ]).join(", ");
  }

  private metadata(value: Metadata | Metadata[]): string {
    const items = isArray(value) ? value : [value];
    const descriptions = items.map(item => item?.description || startCase(item?.code)).filter(Boolean);
    return this.list(descriptions, "None");
  }

  private publishing(value: Publishing): string {
    return [
      `Ramblers: ${value?.ramblers?.publish ? "will be published" : "not selected for publishing"}`,
      `Meetup: ${value?.meetup?.publish ? "will be published" : "not selected for publishing"}`
    ].join("; ");
  }

  private riskAssessment(value: RiskAssessmentRecord[]): string {
    const records = value || [];
    const confirmed = records.filter(record => record.confirmed).length;
    const sectionSummary = records.length === 1 ? "1 section" : `${records.length} sections`;
    const confirmationSummary = `${confirmed} confirmed`;
    const sectionDetails = records.map(record => {
      const title = record.riskAssessmentSection || startCase(record.riskAssessmentKey);
      const status = record.confirmed ? "confirmed" : "awaiting confirmation";
      const inputText = record.confirmationText?.trim();
      return inputText ? `${title}: ${status}; notes “${inputText}”` : `${title}: ${status}`;
    });
    return sectionDetails.length > 0
      ? `${sectionSummary}, ${confirmationSummary} — ${sectionDetails.join("; ")}`
      : `${sectionSummary}, ${confirmationSummary}`;
  }

  private speed(milesPerHour: number): string {
    const kilometresPerHour = parseFloat(this.distanceValidation.convertMilesToKm(milesPerHour).toFixed(1));
    return `${milesPerHour} mph / ${kilometresPerHour} km/h`;
  }

  private venue(value: Venue): string {
    const address = compact([value?.address1, value?.address2, value?.postcode]).join(", ");
    return compact([
      value?.name,
      value?.type ? startCase(value.type) : null,
      address,
      value?.isMeetingPlace ? "meeting place" : null,
      value?.venuePublish ? "shown publicly" : "not shown publicly"
    ]).join(", ") || "(not set)";
  }

  private text(value: any): string {
    if (isBoolean(value)) {
      return this.yesNo(value);
    } else if (isObject(value)) {
      return "Details changed";
    } else {
      return value?.toString() || "(not set)";
    }
  }

  private yesNo(value: boolean): string {
    return value ? "Yes" : "No";
  }

  private list(values: string[], emptyValue: string): string {
    return values.length > 0 ? values.join(", ") : emptyValue;
  }

  private empty(value: any): boolean {
    return isNull(value) || isUndefined(value) || value === "";
  }
}
