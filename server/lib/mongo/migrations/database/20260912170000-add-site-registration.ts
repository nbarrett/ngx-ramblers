import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { REGISTRATIONS_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminPlatformPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import {
  ContentTemplateType, MigrationTemplateSourceType, NestedRowContentSource, NestedRowPackingBehavior,
  PageContent, PageContentType
} from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { RegistrationMigrationTemplate } from "../../../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { UIDateFormat } from "../../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { Environment } from "../../../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  MemberSelection, NotificationConfig, REGISTRATION_CONFIRMATION_SUBJECT_TEXT,
  REGISTRATION_INVITATION_SUBJECT_TEXT, REGISTRATION_REVIEW_SUBJECT_TEXT
} from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";

const debugLog = createMigrationLogger("add-site-registration");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await ensureActionButton(db, `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}#action-buttons`, REGISTRATIONS_MENU_ITEM, debugLog);
  await db.collection("siteRegistrations").createIndex({"group.group_code": 1}, {unique: true});
  const pages = [
    {path: "how-to/group-registration", contentText: "# Register your group\n\n## Where to find it\n\n- [Register your group](/register) — the public form. This is what a group secretary uses.\n- [Group registrations](/admin/platform/environment-management/registrations) — Admin → Platform → Environment management → Group registrations. Turn public registration on, and follow each request.\n- [Choosing pages for a Full site](/how-to/group-registration/full) — the Find pages step.\n- [What happens after you confirm](/how-to/group-registration/after-submission)\n\nUse [Register your group](/register) to ask for a review site. The form has a few short steps.\n\n1. Choose **Lite** or **Full**. Lite is email and membership tools with a small public site, and does not bring pages from an existing website. Full is a complete website. You choose which pages to bring across.\n2. Choose your Ramblers area, then your group.\n3. Enter a committee email address and send the confirmation. Follow the link in that email before you continue. Keep the private return link on the form; it restores your saved answers. Do not share it.\n4. If you chose Full, enter your current website, click **Find pages**, then tick, untick and reorder the list. That list is the new site's pages, not a copy of the old look. [Choosing pages for a Full site](/how-to/group-registration/full) explains this step.\n5. Check the summary and click **Confirm and build site**.\n6. You can leave the page while the review site is built. [What happens after you confirm](/how-to/group-registration/after-submission) covers the rest.\n\nRegistration is free. Your current website is not changed. An administrator checks the new site before your group is invited."},
    {path: "how-to/group-registration/lite", contentText: "# What Lite includes\n\nLite gives the committee email and membership tools, with a small public site. It does not bring pages or photos from an existing website, and it does not include the full page editor.\n\nChoose Lite when you mainly need to write to members. You will not be asked for a current website. An administrator still checks the new site before your group receives an invitation."},
    {path: "how-to/group-registration/full", contentText: "# Choosing pages for a Full site\n\nThis is the **Choose content** step on [Register your group](/register). You are not copying the old website as it looks today. You are choosing what should appear on a new NGX site.\n\n## On the form\n\n1. Enter the address of your current website.\n2. Click **Find pages**.\n3. You see a list of titles. The top level is the new navbar, using the names already common on NGX sites: Home, About Us, Walks, Events, Contact Us, Photos, Committee and Admin. There are at most eight items there. Walks and Events are included when the group has those in Walks Manager. Every other page sits under one of those, as a sub-page. Tick a page to include it. Clear the tick to leave it out. Clearing a section also clears the pages under it. Extra top-level pages go under **Information**.\n4. Click a title to see how it will sit on the new site: its name and address, such as `/about-us`. That is not a preview of the old layout.\n5. Use the arrows to change the order.\n6. Click **Save and next**, then **Confirm and build site** when you are ready.\n\nIf the list looks wrong, click **Find pages** again after changing the website address.\n\n## What comes across\n\n- The words on each ticked page\n- Photos\n- Headings, lists and links\n\n## What does not\n\n- Colours, fonts and the old layout\n- Old menus and old addresses such as `page20`\n- Walks programme and calendar pages. Walks on the new site come from Walks Manager\n- Leftover menu sentences that are not real pages\n\nNothing is invented. Photos are stored with the new site, so they do not depend on the old one staying online. Your current website is not changed."},
    {path: "how-to/group-registration/after-submission", contentText: "# What happens after you confirm\n\nThe review site is built in the background. You do not need to keep the registration page open. Use **Refresh status** if you come back to check progress.\n\nKeep the private return link to this registration. Do not share it.\n\nWhen the site is ready, an administrator looks at it. They may approve it or ask for a change. Your group is not invited until it is approved. After approval, the committee email receives a link to the new site and a link to set a password.\n\nYour current website stays as it is while this happens. The group decides later whether to continue with the new site."}
  ];
  await Promise.all(pages.map(page => db.collection("pageContent").updateOne({path: page.path}, {$setOnInsert: {path: page.path, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: page.contentText}]}]}}, {upsert: true})));
  await Promise.all(registrationMigrationTemplates().map(template => db.collection("pageContent").updateOne({path: template.path}, {$setOnInsert: template}, {upsert: true})));
  if (process.env[Environment.PLATFORM_ADMIN_ENABLED] === "true") {
    await seedRegistrationNotificationConfigs(db);
  }
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Registration data and guidance are retained.");
}

