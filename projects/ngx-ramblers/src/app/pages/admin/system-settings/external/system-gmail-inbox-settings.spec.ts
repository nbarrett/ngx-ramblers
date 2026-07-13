import { InboxCatchAllMode, InboxPrivacyMode, InboxReaderProvider } from "../../../../models/inbox.model";
import { InboxSettingsConfig } from "../../../../models/system.model";

import { inboxSettingsForProvider } from "../../../../models/cloudflare-email-routing.model";

describe("inboxSettingsForProvider", () => {
  it("preserves an explicit catch-all policy when switching to Gmail", () => {
    const current: InboxSettingsConfig = {
      provider: InboxReaderProvider.CLOUDFLARE_INGRESS,
      catchAll: {mode: InboxCatchAllMode.FORWARD, forwardTo: "fallback@example.com"},
      privacyMode: InboxPrivacyMode.PRIVATE,
      specialVisibility: {
        junk: {inboxVisibleToAllRoles: false, inboxVisibleToRoleTypes: ["chairman"]}
      }
    };

    expect(inboxSettingsForProvider(current, InboxReaderProvider.GMAIL_API)).toEqual({
      provider: InboxReaderProvider.GMAIL_API,
      catchAll: {mode: InboxCatchAllMode.FORWARD, forwardTo: "fallback@example.com"},
      privacyMode: InboxPrivacyMode.PRIVATE,
      specialVisibility: {
        junk: {inboxVisibleToAllRoles: false, inboxVisibleToRoleTypes: ["chairman"]}
      }
    });
  });

  it("creates a complete Gmail inbox configuration when no inbox settings exist", () => {
    expect(inboxSettingsForProvider(null, InboxReaderProvider.GMAIL_API)).toEqual({
      provider: InboxReaderProvider.GMAIL_API,
      catchAll: {mode: InboxCatchAllMode.INBOX}
    });
  });

  it("preserves the catch-all policy for other inbox providers", () => {
    const current: InboxSettingsConfig = {
      provider: InboxReaderProvider.GMAIL_API,
      catchAll: {mode: InboxCatchAllMode.DROP}
    };

    expect(inboxSettingsForProvider(current, InboxReaderProvider.CLOUDFLARE_INGRESS)).toEqual({
      provider: InboxReaderProvider.CLOUDFLARE_INGRESS,
      catchAll: {mode: InboxCatchAllMode.DROP}
    });
  });
});
