import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import {
  BuiltInRole,
  CommitteeMember,
  CONTACT_US_LABEL,
  CONTACT_US_TYPE,
  RoleType
} from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { createOrUpdateKey, queryKey } from "../../controllers/config";

const debugLog = createMigrationLogger("contact-us-sender-role");
const COLLECTION = "notificationConfigs";
const CONTACT_US_SUBJECT = "Contact Us";
const PREVIOUS_ROLE = "support";

function contactUsRole(): CommitteeMember {
  return {
    type: CONTACT_US_TYPE,
    description: CONTACT_US_LABEL,
    email: "",
    fullName: "(Vacant)",
    memberId: null,
    nameAndDescription: `(Vacant) - ${CONTACT_US_LABEL}`,
    vacant: true,
    roleType: RoleType.SYSTEM_ROLE,
    builtInRoleMapping: BuiltInRole.CONTACT_US
  };
}

async function ensureContactUsRoleExists(): Promise<void> {
  const config = await queryKey(ConfigKey.COMMITTEE);
  const committee = config?.value;
  if (!committee) {
    debugLog("No committee config found - skipping role creation");
    return;
  }
  const roles: CommitteeMember[] = committee.roles || [];
  if (roles.some(role => role?.type === CONTACT_US_TYPE)) {
    debugLog(`"${CONTACT_US_TYPE}" role already exists - leaving committee config alone`);
    return;
  }
  committee.roles = [...roles, contactUsRole()];
  await createOrUpdateKey(ConfigKey.COMMITTEE, committee);
  debugLog(`Created missing "${CONTACT_US_TYPE}" system role (${committee.roles.length} roles total)`);
}

export async function up(db: Db, _client: MongoClient) {
  const configs = await db.collection(COLLECTION).find({"subject.text": CONTACT_US_SUBJECT}).toArray();
  const needingChange = configs.filter(config => config.senderRole === PREVIOUS_ROLE
    || config.replyToRole === PREVIOUS_ROLE
    || (config.signOffRoles || []).includes(PREVIOUS_ROLE));
  if (needingChange.length === 0) {
    debugLog(`No "${CONTACT_US_SUBJECT}" notification config using "${PREVIOUS_ROLE}" - nothing to change`);
    return;
  }
  await ensureContactUsRoleExists();
  await Promise.all(needingChange.map(config => db.collection(COLLECTION).updateOne({_id: config._id}, {
    $set: {
      senderRole: config.senderRole === PREVIOUS_ROLE ? CONTACT_US_TYPE : config.senderRole,
      replyToRole: config.replyToRole === PREVIOUS_ROLE ? CONTACT_US_TYPE : config.replyToRole,
      signOffRoles: (config.signOffRoles || []).map((role: string) => role === PREVIOUS_ROLE ? CONTACT_US_TYPE : role)
    }
  })));
  debugLog(`Updated ${needingChange.length} of ${configs.length} "${CONTACT_US_SUBJECT}" notification configs from "${PREVIOUS_ROLE}" to "${CONTACT_US_TYPE}"`);
}

export async function down(db: Db, _client: MongoClient) {
  const configs = await db.collection(COLLECTION).find({"subject.text": CONTACT_US_SUBJECT}).toArray();
  const needingChange = configs.filter(config => config.senderRole === CONTACT_US_TYPE
    || config.replyToRole === CONTACT_US_TYPE
    || (config.signOffRoles || []).includes(CONTACT_US_TYPE));
  await Promise.all(needingChange.map(config => db.collection(COLLECTION).updateOne({_id: config._id}, {
    $set: {
      senderRole: config.senderRole === CONTACT_US_TYPE ? PREVIOUS_ROLE : config.senderRole,
      replyToRole: config.replyToRole === CONTACT_US_TYPE ? PREVIOUS_ROLE : config.replyToRole,
      signOffRoles: (config.signOffRoles || []).map((role: string) => role === CONTACT_US_TYPE ? PREVIOUS_ROLE : role)
    }
  })));
  debugLog(`Reverted ${needingChange.length} "${CONTACT_US_SUBJECT}" notification configs to "${PREVIOUS_ROLE}"`);
}
