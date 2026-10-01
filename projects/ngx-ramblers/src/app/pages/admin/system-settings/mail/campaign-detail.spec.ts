import {describe, expect, it, vi} from "vitest";
import {CampaignDetailComponent} from "./campaign-detail";
import {EventType} from "../../../../models/websocket.model";

describe("campaign recipient connections", () => {
  function context(connect: () => Promise<void>) {
    return {
      campaignId: 812,
      selectedEventType: "delivered",
      loadingRecipients: false,
      recipients: [],
      truncated: false,
      recipientsError: null,
      recipientsProgressMessage: null,
      authService: {authToken: () => "fictional-token"},
      webSocketClientService: {connect, sendMessage: vi.fn()},
      logger: {warn: vi.fn()}
    };
  }

  it("includes credentials when requesting a recipient export", async () => {
    const state = context(() => Promise.resolve());
    await CampaignDetailComponent.prototype["loadRecipients"].call(state, "delivered");
    expect(state.webSocketClientService.sendMessage).toHaveBeenCalledWith(EventType.CAMPAIGN_RECIPIENT_EXPORT, {campaignId: 812, type: "delivered"}, "fictional-token");
  });

  it("stops loading and reports a failed connection", async () => {
    const state = context(() => Promise.reject(new Error("Connection failed")));
    await CampaignDetailComponent.prototype["loadRecipients"].call(state, "delivered");
    expect(state.loadingRecipients).toBe(false);
    expect(state.recipientsError).toBe("Could not connect to load recipients. Try View again.");
    expect(state.webSocketClientService.sendMessage).not.toHaveBeenCalled();
  });

  it("does not request a report after the selected campaign changes", async () => {
    const state = context(async () => { state.campaignId = 813; });
    await CampaignDetailComponent.prototype["loadRecipients"].call(state, "delivered");
    expect(state.webSocketClientService.sendMessage).not.toHaveBeenCalled();
  });
});
