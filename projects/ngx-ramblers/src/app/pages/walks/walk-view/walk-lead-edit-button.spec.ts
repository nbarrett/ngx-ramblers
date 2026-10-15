import { WalkLeadEditButton } from "./walk-lead-edit-button";
import { WalkLeadEditAction } from "../../../models/walk-edit-mode.model";
import { DisplayedWalk } from "../../../models/walk.model";

describe("social event split action", () => {
  it("offers Edit and View and sends View to the event page", () => {
    const button = Object.create(WalkLeadEditButton.prototype) as WalkLeadEditButton;
    button.displayedWalk = {walk: {id: "event-one"}} as DisplayedWalk;
    button.display = {isWalk: () => false, openGroupEventView: vi.fn(), edit: vi.fn()} as unknown as typeof button.display;
    expect(button["leadEditItems"]().map(item => item.id)).toEqual([WalkLeadEditAction.EDIT, WalkLeadEditAction.VIEW]);
    button["onLeadEdit"](WalkLeadEditAction.VIEW);
    expect(button.display.openGroupEventView).toHaveBeenCalledWith(button.displayedWalk.walk);
    expect(button.display.edit).not.toHaveBeenCalled();
  });
});
