import { BrevoContactViewComponent } from "./brevo-contact-view";
import { BrevoEventType } from "../../../models/mail.model";

describe("member activity pagination", () => {
  it("uses the statistics cursor after the first page adds supplementary sends", async () => {
    const view = Object.create(BrevoContactViewComponent.prototype) as BrevoContactViewComponent;
    view.contactEmail = "alex.reed@example.com";
    const sent = {messageId: "send-one", email: view.contactEmail, event: BrevoEventType.REQUESTS, date: "2026-10-25T12:00:00.000Z"};
    view["resetState"]({events: [sent, {...sent, messageId: "send-two"}], eventsOffset: 1, canLoadMore: true});
    const events = vi.fn().mockResolvedValue({events: [sent], nextOffset: 2, hasMore: false});
    view["brevoContactService"] = {getEmailEventReport: events} as unknown as typeof view["brevoContactService"];
    await view["loadMore"]();
    expect(events).toHaveBeenCalledWith(view.contactEmail, expect.objectContaining({offset: 1}));
    expect(view["state"].events.length).toBe(2);
    expect(view["state"].eventsOffset).toBe(2);
    expect(view["state"].canLoadMore).toBe(false);
  });
});
