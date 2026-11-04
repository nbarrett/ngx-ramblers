import { SystemGmailInboxSettingsComponent } from "./system-gmail-inbox-settings";
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

describe("inbox provider switch controls", () => {
  it("keeps the pending provider fixed while a switch is running", () => {
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      switchBusy: true,
      pendingProvider: InboxReaderProvider.CLOUDFLARE_INGRESS,
      systemConfigInternal: {inbox: {provider: InboxReaderProvider.GMAIL_API}}
    });
    component.requestProviderSwitch(InboxReaderProvider.GMAIL_API);
    expect(component.pendingProvider).toBe(InboxReaderProvider.CLOUDFLARE_INGRESS);
  });

  it("describes publishing the zone router when switching to Direct to inbox", () => {
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      pendingProvider: InboxReaderProvider.CLOUDFLARE_INGRESS,
      isSharedZoneSubdomain() {
        return false;
      }
    });
    expect(component.switchConfirmCopy()).toContain("publishes this site's zone inbox router");
    expect(component.switchConfirmCopy()).not.toContain("Committee Settings still needs");
  });

  it("describes parent-zone catch-all when a subdomain switches to Direct to inbox", () => {
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      pendingProvider: InboxReaderProvider.CLOUDFLARE_INGRESS,
      isSharedZoneSubdomain() {
        return true;
      }
    });
    expect(component.switchConfirmCopy()).toContain("parent zone site");
    expect(component.switchConfirmCopy()).not.toContain("publishes this site's zone inbox router");
  });

  it("describes leaving the catch-all in place when switching back to Gmail", () => {
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      pendingProvider: InboxReaderProvider.GMAIL_API
    });
    expect(component.switchConfirmCopy()).toContain("catch-all is left as it is");
  });

  it("does not send another confirmation while a switch is running", async () => {
    const apply = vi.fn();
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      switchBusy: true,
      pendingProvider: InboxReaderProvider.CLOUDFLARE_INGRESS,
      systemConfigInternal: {inbox: {provider: InboxReaderProvider.GMAIL_API}},
      inboxService: {applyInboxProviderSwitch: apply}
    });
    await component.confirmProviderSwitch();
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("Direct to inbox DNS checks", () => {
  it("checks shared-zone subdomain DNS without querying a local catch-all", async () => {
    const status = {subdomain: "group.example.org.uk", allPresent: true, dnsHealth: {healthy: false}};
    const queryMxRecordStatus = vi.fn().mockResolvedValue(status);
    const queryCatchAllRule = vi.fn();
    const queryInboxRouterHealth = vi.fn();
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      cloudflareConfig: {configured: true, ownsZone: false},
      cloudflareEmailRoutingService: {queryMxRecordStatus, queryCatchAllRule, queryInboxRouterHealth}
    });
    await component.loadDirectInboxChecks();
    expect(component.mxRecordStatus).toBe(status);
    expect(component.directInboxChecksLoading).toBe(false);
    expect(queryCatchAllRule).not.toHaveBeenCalled();
    expect(queryInboxRouterHealth).not.toHaveBeenCalled();
  });

  it("clears an earlier healthy result when a re-check cannot read DNS", async () => {
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      mxRecordStatus: {subdomain: "group.example.org.uk", allPresent: true},
      cloudflareConfig: {configured: true, ownsZone: false},
      cloudflareEmailRoutingService: {queryMxRecordStatus: vi.fn().mockRejectedValue(new Error("DNS records unavailable"))},
      logger: {warn: vi.fn()}
    });
    await component.loadDirectInboxChecks();
    expect(component.mxRecordStatus).toBeNull();
    expect(component.directInboxChecksError).toBe("DNS records unavailable");
    expect(component.directInboxChecksLoading).toBe(false);
  });
});

describe("inbox mail DNS summary", () => {
  it("flags a DNS fault even when all Cloudflare MX records are present", () => {
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      mxRecordStatus: {allPresent: true, extraRecords: [], dnsHealth: {healthy: false}}
    });
    expect(component.mailDnsNeedsAttention()).toBe(true);
  });

  it("does not show an issue when DNS checks pass", () => {
    const component = Object.assign(Object.create(SystemGmailInboxSettingsComponent.prototype), {
      mxRecordStatus: {allPresent: true, extraRecords: [], dnsHealth: {healthy: true}}
    });
    expect(component.mailDnsNeedsAttention()).toBe(false);
  });
});
