import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  InboxProviderSwitchChange,
  InboxProviderSwitchStep,
  InboxReaderProvider,
  InboxSyncMode
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import * as systemConfigModule from "../config/system-config";
import * as configController from "../mongo/controllers/config";
import { inboxMailboxConnection } from "../mongo/models/inbox-mailbox-connection";
import * as ingress from "../cloudflare/cloudflare-ingress-connection";
import * as cloudflareConfig from "../cloudflare/cloudflare-config";
import * as directInboxCatchAll from "../cloudflare/direct-inbox-catch-all";
import * as gmailReader from "./gmail-inbox-reader";
import * as aliases from "./inbox-aliases";
import * as poller from "./inbox-poller";
import { applyInboxProviderSwitch } from "./inbox-provider-switch";

describe("inbox provider switch", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => sandbox.restore());

  function stubConnections(records: object[]): void {
    sandbox.stub(inboxMailboxConnection, "find").callsFake((query: {provider?: string}) => ({
      lean: async () => records.filter((record: {provider?: string}) => !query.provider || record.provider === query.provider)
    }) as any);
    sandbox.stub(inboxMailboxConnection, "findOne").callsFake((query: {provider?: string}) => ({
      lean: async () => records.find((record: {provider?: string}) => record.provider === query.provider) || null
    }) as any);
  }

  it("switches to Direct to inbox, creates the connection and stops Gmail polling without rewriting mail", async () => {
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(aliases, "clearDerivedAliasCache");
    sandbox.stub(systemConfigModule, "systemConfig").resolves({
      inbox: {provider: InboxReaderProvider.GMAIL_API}
    } as any);
    const save = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
    stubConnections([
      {id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: true, oauthRefreshTokenEncrypted: "token", syncMode: InboxSyncMode.POLL}
    ]);
    sandbox.stub(ingress, "ensureCloudflareIngressConnection").resolves({id: "cf1"} as any);
    sandbox.stub(cloudflareConfig, "configuredCloudflareForCurrentSite").resolves({zoneId: "zone-1"} as any);
    sandbox.stub(directInboxCatchAll, "ensureDirectInboxCatchAll").resolves({changed: true, detail: "Catch-all now delivers to this site's inbox"});
    sandbox.stub(gmailReader, "stopGmailWatch").resolves();
    const updateMany = sandbox.stub(inboxMailboxConnection, "updateMany").resolves({modifiedCount: 1} as any);

    const result = await applyInboxProviderSwitch(InboxReaderProvider.CLOUDFLARE_INGRESS, "member-1");

    expect(save.firstCall.args[0]).toEqual(ConfigKey.SYSTEM);
    expect(save.firstCall.args[1].inbox.provider).toEqual(InboxReaderProvider.CLOUDFLARE_INGRESS);
    expect(updateMany.called).toBe(true);
    expect(result.steps.map(step => step.step)).toEqual([
      InboxProviderSwitchStep.PROVIDER,
      InboxProviderSwitchStep.CLOUDFLARE_CONNECTION,
      InboxProviderSwitchStep.CATCH_ALL,
      InboxProviderSwitchStep.GMAIL_POLLING
    ]);
    expect(result.steps.map(step => step.change)).toEqual([
      InboxProviderSwitchChange.CHANGED,
      InboxProviderSwitchChange.CHANGED,
      InboxProviderSwitchChange.CHANGED,
      InboxProviderSwitchChange.CHANGED
    ]);
  });

  it("is idempotent when Direct to inbox is already in place and Gmail polling is stopped", async () => {
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(aliases, "clearDerivedAliasCache");
    sandbox.stub(systemConfigModule, "systemConfig").resolves({
      inbox: {provider: InboxReaderProvider.CLOUDFLARE_INGRESS}
    } as any);
    const save = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
    stubConnections([
      {id: "cf1", provider: InboxReaderProvider.CLOUDFLARE_INGRESS, enabled: true},
      {id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: false, oauthRefreshTokenEncrypted: "token"}
    ]);
    sandbox.stub(ingress, "ensureCloudflareIngressConnection").resolves({id: "cf1"} as any);
    sandbox.stub(cloudflareConfig, "configuredCloudflareForCurrentSite").resolves({zoneId: "zone-1"} as any);
    sandbox.stub(directInboxCatchAll, "ensureDirectInboxCatchAll").resolves({changed: false, detail: "Catch-all already delivers to this site's inbox"});
    sandbox.stub(inboxMailboxConnection, "updateMany").resolves({modifiedCount: 0} as any);

    const result = await applyInboxProviderSwitch(InboxReaderProvider.CLOUDFLARE_INGRESS, "member-1");

    expect(save.called).toBe(false);
    expect(result.steps.every(step => step.change === InboxProviderSwitchChange.ALREADY)).toBe(true);
  });

  it("switches back to Gmail and resumes polling on connections that still have a token", async () => {
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(aliases, "clearDerivedAliasCache");
    sandbox.stub(systemConfigModule, "systemConfig").resolves({
      inbox: {provider: InboxReaderProvider.CLOUDFLARE_INGRESS}
    } as any);
    const save = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
    stubConnections([
      {id: "cf1", provider: InboxReaderProvider.CLOUDFLARE_INGRESS, enabled: true},
      {id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: false, oauthRefreshTokenEncrypted: "token"}
    ]);
    const updateMany = sandbox.stub(inboxMailboxConnection, "updateMany").resolves({modifiedCount: 1} as any);

    const result = await applyInboxProviderSwitch(InboxReaderProvider.GMAIL_API, "member-1");

    expect(save.firstCall.args[1].inbox.provider).toEqual(InboxReaderProvider.GMAIL_API);
    expect(updateMany.called).toBe(true);
    expect(result.steps.some(step => step.step === InboxProviderSwitchStep.GMAIL_POLLING && step.change === InboxProviderSwitchChange.CHANGED)).toBe(true);
  });
  it("restarts push delivery immediately after re-enabling a Gmail watch connection", async () => {
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(aliases, "clearDerivedAliasCache");
    sandbox.stub(systemConfigModule, "systemConfig").resolves({inbox: {provider: InboxReaderProvider.CLOUDFLARE_INGRESS}} as any);
    sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
    stubConnections([{id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: false, oauthRefreshTokenEncrypted: "token", syncMode: InboxSyncMode.WATCH}]);
    const enable = sandbox.stub(inboxMailboxConnection, "updateMany").resolves({modifiedCount: 1} as any);
    const activate = sandbox.stub(poller, "activateConnectionAfterReconnect").resolves();
    await applyInboxProviderSwitch(InboxReaderProvider.GMAIL_API, "member-1");
    expect(activate.calledOnceWithExactly("g1", true)).toBe(true);
    expect(enable.calledBefore(activate)).toBe(true);
  });

  it("repairs push delivery when retrying an already selected Gmail provider", async () => {
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(aliases, "clearDerivedAliasCache");
    sandbox.stub(systemConfigModule, "systemConfig").resolves({inbox: {provider: InboxReaderProvider.GMAIL_API}} as any);
    const save = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
    stubConnections([{id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: true, oauthRefreshTokenEncrypted: "token", syncMode: InboxSyncMode.WATCH}]);
    const update = sandbox.stub(inboxMailboxConnection, "updateMany").resolves({modifiedCount: 0} as any);
    const activate = sandbox.stub(poller, "activateConnectionAfterReconnect").resolves();
    await applyInboxProviderSwitch(InboxReaderProvider.GMAIL_API, "member-1");
    expect(activate.calledOnceWithExactly("g1", true)).toBe(true);
    expect(save.called).toBe(false);
    expect(update.called).toBe(false);
  });

  it("reports a failed push restart and restores the previous provider and connection state", async () => {
    const previous = {inbox: {provider: InboxReaderProvider.CLOUDFLARE_INGRESS}};
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(aliases, "clearDerivedAliasCache");
    sandbox.stub(systemConfigModule, "systemConfig").resolves(previous as any);
    const save = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
    stubConnections([{id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: false, oauthRefreshTokenEncrypted: "token", syncMode: InboxSyncMode.WATCH}]);
    const update = sandbox.stub(inboxMailboxConnection, "updateMany").resolves({modifiedCount: 1} as any);
    sandbox.stub(poller, "activateConnectionAfterReconnect").rejects(new Error("Push registration failed"));
    await expect(applyInboxProviderSwitch(InboxReaderProvider.GMAIL_API, "member-1")).rejects.toThrow("Push registration failed");
    expect(save.secondCall.args).toEqual([ConfigKey.SYSTEM, previous]);
    expect(update.secondCall.args[1].$set.enabled).toBe(false);
  });

  it("fails explicitly when a required Gmail connection has disappeared", async () => {
    sandbox.stub(inboxMailboxConnection, "findById").returns({lean: async () => null} as any);
    await expect(poller.activateConnectionAfterReconnect("missing-connection", true)).rejects.toThrow("no longer exists");
  });

  it("keeps Gmail polling untouched when saving the new provider fails", async () => {
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(systemConfigModule, "systemConfig").resolves({inbox: {provider: InboxReaderProvider.GMAIL_API}} as any);
    stubConnections([{id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: true, oauthRefreshTokenEncrypted: "token"}]);
    sandbox.stub(configController, "createOrUpdateKey").rejects(new Error("Configuration unavailable"));
    const ensure = sandbox.stub(ingress, "ensureCloudflareIngressConnection").resolves({id: "cf1"} as any);
    const update = sandbox.stub(inboxMailboxConnection, "updateMany").resolves({} as any);
    const stop = sandbox.stub(gmailReader, "stopGmailWatch").resolves();
    await expect(applyInboxProviderSwitch(InboxReaderProvider.CLOUDFLARE_INGRESS, "member-1")).rejects.toThrow("Configuration unavailable");
    expect(ensure.called).toBe(false);
    expect(update.called).toBe(false);
    expect(stop.called).toBe(false);
  });

  [InboxReaderProvider.CLOUDFLARE_INGRESS, InboxReaderProvider.GMAIL_API].forEach(provider => {
    it(`restores the provider and Gmail connection state when switching to ${provider} fails`, async () => {
      const direct = provider === InboxReaderProvider.CLOUDFLARE_INGRESS;
      const previous = {inbox: {provider: direct ? InboxReaderProvider.GMAIL_API : InboxReaderProvider.CLOUDFLARE_INGRESS}};
      sandbox.stub(aliases, "defaultTenantSlug").returns("default");
      sandbox.stub(aliases, "clearDerivedAliasCache");
      sandbox.stub(systemConfigModule, "systemConfig").resolves(previous as any);
      stubConnections([{id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: direct, oauthRefreshTokenEncrypted: "token"}]);
      const save = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
      sandbox.stub(ingress, "ensureCloudflareIngressConnection").resolves({id: "cf1"} as any);
      const update = sandbox.stub(inboxMailboxConnection, "updateMany");
      update.onFirstCall().rejects(new Error("Connection update failed"));
      update.onSecondCall().resolves({} as any);
      await expect(applyInboxProviderSwitch(provider, "member-1")).rejects.toThrow("Connection update failed");
      expect(save.calledTwice).toBe(true);
      expect(save.secondCall.args).toEqual([ConfigKey.SYSTEM, previous]);
      expect(update.secondCall.args[1].$set.enabled).toBe(direct);
    });
  });

  it("reports incomplete recovery and still attempts to restore the previous provider", async () => {
    const previous = {inbox: {provider: InboxReaderProvider.GMAIL_API}};
    sandbox.stub(aliases, "defaultTenantSlug").returns("default");
    sandbox.stub(aliases, "clearDerivedAliasCache");
    sandbox.stub(systemConfigModule, "systemConfig").resolves(previous as any);
    stubConnections([{id: "g1", provider: InboxReaderProvider.GMAIL_API, enabled: true}]);
    const save = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
    sandbox.stub(ingress, "ensureCloudflareIngressConnection").resolves({id: "cf1"} as any);
    sandbox.stub(inboxMailboxConnection, "updateMany").rejects(new Error("Database unavailable"));
    await expect(applyInboxProviderSwitch(InboxReaderProvider.CLOUDFLARE_INGRESS, "member-1")).rejects.toThrow("recovery was incomplete");
    expect(save.secondCall.args).toEqual([ConfigKey.SYSTEM, previous]);
  });

});
