import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("normalize-contact-us-system-role");
const COMMITTEE_CONFIG_KEY = "committee";
const CONTACT_US_TYPE = "contact-us";
const CONTACT_US_BUILT_IN_ROLE = "CONTACT_US";
const SYSTEM_ROLE = "SYSTEM_ROLE";
const CONTACT_US_LABEL = "Contact Us";

const NORMALISED_FIELDS = ["type", "builtInRoleMapping", "roleType", "description", "fullName", "nameAndDescription", "vacant"];

export async function up(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: COMMITTEE_CONFIG_KEY});
  if (!committeeConfig?.value?.roles?.length) {
    debugLog("No committee roles found — skipping");
    return;
  }

  const roles: any[] = committeeConfig.value.roles;
  let changed = false;
  const updatedRoles = roles.map(role => {
    const isContactUs = role.builtInRoleMapping === CONTACT_US_BUILT_IN_ROLE || role.type === CONTACT_US_TYPE;
    if (!isContactUs) {
      return role;
    }
    const next = {
      ...role,
      type: CONTACT_US_TYPE,
      builtInRoleMapping: CONTACT_US_BUILT_IN_ROLE,
      roleType: SYSTEM_ROLE,
      description: CONTACT_US_LABEL,
      fullName: CONTACT_US_LABEL,
      nameAndDescription: CONTACT_US_LABEL,
      vacant: false
    };
    if (NORMALISED_FIELDS.some(field => role[field] !== next[field])) {
      changed = true;
      debugLog(
        "Normalising Contact Us system role (was type=%s roleType=%s fullName=%s vacant=%s description=%s)",
        role.type, role.roleType, role.fullName, role.vacant, role.description
      );
    }
    return next;
  });

  if (!changed) {
    debugLog("Contact Us system role already canonical — nothing to do");
    return;
  }

  await configCollection.updateOne(
    {key: COMMITTEE_CONFIG_KEY},
    {$set: {"value.roles": updatedRoles}}
  );
  debugLog("Normalised Contact Us system role identity");
}

export async function down() {
  debugLog("Down is a no-op: normalisation cannot restore per-site stale states");
}
