import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  InboxAccessMode,
  InboxAliasConnectionStatus,
  InboxMailboxConnection,
  InboxReaderProvider,
  InboxSyncMode
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { defaultTenantSlug } from "../inbox/inbox-aliases";
import { dateTimeNow } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("cloudflare:ingress-connection"));
debugLog.enabled = true;

export async function ensureCloudflareIngressConnection(): Promise<InboxMailboxConnection> {
  const tenantSlug = defaultTenantSlug();
  const existing = await inboxMailboxConnectionModel.findOne({
    tenantSlug,
    provider: InboxReaderProvider.CLOUDFLARE_INGRESS
  }).lean() as InboxMailboxConnection | null;
  if (existing) {
    return existing;
  }
  const now = dateTimeNow().toMillis();
  const created = await inboxMailboxConnectionModel.create({
    tenantSlug,
    provider: InboxReaderProvider.CLOUDFLARE_INGRESS,
    gmailAccountEmail: null,
    oauthRefreshTokenEncrypted: null,
    syncMode: InboxSyncMode.POLL,
    connectionStatus: InboxAliasConnectionStatus.CONNECTED,
    accessMode: InboxAccessMode.ALL_COMMITTEE_ROLES,
    importAllMessages: false,
    enabled: true,
    createdAt: now,
    createdBy: "cloudflare-ingress",
    updatedAt: now,
    updatedBy: "cloudflare-ingress"
  });
  debugLog("Created Cloudflare ingress mailbox connection for tenant %s", tenantSlug);
  return created.toObject() as InboxMailboxConnection;
}
