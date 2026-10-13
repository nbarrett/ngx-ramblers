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

  it("does not emit a default action when the control is disabled", () => {
    const instance: any = Object.create(ButtonDropdownComponent.prototype);
    instance.disabled = true;
    instance.defaultItemId = "save-and-exit";
    instance.items = [
      {id: "save-and-exit", label: "Save and exit"},
      {id: "cancel", label: "Exit without saving"}
    ];
    instance.itemSelect = {emit: vi.fn()};
    instance.chooseDefault();
    expect(instance.itemSelect.emit).not.toHaveBeenCalled();
  });

  it("keeps the button as a menu toggle when no default is set", () => {
    const instance: any = Object.create(ButtonDropdownComponent.prototype);
    instance.disabled = false;
    instance.defaultItemId = null;
    instance.items = [
      {id: "lead", label: "lead"},
      {id: "edit", label: "edit"}
    ];
    instance.itemSelect = {emit: vi.fn()};
    instance.chooseDefault();
    expect(instance.hasDefaultAction()).toBe(false);
    expect(instance.itemSelect.emit).not.toHaveBeenCalled();
  });
});
