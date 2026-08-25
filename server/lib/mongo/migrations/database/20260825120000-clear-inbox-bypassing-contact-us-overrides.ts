import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION } from "../shared/collection-names";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { ForwardEmailTarget } from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxReaderProvider } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const debugLog = createMigrationLogger("clear-inbox-bypassing-contact-us-overrides");
const BYPASSING_TARGETS: ForwardEmailTarget[] = [ForwardEmailTarget.MULTIPLE, ForwardEmailTarget.MEMBER_EMAIL];

export async function up(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await configCollection.findOne({key: ConfigKey.SYSTEM});
  const provider = systemConfig?.value?.inbox?.provider;
  if (provider !== InboxReaderProvider.CLOUDFLARE_INGRESS) {
    debugLog("inbox provider is %s, not %s — skipping", provider || "unset", InboxReaderProvider.CLOUDFLARE_INGRESS);
    return;
  }
  const committeeConfig = await configCollection.findOne({key: ConfigKey.COMMITTEE});
  if (!committeeConfig?.value?.roles?.length) {
    debugLog("No committee roles found — skipping");
    return;
  }
  const roles: any[] = committeeConfig.value.roles;
  const bypassingRoles = roles.filter(role => BYPASSING_TARGETS.includes(role.contactUsTarget));
  if (bypassingRoles.length === 0) {
    debugLog("No roles carry an inbox-bypassing contact-us override — nothing to do");
    return;
  }
  const updatedRoles = roles.map(role => {
    if (!BYPASSING_TARGETS.includes(role.contactUsTarget)) {
      return role;
    }
    const {contactUsTarget, contactUsCustom, contactUsRecipients, ...cleared} = role;
    return cleared;
  });
  await configCollection.updateOne(
    {key: ConfigKey.COMMITTEE},
    {$set: {"value.roles": updatedRoles}}
  );
  debugLog(
    "Cleared inbox-bypassing contact-us overrides from %d role(s): %s",
    bypassingRoles.length,
    bypassingRoles.map(role => `${role.type} (${role.contactUsTarget})`).join(", ")
  );
}

export async function down(_db: Db) {
  debugLog("down: no-op — the cleared overrides were pre-inbox snapshots backfilled from forwarding settings in the enquiries rename migration, and contact-us now follows each role's forwarding target on direct-to-inbox sites");
}
