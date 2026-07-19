import { walkNotificationActorName } from "./walk-notification";

describe("walkNotificationActorName", () => {
  it("addresses the person who made the change as you", () => {
    expect(walkNotificationActorName("jayne-id", "jayne-id", "Jayne Smith")).toBe("you");
  });

  it("names the person who made the change when the recipient is someone else", () => {
    expect(walkNotificationActorName("jayne-id", "coordinator-id", "Jayne Smith")).toBe("Jayne Smith");
  });
});
