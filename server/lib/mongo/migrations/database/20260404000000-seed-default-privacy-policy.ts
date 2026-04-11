import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { PAGE_CONTENT_COLLECTION } from "../shared/collection-names";
import {
  createPrivacyPolicyPage,
  PRIVACY_POLICY_PATH
} from "../../../environment-setup/templates/sample-data/page-content-templates";
import { systemConfig } from "../../../config/system-config";
import { createOrUpdateKey } from "../../controllers/config";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = createMigrationLogger("seed-default-privacy-policy");
const LEGAL_TITLE = "Privacy Policy";
const PRIVACY_HREFS = ["privacy-policy", PRIVACY_POLICY_PATH];

function hrefMatchesPrivacy(legal: { href?: string }): boolean {
  const href = (legal?.href || "").trim().toLowerCase();
  return PRIVACY_HREFS.some(target => href === target);
}

export async function up(db: Db, _client: MongoClient) {
  const pageContentCollection = db.collection(PAGE_CONTENT_COLLECTION);

  const config = await systemConfig();
  const groupName = config?.group?.longName || config?.group?.shortName || "Our Group";
  const groupShortName = config?.group?.shortName || "our-group";

  const page = createPrivacyPolicyPage({groupName, groupShortName});
  await pageContentCollection.replaceOne({path: PRIVACY_POLICY_PATH}, page, {upsert: true});
  debugLog(`Seeded privacy policy page for ${groupName} at ${PRIVACY_POLICY_PATH}`);

  if (config) {
    config.footer = config.footer || {appDownloads: {apple: null, google: null}, legals: [], pages: [], quickLinks: []};
    config.footer.legals = config.footer.legals || [];
    const removed = config.footer.legals.filter(hrefMatchesPrivacy).length;
    config.footer.legals = config.footer.legals.filter(legal => !hrefMatchesPrivacy(legal));
    config.footer.legals.push({href: PRIVACY_POLICY_PATH, title: LEGAL_TITLE});
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Replaced ${removed} existing privacy-policy link(s) in footer.legals with ${PRIVACY_POLICY_PATH}`);
  }
}

export async function down(db: Db, _client: MongoClient) {
  const pageContentCollection = db.collection(PAGE_CONTENT_COLLECTION);
  await pageContentCollection.deleteOne({path: PRIVACY_POLICY_PATH});
  debugLog("Removed default privacy policy page");

  const config = await systemConfig();
  if (config?.footer?.legals) {
    config.footer.legals = config.footer.legals.filter(legal => !hrefMatchesPrivacy(legal));
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Removed privacy-policy link(s) from footer.legals`);
  }
}
