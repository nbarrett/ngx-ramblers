import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../services/logger-factory.service";
import {
  ContentText,
  PageContent,
  PageContentColumn,
  PageContentPath,
  PageContentType
} from "../../models/content-text.model";
import { AccessLevel } from "../../models/member-resource.model";
import { ContentTextService } from "../../services/content-text.service";
import { MailProvider, SystemConfig } from "../../models/system.model";
import { SystemConfigService } from "../../services/system/system-config.service";

@Injectable({
  providedIn: "root"
})
export class DataPopulationService {

  private contentTextService: ContentTextService = inject(ContentTextService);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private systemConfig: SystemConfig;
  private logger = this.loggerFactory.createLogger("DataPopulationService", NgxLoggerLevel.OFF);

  constructor() {
    this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => this.systemConfig = systemConfig);
  }

  public async generateDefaultContentTextItems() {
    this.logger.info("generating defaultContentTextItems");
    const defaultContent: ContentText[] = [
      {
        category: "admin",
        name: "walks-manager-fields-help",
        text: "* The **Assemble Name** is sent in the exported CSV file when our walks are sent to Ramblers. You can amend this field below. If this field doesn't exactly match what's stored in Assemble for the member, the Walks Manager CSV Import process will fail with a \"Volunteer Not Found\" error. \n* The **Assemble Id** is the identifier assigned by Assemble when the member is setup in that system. The reason it's stored in the member record here, is that it enables an Administrator to click on the **User Details** Assemble link below for checking purposes."
      },
      {
        category: "admin",
        name: "committee-file-types-help",
        text: "* Enter below any file types that are to be referenced and attached as files in the Committee Pages. \n* The Visible by Public controls the visibility of items depending on whether a member is logged in. "
      },
      {
        category: "admin",
        name: "committee-expenses-help",
        text: "When creating [expense claims](/admin/expenses) and mileage allowance is chosen as the expense type, the item cost is based on the mileage multiplied by the Cost Per Mile. On this screen, it's possible to change the Cost Per Mile (in £) for future expense claims."
      },
      {
        category: "admin",
        name: "committee-roles-help",
        text: "[ngx-ramblers](https://www.ngx-ramblers.org.uk) allows any number of roles  e.g.  _chairman, secretary, treasurer, membership, social, walks_ etc to be configured to suit your group. This screen allows group members that are also Committee Members, to be associated with each of these roles, for meaningful names to be assigned with the roles and for contact email addresses to be associated. By default, the email address from the selected member record is offered as a default, but this can be overridden with a public address related to the website domain, which is recommended in order for emails to be reliably sent via Brevo."
      },
      {
        name: "mail-settings-global-help",
        text: "* Once Brevo has been initialised and connected to your website, little if anything ever needs to be done on this tab again. \n* In this section, are settings such as the URL to the Brevo system, that you might have to visit if you want to edit email templates, along with configuration checkboxes that turn on/off the ability to send emails, and the API key which is used by the website to authenticate to Brevo when messages are sent and received.",
        category: "admin"
      },
      {
        name: "mail-settings-account-help",
        text: "* This page allows Lists to be created, renamed or deleted in Brevo.\n* Depending on the type of message you are sending out,  you might want to send to a list that contains all members (e.g. periodic newsletters). However you may sometimes want to send messages to a specific list of members in your group (e.g. Walk Leaders or Committee Members). If this is the case, you can create lists and add the members to the lists.\n* There is no limit on the number of lists that can be created in Brevo and when emails are sent out, the the target audience is selected by choosing a list to send to.",
        category: "admin"
      },
      {
        name: "mail-settings-account-settings",
        text: "* The fields below are readonly and reflect only what was previously input into Brevo when [this account](https://app.brevo.com/profile/information) was originally setup.\n" +
          "* When campaign emails are sent out to members, the footer on the emails may contain some of these fields for identification purposes.",
        category: "admin"
      },
      {
        name: "mail-settings-email-configurations-help",
        text: "* This page allows Email Configurations to be created, edited or deleted.\n* An Email configuration allows various settings  such as the subject, banner image, Brevo Template, sender, CC, signoff and member selection to be defined and saved. \n* An email configuration is selected at the point of sending an email, which enables default values to be set which speeds up the sending of emails, given that users don't need to think of suitable values for all of the email sending parameters.",
        category: "admin"
      },
      {
        name: "mail-settings-process-mappings",
        text: "* Listed below are the built-in processes that are utilise email at points in the workflow. \n* This configuration page allows each of the built in processes to be linked to an Email Notification configuration.",
        category: "admin"
      }
    ];
    const defaultContentTextItems = await Promise.all(defaultContent.map(async (contentText: ContentText) => await this.contentTextService.findOrCreateByNameAndCategory(contentText.name, contentText.category, contentText.text)));
    this.logger.info("generated defaultContentTextItems", defaultContentTextItems);
    return defaultContentTextItems;
  }

  private async deriveMailSettingsPageContentColumn(): Promise<PageContentColumn> {
    switch (this.systemConfig?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        return {
          accessLevel: AccessLevel.committee,
          title: "Mail Settings",
          icon: "faMailBulk",
          href: "admin/mail-settings",
          contentTextId: (await this.contentTextService.findOrCreateByNameAndCategory("mail-settings-help", "admin", "This page allows you to configure the email settings for the site"))?.id
        };
      case MailProvider.MAILCHIMP:
        return {
          accessLevel: AccessLevel.committee,
          title: "Mailchimp Settings",
          icon: "faMailBulk",
          href: "admin/mailchimp-settings",
          contentTextId: null
        };
      default:
        return null;
    }
  }

  async defaultPageContentForAdminActionButtons(): Promise<PageContent> {

    const part1: PageContentColumn[] = [
      {
        accessLevel: AccessLevel.loggedInMember,
        title: "Contact details",
        icon: "faIdCard",
        href: "admin/contact-details",
        contentTextId: (await this.contentTextService.findByNameAndCategory("personal-details-help", "admin"))?.id
      },
      {
        accessLevel: AccessLevel.loggedInMember,
        title: "Change Password",
        icon: "faUnlockAlt",
        href: "admin/change-password",
        contentTextId: (await this.contentTextService.findByNameAndCategory("member-login-audit-help", "admin"))?.id
      },
      {
        accessLevel: AccessLevel.loggedInMember,
        title: "Email subscriptions",
        icon: "faEnvelopeOpenText",
        href: "admin/email-subscriptions",
        contentTextId: (await this.contentTextService.findByNameAndCategory("contact-preferences-help", "admin"))?.id
      },
      {
        accessLevel: AccessLevel.loggedInMember,
        title: "Expenses",
        icon: "faCashRegister",
        href: "admin/expenses",
        contentTextId: (await this.contentTextService.findByNameAndCategory("expenses-help", "admin"))?.id
      },
      {
        accessLevel: AccessLevel.committee,
        title: "Member Admin",
        icon: "faUsersCog",
        href: "admin/member-admin",
        contentTextId: (await this.contentTextService.findByNameAndCategory("member-admin-help", "admin"))?.id
      },
      {
        accessLevel: AccessLevel.committee,
        title: "Member Bulk Load",
        icon: "faMailBulk",
        href: "admin/member-bulk-load",
        contentTextId: (await this.contentTextService.findByNameAndCategory("bulk-load-help", "admin"))?.id
      },
      {
        accessLevel: AccessLevel.committee,
        title: "Member Login Audit",
        icon: "faBook",
        href: "admin/member-login-audit",
        contentTextId: (await this.contentTextService.findByNameAndCategory("member-login-audit-help", "admin"))?.id
      },
      {
        accessLevel: AccessLevel.committee,
        title: "System Settings",
        icon: "faCogs",
        href: "admin/system-settings",
        contentTextId: null
      },
      {
        accessLevel: AccessLevel.committee,
        title: "Committee Settings",
        icon: "faUsersCog",
        href: "admin/committee-settings",
        contentTextId: null
      }];
    const part2: PageContentColumn[] = [await this.deriveMailSettingsPageContentColumn()];
    const part3: PageContentColumn[] = [
      {
        accessLevel: AccessLevel.committee,
        title: "Configure Banners",
        icon: "faImages",
        href: "admin/banners",
        contentTextId: null
      },
      {
        accessLevel: AccessLevel.committee,
        title: "Edit Carousel Images",
        icon: "faImages",
        href: "admin/carousel-editor",
        contentTextId: null
      }];
    const defaultPageContent: PageContent = {
      path: PageContentPath.ADMIN_ACTION_BUTTONS, rows: [
        {
          maxColumns: 3,
          showSwiper: false,
          type: PageContentType.ACTION_BUTTONS,
          columns: part1.concat(part2).concat(part3)
        }]
    };
    this.logger.info("generated defaultPageContentForAdminActionButtons", defaultPageContent);
    return defaultPageContent;
  }
}