function registrationMigrationTemplates(): PageContent[] {
  const migrationNote = {
    type: PageContentType.TEXT, maxColumns: 1, showSwiper: false,
    columns: [{columns: 12, contentText: ""}]
  };
  const migrationNoteMapping = {
    targetRowIndex: 2, targetColumnIndex: 0, sourceType: MigrationTemplateSourceType.METADATA,
    sourceIdentifier: "migration-note", metadataPrefix: "Migrated from",
    metadataDateFormat: UIDateFormat.YEAR_MONTH_DAY_TIME_WITH_MINUTES
  };
  const narrativeRows = [{
    type: PageContentType.TEXT, maxColumns: 1, showSwiper: true,
    columns: [{columns: 12, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: []}]}]
  }, {
    type: PageContentType.TEXT, maxColumns: 1, showSwiper: false,
    columns: [{columns: 12, contentText: ""}]
  }, migrationNote];
  const narrativeMappings = [{
    targetRowIndex: 0, sourceType: MigrationTemplateSourceType.EXTRACT,
    columnMappings: [{columnIndex: 0, sourceType: MigrationTemplateSourceType.EXTRACT, groupShortTextWithImage: true,
      nestedRowMapping: {contentSource: NestedRowContentSource.REMAINING_IMAGES, packingBehavior: NestedRowPackingBehavior.ONE_PER_ITEM, groupTextWithImage: true}}]
  }, {
    targetRowIndex: 1, targetColumnIndex: 0, sourceType: MigrationTemplateSourceType.EXTRACT,
    columnMappings: [{columnIndex: 0, sourceType: MigrationTemplateSourceType.EXTRACT}]
  }, migrationNoteMapping];
  return [{
    path: RegistrationMigrationTemplate.TEXT_WITH_IMAGES, rows: narrativeRows,
    migrationTemplate: {isTemplate: true, templateType: ContentTemplateType.MIGRATION_TEMPLATE,
      templateName: "Self-service text with images", templateDescription: "Groups linked images with their captions, retains remaining text and records the source page.", mappings: narrativeMappings}
  }, {
    path: RegistrationMigrationTemplate.CONTACT, rows: narrativeRows,
    migrationTemplate: {isTemplate: true, templateType: ContentTemplateType.MIGRATION_TEMPLATE,
      templateName: "Self-service contact", templateDescription: "Retains contact-page text and images and records the source page.", mappings: narrativeMappings}
  }, {
    path: RegistrationMigrationTemplate.GALLERY, rows: narrativeRows,
    migrationTemplate: {isTemplate: true, templateType: ContentTemplateType.MIGRATION_TEMPLATE,
      templateName: "Self-service gallery", templateDescription: "Creates one image row per source image, groups captions and records the source page.", mappings: narrativeMappings}
  }, {
    path: RegistrationMigrationTemplate.CHILD_INDEX,
    rows: [
      {type: PageContentType.ACTION_BUTTONS, maxColumns: 1, showSwiper: true, columns: []},
      {type: PageContentType.ALBUM_INDEX, maxColumns: 4, minColumns: 2, showSwiper: true, columns: []}
    ],
    migrationTemplate: {isTemplate: true, templateType: ContentTemplateType.MIGRATION_TEMPLATE,
      templateName: "Self-service child index", templateDescription: "Uses action buttons or an album index to keep selected child pages browseable.", mappings: []}
  }];
}

async function seedRegistrationNotificationConfigs(db: Db): Promise<void> {
  const notificationConfigs = db.collection("notificationConfigs");
  const configCollection = db.collection("config");
  const mappings = [
    {key: "registrationConfirmationConfigId", config: registrationNotificationConfig(REGISTRATION_CONFIRMATION_SUBJECT_TEXT,
      "Confirm your committee email to continue the registration for **{{params.messageMergeFields.GROUP_NAME}}**.\n\n[Confirm committee email]({{params.messageMergeFields.ACTION_URL}})\n\n[Return to this registration]({{params.messageMergeFields.RETURN_URL}})\n\nKeep the return link private. It restores your saved answers.")},
    {key: "registrationReviewConfigId", config: registrationNotificationConfig(REGISTRATION_REVIEW_SUBJECT_TEXT,
      "The new site for **{{params.messageMergeFields.GROUP_NAME}}** is ready for review. Check the site and approve it or return it for correction. The group has not been invited.\n\n[Open the registration dashboard]({{params.messageMergeFields.ACTION_URL}})")},
    {key: "registrationInvitationConfigId", config: registrationNotificationConfig(REGISTRATION_INVITATION_SUBJECT_TEXT,
      "Your NGX site has been reviewed and is ready at [{{params.messageMergeFields.SITE_URL}}]({{params.messageMergeFields.SITE_URL}}).\n\n[Set your password and open the site]({{params.messageMergeFields.ACTION_URL}})")}
  ];
  for (const mapping of mappings) {
    const saved = await notificationConfigs.findOneAndUpdate({"subject.text": mapping.config.subject.text}, {$setOnInsert: mapping.config}, {upsert: true, returnDocument: "after"});
    await configCollection.updateOne({key: ConfigKey.BREVO}, {$set: {[`value.${mapping.key}`]: saved._id.toString()}});
  }
}

function registrationNotificationConfig(subject: string, body: string): NotificationConfig {
  return {
    subject: {prefixParameter: "", text: subject, suffixParameter: "messageMergeFields.GROUP_NAME"},
    preSendActions: [], postSendActions: [], defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    templateName: "fully-automated-text-body", bannerId: null, omitComposeStep: true, omitEventsStep: true, body
  };
}
