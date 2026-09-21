import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { AccessLevel } from "../../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { ContentTemplateType, MigrationTemplateSourceType, NestedRowContentSource, NestedRowPackingBehavior, PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { RegistrationMigrationTemplate } from "../../../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { TextStyle } from "../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { UIDateFormat } from "../../../../../projects/ngx-ramblers/src/app/models/date-format.model";

const debugLog = createMigrationLogger("self-service-contact-role-cards");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const result = await db.collection("pageContent").updateOne({path: RegistrationMigrationTemplate.CONTACT}, {$set: {
    rows: [{
      type: PageContentType.TEXT, maxColumns: 1, showSwiper: false,
      columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: "# Contact Us"}]
    }, {
      type: PageContentType.TEXT, maxColumns: 2, showSwiper: false,
      columns: [{
        columns: 6, accessLevel: AccessLevel.PUBLIC,
        rows: [{
          type: PageContentType.TEXT, maxColumns: 2, showSwiper: false,
          columns: [{
            columns: 6, accessLevel: AccessLevel.PUBLIC,
            contentText: "## Name\n### Secretary\n\n[Contact Name](?contact-us&role=secretary&redirect=contact-us)",
            styles: {class: TextStyle.AS_BUTTON}
          }, {
            columns: 6, accessLevel: AccessLevel.PUBLIC, imageSource: "", imageBorderRadius: 6,
            showPlaceholderImage: true, imageAspectRatio: {width: 4, height: 3, description: "Default"}
          }]
        }, {
          type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, marginTop: 3,
          columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: "Profile to follow...."}]
        }]
      }]
    }, {
      type: PageContentType.TEXT, maxColumns: 1, showSwiper: false,
      columns: [{columns: 12, contentText: ""}]
    }],
    migrationTemplate: {
      isTemplate: true,
      templateType: ContentTemplateType.MIGRATION_TEMPLATE,
      templateName: "Self-service contact",
      templateDescription: "Builds committee role cards with secure contact buttons from the old contact page. Names are kept. Email addresses and phone numbers are not shown.",
      mappings: [{
        targetRowIndex: 2, sourceType: MigrationTemplateSourceType.EXTRACT,
        columnMappings: [{
          columnIndex: 0, sourceType: MigrationTemplateSourceType.EXTRACT,
          nestedRowMapping: {contentSource: NestedRowContentSource.CONTACT_CARDS, packingBehavior: NestedRowPackingBehavior.ONE_PER_ITEM}
        }]
      }, {
        targetRowIndex: 3, targetColumnIndex: 0, sourceType: MigrationTemplateSourceType.METADATA,
        sourceIdentifier: "migration-note", metadataPrefix: "Migrated from",
        metadataDateFormat: UIDateFormat.YEAR_MONTH_DAY_TIME_WITH_MINUTES
      }]
    }
  }});
  debugLog(`Updated self-service contact template: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Contact template layout is retained.");
}
