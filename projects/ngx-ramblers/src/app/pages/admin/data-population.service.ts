import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../services/logger-factory.service";
import { ContentText, PageContent, PageContentPath, PageContentType } from "../../models/content-text.model";
import { ContentTextService } from "../../services/content-text.service";
import { LegacyStoredValue } from "../../models/ui-actions";

@Injectable({
  providedIn: "root"
})
export class DataPopulationService {

  private contentTextService: ContentTextService = inject(ContentTextService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("DataPopulationService", NgxLoggerLevel.OFF);
  private defaultContentMap: Map<string, string> = new Map();
  private defaultContentByName: Map<string, string> = new Map();

  constructor() {
    this.buildDefaultContentMap();
  }

  private buildDefaultContentMap(): void {
    const defaultContent = this.defaultContentArray();
    defaultContent.forEach(item => {
      if (item.name) {
        this.defaultContentByName.set(item.name, item.text);
      }
      const key = this.buildKey(item.category, item.name);
      if (key) {
        this.defaultContentMap.set(key, item.text);
      }
    });
  }

  public hasDefaultContent(category: string, name: string): boolean {
    return !!this.resolveDefaultContent(category, name);
  }

  public defaultContent(category: string, name: string): string | undefined {
    return this.resolveDefaultContent(category, name);
  }

  private resolveDefaultContent(category: string, name: string): string | undefined {
    const key = this.buildKey(category, name);
    if (key && this.defaultContentMap.has(key)) {
      return this.defaultContentMap.get(key);
    }
    if (name && this.defaultContentByName.has(name)) {
      return this.defaultContentByName.get(name);
    }
    return undefined;
  }

  private buildKey(category?: string, name?: string): string | null {
    if (!category || !name) {
      return null;
    }
    return `${category}:${name}`;
  }

  public fragmentPaths(): string[] {
    try {
      return Array.from(this.defaultContentMap.keys())
        .filter(() => false);
    } catch {
      return [];
    }
  }

  public clearLegacyLocalStorage(): void {
    try {
      const keys = Object.values(LegacyStoredValue);
      keys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          this.logger.debug("Removed legacy localStorage key:", key);
        }
      });
    } catch (e) {
      this.logger.warn("clearLegacyLocalStorage: unable to access localStorage", e);
    }
  }

  private defaultContentArray(): ContentText[] {
    return [
      {
        category: "admin",
        name: "fragment-index",
        text: "This page lists all Shared Fragments (paths starting with `fragments/`), renders a live preview of each, and shows links to every page that references them. Use the filter to quickly find a fragment by path."
      },
      {
        category: "admin",
        name: "walks-manager-fields-help",
        text: "* The **Walks Manager Name** is sent in the exported CSV file when our walks are sent to Ramblers. You can amend this field below. If this field doesn't exactly match what's stored in Walks Manager for the member, the Walks Manager CSV Import process will fail with a \"Volunteer Not Found\" error."
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
      },
      {
        name: "page-content-navigator",
        text: "This page allows the content administrator to navigate and manage all page content items. It provides two viewing modes: **Duplicates** to identify and resolve page content items where more than one item has the same content path, and **All Content** to browse and manage all page content. You can filter by path and perform bulk operations on page content items.",
        category: "admin"
      },
      {
        name: "event-data-management-help-page",
        text: "This page is used to view and manage the total number of events per group code and event type.\n" +
          "* Data within these categories can be selected and bulk deleted, if you wish to reload all event history from walks manager or import file later on.\n" +
          "* Extreme care should be taken when using this page as no backup is performed beforehand, so please do ensure that a data backup is performed beforehand!",
        category: "admin"
      },
      {
        name: "event-data-management-help",
        text: "* Used to view and manage the total number of events per group code and event type categories\n"+
          "* Bulk delete data within these categories",
        category: "admin"
      },
      {
        name: "ramblers-import-help-page",
        text: "This page should be used to prepare your group for when you wish to switch from using Walks Manager as your data source to your local database. There are several reasons why this can be beneficial, including providing better control over the walk leader information published on walks, email-backed workflow such as advertising walk slots and email notifications on change of walk details and the ability to provide more informative fields on the walk that are not supported by Walks Manager. The steps for using this page are to :\n" +
          "* Click the **Collect Walks From Walks Manager** button below to query all walks that are held in Walks manager and load them into an unsaved state.  \n" +
          "* During the above process, the imported walks are analysed for walk leaders and an attempt is made to match each walk leader to an existing member in your member database.\n" +
          "* The walks are then listed in a table.\n" +
          "* You can then perform further matching of the imported walk leaders to existing members in your database.\n" +
          "* When you are happy with the proposed import information, click the **Save Walks** button and the walks will be saved into your database.\n" +
          "* If you are not happy with the import at any stage before saving, click the **Reset** button and you can start again or leave the import page.",
        category: "admin"
      },
      {
        name: "file-import-help-page",
        text: "TThis page should be used to import historic events data for your group for for dates that precede the go-live of Walks Manager in 2023. The steps for using this page are to :\n" +
          "* Click the **Choose File** button to navigate to a CSV file on your local computer. Alternatively, you can drop the file into the drop zone at the bottom of this page.\n" +
          "* When the file import is complete the walks are loaded into an unsaved state and listed in a table.\n" +
          "* During the above process, the imported walks are analysed for walk leaders and an attempt is made to match each walk leader to an existing member in your member database.\n" +
          "* You can then perform further matching of the imported walk leaders to existing members in your database.\n" +
          "* When you are happy with the proposed import information, click the **Save Walks** button and the walks will be saved into your database.\n" +
          "* If you are not happy with the import at any stage before saving, click the **Reset** button and you can start again or leave the import page.",
        category: "admin"
      },
      {
        name: "area-map-group-configuration-help",
        text: "* For each Group, configure one of more districts and associate a colour that will represent the group's polygon on an Area Map. \n" +
          "* Mark as **Non-Geographic**, groups that don't cover a specific geographical area.",
        category: "admin"
      },
      {
        name: "migration-settings-help",
        text: "* This page allows you to configure settings for migrating content from legacy static websites.\n" +
          "* Add multiple site configurations with specific selectors and options.\n" +
          "* Test migrations with dry-run mode before persisting data.\n" +
          "* Each site can be enabled/disabled individually.",
        category: "admin"
      }
    ].concat(
      [{
        name: "ramblers-export-help",
        text: "* Upload walks directly to [Ramblers  Walks Manager](https://walks-manager.ramblers.org.uk/walks-manager)\n" +
          "* Export walks in CSV format\n" +
          "* Review audits of previous upload sessions",
        category: "walks-admin"
      }], [{
        name: "how-to-documentation-help",
        text: "* Import walks from [Ramblers  Walks Manager](https://walks-manager.ramblers.org.uk/walks-manager)\n" +
          "* You can do this when you want to change your website usage from the read-only view of Ramblers walks to when you create walks on this website and push them in bulk to Ramblers.",
        category: "walks-admin"
      }], [{
        name: "add-walks-slots-help",
        text: "* Add walk slots for any number of up and coming Sundays\n" +
          "* Add a non-standard walk slot - for example on a Saturday or a weekday evening",
        category: "walks-admin"
      }], [{
        name: "meetup-settings-help",
        text: "* Maintain content that automatically gets added to our walk description \n" +
          "* Configure defaults for Meetup publishing",
        category: "walks-admin"
      }], [{
        name: "event-data-management-help",
        text: "* Used to view and manage the total number of events per group code and event type categories\n" +
          "* Bulk delete data within these categories",
        category: "walks-admin"
      }], [{
        name: "how-to-documentation-help",
        text: "* All documentation related to administering all walk-related activities",
        category: "walks-admin"
      }],
    );
  }

  public async generateDefaultContentTextItems() {
    this.logger.info("generating defaultContentTextItems");
    const defaultContent: ContentText[] = this.defaultContentArray();
    const defaultContentTextItems = await Promise.all(defaultContent.map(async (contentText: ContentText) => await this.contentTextService.findOrCreateByNameAndCategory(contentText.name, contentText.category, contentText.text)));
    this.logger.info("generated defaultContentTextItems", defaultContentTextItems);
    return defaultContentTextItems;
  }

  defaultPageContentForAdminActionButtons(): PageContent {
    const defaultPageContent: PageContent = {
      path: PageContentPath.ADMIN_ACTION_BUTTONS, rows: [
        {
          maxColumns: 3,
          showSwiper: false,
          type: PageContentType.ACTION_BUTTONS,
          columns: []
        }]
    };
    this.logger.info("generated defaultPageContentForAdminActionButtons - menu items populated by database migration", defaultPageContent);
    return defaultPageContent;
  }
}
