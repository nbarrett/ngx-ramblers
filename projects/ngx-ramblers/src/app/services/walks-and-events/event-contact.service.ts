import { inject, Injectable, Injector } from "@angular/core";
import { Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { EventLeaderContactMethod, Organisation } from "../../models/system.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { SystemConfigService } from "../system/system-config.service";
import { UrlService } from "../url.service";
import { StringUtilsService } from "../string-utils.service";
import { DateUtilsService } from "../date-utils.service";
import { PageService } from "../page.service";
import { ContactUsModalService } from "../../pages/contact-us/contact-us-modal.service";
import { CommitteeMember, RoleType } from "../../models/committee.model";
import { validEmail } from "../../functions/strings";

@Injectable({
  providedIn: "root"
})
export class EventContactService {

  private logger: Logger = inject(LoggerFactory).createLogger("EventContactService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private pageService = inject(PageService);
  private router = inject(Router);
  private injector = inject(Injector);
  private group: Organisation;

  constructor() {
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
    });
  }

  private isGroupEvent(event: ExtendedGroupEvent): boolean {
    return event?.groupEvent?.item_type === RamblersEventType.GROUP_EVENT;
  }

  eventTypeLabel(event: ExtendedGroupEvent): string {
    return this.stringUtils.asTitle(event?.groupEvent?.item_type);
  }

  contactMethodFor(event: ExtendedGroupEvent): EventLeaderContactMethod {
    if (this.isGroupEvent(event)) {
      return this.group?.groupEventContactMethod
        ?? this.group?.walkLeaderContactMethod
        ?? EventLeaderContactMethod.CONTACT_US;
    }
    return this.group?.groupWalkContactMethod
      ?? this.group?.walkLeaderContactMethod
      ?? EventLeaderContactMethod.CONTACT_US;
  }

  private contactDirectFor(event: ExtendedGroupEvent): boolean {
    if (this.isGroupEvent(event)) {
      return this.group?.groupEventContactDirect ?? this.group?.walkLeaderContactDirect ?? false;
    }
    return this.group?.groupWalkContactDirect ?? this.group?.walkLeaderContactDirect ?? false;
  }

  private contactRoleFor(event: ExtendedGroupEvent): string {
    if (this.isGroupEvent(event)) {
      return this.group?.groupEventContactRole ?? this.group?.walkLeaderContactRole;
    }
    return this.group?.groupWalkContactRole ?? this.group?.walkLeaderContactRole;
  }

  isRamblersWebsiteContact(event: ExtendedGroupEvent): boolean {
    return this.contactMethodFor(event) === EventLeaderContactMethod.RAMBLERS_WEBSITE;
  }

  isMailtoContact(event: ExtendedGroupEvent): boolean {
    return this.contactMethodFor(event) === EventLeaderContactMethod.MAILTO;
  }

  isContactUsContact(event: ExtendedGroupEvent): boolean {
    return this.contactMethodFor(event) === EventLeaderContactMethod.CONTACT_US;
  }

  eventLeaderContactTooltip(event: ExtendedGroupEvent): string {
    const displayName = event?.fields?.contactDetails?.displayName;
    const email = event?.fields?.contactDetails?.email;
    if (this.isRamblersWebsiteContact(event)) {
      return `Click to visit the Ramblers website to contact ${displayName}`;
    } else if (this.isMailtoContact(event)) {
      return `Click to email ${displayName}`;
    } else if (this.isContactUsContact(event)) {
      if (this.contactDirectFor(event) && validEmail(email)) {
        return `Click to send a message to ${displayName}`;
      } else if (this.contactRoleFor(event)) {
        return `Click to send a message about this ${this.eventTypeLabel(event).toLowerCase()}`;
      }
      const remoteUrl = this.contactEmailHref(email);
      if (remoteUrl && !remoteUrl.startsWith("mailto:")) {
        return `Click to visit the Ramblers website to contact ${displayName}`;
      }
      return `Contact is not available - no fallback committee role has been configured in system settings`;
    }
    return `Click to contact ${displayName}`;
  }

  emailContactHref(event: ExtendedGroupEvent): string {
    if (this.isRamblersWebsiteContact(event)) {
      const href = this.contactEmailHref(event?.fields?.contactDetails?.email);
      return href?.startsWith("mailto:") ? this.eventRouterLink(event) : href;
    } else if (this.isMailtoContact(event)) {
      return this.contactEmailHref(event?.fields?.contactDetails?.email);
    }
    return this.eventRouterLink(event);
  }

  emailContactLabel(event: ExtendedGroupEvent): string {
    if (this.isMailtoContact(event)) {
      return event?.fields?.contactDetails?.email;
    } else if (this.isRamblersWebsiteContact(event)) {
      return event?.fields?.contactDetails?.displayName || "Contact via Ramblers";
    }
    return "Contact " + (event?.fields?.contactDetails?.displayName || this.eventTypeLabel(event).toLowerCase() + " leader");
  }

  eventLeaderContactHref(event: ExtendedGroupEvent): string {
    const email = event?.fields?.contactDetails?.email;
    if (this.isRamblersWebsiteContact(event)) {
      const href = this.contactEmailHref(email);
      return href?.startsWith("mailto:") ? null : href;
    } else if (this.isMailtoContact(event)) {
      return this.contactEmailHref(email);
    }
    return null;
  }

  contactEventLeader(event: ExtendedGroupEvent) {
    const contactUsModalService = this.injector.get(ContactUsModalService);
    const contactDetails = event?.fields?.contactDetails;
    const email = contactDetails?.email;
    const displayName = contactDetails?.displayName;
    const eventDate = event?.groupEvent?.start_date_time ? ` on ${this.dateUtils.displayDate(event.groupEvent.start_date_time)}` : "";
    const subject = `Enquiry about ${this.eventTypeLabel(event).toLowerCase()}: ${event?.groupEvent?.title || ""}${eventDate}`;
    const redirect = this.eventRouterLink(event) || this.router.url;
    if (this.contactDirectFor(event) && validEmail(email)) {
      const leaderAsMember: CommitteeMember = {
        fullName: displayName,
        email,
        description: `${this.eventTypeLabel(event)} Leader`,
        type: this.stringUtils.kebabCase(this.eventTypeLabel(event), "leader"),
        roleType: RoleType.COMMITTEE_MEMBER
      };
      contactUsModalService.openContactModalForMember(leaderAsMember, subject, redirect);
    } else if (this.contactRoleFor(event)) {
      contactUsModalService.openContactModalForRole(this.contactRoleFor(event), subject, redirect);
    } else {
      const remoteUrl = this.contactEmailHref(email);
      if (remoteUrl && !remoteUrl.startsWith("mailto:")) {
        window.open(remoteUrl, "_blank");
      }
    }
  }

  private eventRouterLink(event: ExtendedGroupEvent): string {
    const slug = this.eventSlug(event);
    const area = this.isGroupEvent(event) ? this.groupEventArea() : this.walksArea();
    if (!area || !slug) {
      return null;
    }
    const relativeUrl = this.urlService.linkUrl({area, id: slug, relative: true});
    return this.urlService.routerLinkUrl(relativeUrl);
  }

  private eventSlug(event: ExtendedGroupEvent): string {
    const urlToUse = event?.groupEvent?.url
      || this.stringUtils.kebabCase(event?.groupEvent?.title, this.dateUtils.yearMonthDayWithDashes(event?.groupEvent?.start_date_time))
      || event?.groupEvent?.id
      || event?.id;
    return this.stringUtils.lastItemFrom(urlToUse);
  }

  private walksArea(): string {
    return this.urlService.area();
  }

  private groupEventArea(): string {
    return this.pageService.groupEventPage()?.href;
  }

  private contactEmailHref(email: string): string {
    const normalised = (email || "").trim();
    const lowerCase = normalised.toLowerCase();
    if (!normalised) {
      return null;
    } else if (lowerCase.startsWith("mailto:")) {
      const address = normalised.substring(7).trim();
      return validEmail(address.toLowerCase()) ? `mailto:${address}` : null;
    } else if (validEmail(lowerCase)) {
      return `mailto:${normalised}`;
    } else if (this.urlService.isRemoteUrl(normalised)) {
      return normalised;
    } else {
      return null;
    }
  }
}
