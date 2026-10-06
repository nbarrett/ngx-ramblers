import {Db, MongoClient} from "mongodb";
import {CommitteeMember, committeeRoleTypeFromDescription} from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";
import {ConfigKey} from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import createMigrationLogger from "../migrations-logger";
import {CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION} from "../shared/collection-names";

const debugLog = createMigrationLogger("remap-email-roles-renamed-from-description");
const ROLE_FIELDS = ["senderRole", "replyToRole"] as const;
const ROLE_LIST_FIELDS = ["signOffRoles", "bccRoles", "ccRoles"] as const;

export function roleTypeReplacements(roles: CommitteeMember[]): Map<string, string> {
  const current = new Set((roles ?? []).map(role => role.type).filter(Boolean));
  const candidates = (roles ?? []).reduce<Record<string, string[]>>((grouped, role) => {
    const fromDescription = committeeRoleTypeFromDescription(role.description || "");
    if (!role.type || !fromDescription || fromDescription === role.type || current.has(fromDescription)) {
      return grouped;
    }
    return {...grouped, [fromDescription]: (grouped[fromDescription] ?? []).concat(role.type)};
  }, {});
  return new Map(Object.entries(candidates).filter(([, replacements]) => replacements.length === 1).map(([from, replacements]) => [from, replacements[0]]));
}

function replacedRole(value: string | null | undefined, replacements: Map<string, string>): string | null | undefined {
  if (!value?.trim()) {
    return value;
  }
  return replacements.get(value) ?? value;
}

export function notificationConfigWithReplacedRoles(config: Record<string, any>, replacements: Map<string, string>): Record<string, any> | null {
  const update: Record<string, any> = {};
  ROLE_FIELDS.forEach(field => {
    const next = replacedRole(config[field], replacements);
    if (next !== config[field]) {
      update[field] = next;
    }
  });
  ROLE_LIST_FIELDS.forEach(field => {
    const values: string[] = config[field] ?? [];
    const next = values.map(value => replacedRole(value, replacements));
    if (next.some((value, index) => value !== values[index])) {
      update[field] = next;
    }
  });
  return Object.keys(update).length > 0 ? update : null;
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const committeeDocument = await db.collection(CONFIG_COLLECTION).findOne({key: ConfigKey.COMMITTEE});
  const replacements = roleTypeReplacements(committeeDocument?.value?.roles ?? []);
  if (replacements.size === 0) {
    debugLog("No committee role description points at a missing email role");
    return;
  }
  const configs = await db.collection(NOTIFICATION_CONFIG_COLLECTION).find({}).toArray();
  let updated = 0;
  for (const config of configs) {
    const update = notificationConfigWithReplacedRoles(config, replacements);
    if (update) {
      await db.collection(NOTIFICATION_CONFIG_COLLECTION).updateOne({_id: config._id}, {$set: update});
      updated += 1;
      debugLog("Updated email configuration %s: %s", config._id, JSON.stringify(update));
    }
  }
  debugLog("Remapped missing email roles on %s configuration(s): %s", updated, [...replacements.entries()].map(([from, to]) => `${from} -> ${to}`).join(", "));
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Remapped email roles are retained; the previous role type is no longer on the committee");
}
