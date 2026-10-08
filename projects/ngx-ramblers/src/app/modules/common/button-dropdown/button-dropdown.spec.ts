import { describe, expect, it, vi } from "vitest";
import { faFolderOpen, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { ButtonDropdownComponent } from "./button-dropdown";
import { ButtonDropdownItem } from "../../../models/button-dropdown.model";

describe("app-button-dropdown", () => {
  it("emits the chosen item id", () => {
    const instance: any = Object.create(ButtonDropdownComponent.prototype);
    instance.disabled = false;
    instance.itemSelect = {emit: vi.fn()};
    const sent: ButtonDropdownItem = {id: "sent", label: "Sent (54)", icon: faPaperPlane};
    instance.choose(sent);
    expect(instance.itemSelect.emit).toHaveBeenCalledWith("sent");
    instance.choose({id: "drafts", label: "Drafts (0)", icon: faFolderOpen, disabled: true});
    expect(instance.itemSelect.emit).toHaveBeenCalledTimes(1);
  });

  it("emits the default item from the main button", () => {
    const instance: any = Object.create(ButtonDropdownComponent.prototype);
    instance.disabled = false;
    instance.defaultItemId = "save-and-exit";
    instance.items = [
      {id: "save-and-exit", label: "Save and exit"},
      {id: "cancel", label: "Exit without saving"}
    ];
    instance.itemSelect = {emit: vi.fn()};
    instance.chooseDefault();
    expect(instance.itemSelect.emit).toHaveBeenCalledWith("save-and-exit");
  });
});
