import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgxLoggerLevel } from "ngx-logger";
import { MailchimpCampaign, MailchimpCampaignVersion2 } from "../../models/mailchimp.model";
import { isUndefined } from "es-toolkit/compat";
import {
  AccessLevel,
  AccessLevelData,
  MailchimpCampaignMixedVersion,
  MemberResource,
  ResourceSubject,
  ResourceType,
  ResourceTypeData
} from "../../models/member-resource.model";
import { SiteEditService } from "../../site-edit/site-edit.service";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "./member-login.service";

@Injectable({
  providedIn: "root"
})
export class MemberResourcesReferenceDataService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberResourcesReferenceDataService", NgxLoggerLevel.ERROR);
  private siteEditService = inject(SiteEditService);
  protected dateUtils = inject(DateUtilsService);
  private memberLoginService = inject(MemberLoginService);
  private http = inject(HttpClient);
  private platformAdminEnabled = false;

  constructor() {
    this.loadPlatformAdminStatus();
  }

  private loadPlatformAdminStatus() {
    this.http.get<{ platformAdminEnabled: boolean }>("/api/environment-setup/status")
      .subscribe({
        next: response => {
          this.platformAdminEnabled = response?.platformAdminEnabled || false;
          this.logger.info("platformAdminEnabled:", this.platformAdminEnabled);
        },
        error: () => {
          this.platformAdminEnabled = false;
        }
      });
  }

  static isMailchimpCampaign(campaign: MailchimpCampaignVersion2 | MailchimpCampaign): campaign is MailchimpCampaign {
    return !isUndefined((campaign as MailchimpCampaign)?.long_archive_url);
  }

  resourceSubjectForSubject(subject: string): ResourceSubject {
    return this.subjects().find(item => item.id === subject);
  }

  subjects(): ResourceSubject[] {
    return [
      {
        id: "guide",
        description: "Guide"
      },
      {
        id: "newsletter",
        description: "Newsletter"
      },
      {
        id: "siteReleaseNote",
        description: "Site Release Note"
      },
      {
        id: "walkPlanning",
        description: "Walking Planning Advice"
      }
    ];
  }

  resourceTypes(): ResourceTypeData[] {

    return [
      {
        id: "email",
        description: "Email",
        action: "View email",
        icon() {
          return "/assets/images/local/mailchimp.jpeg";
        },
        resourceUrl(memberResource: MemberResource) {
          const campaign: MailchimpCampaignMixedVersion = memberResource?.data?.campaign;
          if (MemberResourcesReferenceDataService.isMailchimpCampaign(campaign)) {
            return campaign?.long_archive_url;
          } else {
            return campaign?.archive_url_long;
          }
        }
      },
      {
        id: "file",
        description: "File",
        action: "Download",
        icon(memberResource) {
          return this.fileUtilsService.icon(memberResource, "data");
        },
        resourceUrl(memberResource) {
          return memberResource && memberResource.data.fileNameData ? this.urlService.baseUrl() + this.contentMetadataService.baseUrl("memberResources") + "/" + memberResource.data.fileNameData.awsFileName : "";
        }
      },
      {
        id: "url",
        action: "View page",
        description: "External Link",
        icon() {
          return "images/ramblers/favicon.ico";
        },
        resourceUrl() {
          return "TBA";
        }
      }
    ];
  }

  accessLevels(): AccessLevelData[] {
    return [
      {
        id: "hidden",
        description: "Hidden",
        filter: () => this.siteEditService.active() || false,
        includeAccessLevelIds: []
      },
      {
        id: "environmentAdmin",
        description: "Environment Admin",
        filter: () => this.siteEditService.active() || (this.platformAdminEnabled && this.memberLoginService.allowCommittee()),
        includeAccessLevelIds: [AccessLevel.ENVIRONMENT_ADMIN, AccessLevel.COMMITTEE, AccessLevel.LOGGED_IN_MEMBER, AccessLevel.PUBLIC, AccessLevel.HIDDEN]
      },
      {
        id: "committee",
        description: "Committee",
        filter: () => this.siteEditService.active() || this.memberLoginService.allowCommittee(),
        includeAccessLevelIds: [AccessLevel.COMMITTEE, AccessLevel.LOGGED_IN_MEMBER, AccessLevel.PUBLIC, AccessLevel.HIDDEN]
      },
      {
        id: "loggedInMember",
        description: "Logged-in member",
        filter: () => this.siteEditService.active() || this.memberLoginService.memberLoggedIn(),
        includeAccessLevelIds: [AccessLevel.LOGGED_IN_MEMBER]
      },
      {
        id: "public",
        description: "Public",
        filter: () => true,
        includeAccessLevelIds: [AccessLevel.PUBLIC]
      }];
  }

  accessLevelViewTypes(): AccessLevelData[] {
    return this.accessLevels().filter(item => item.id !== AccessLevel.HIDDEN);
  }

  defaultMemberResource(): MemberResource {
    return {
      data: {},
      resourceType: ResourceType.EMAIL,
      accessLevel: AccessLevel.HIDDEN,
      createdDate: this.dateUtils.nowAsValue(),
      createdBy: this.memberLoginService.loggedInMember().memberId
    };
  }

  resourceTypeDataFor(resourceType): ResourceTypeData {
    const resourceTypeData = this.resourceTypes().find(type => type.id === resourceType);
    this.logger.debug("resourceType:", resourceType, "resourceTypeData:", resourceTypeData);
    return resourceTypeData;
  }

  accessLevelFor(accessLevel: AccessLevel): AccessLevelData {
    const level: AccessLevelData = this.accessLevels().find(level => level.id === accessLevel);
    this.logger.info("accessLevel for", accessLevel, level);
    return level;
  }

}
