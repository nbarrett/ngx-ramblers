import { ComponentFixture, TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { IconExamplesComponent } from "./icon-examples";

describe("IconExamplesComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconExamplesComponent, LoggerTestingModule]
    }).compileComponents();
  });

  function createComponent(value?: string): ComponentFixture<IconExamplesComponent> {
    const fixture = TestBed.createComponent(IconExamplesComponent);
    fixture.componentInstance.compactMode = true;
    if (value) {
      fixture.componentInstance.value = value;
    }
    fixture.detectChanges();
    return fixture;
  }

  it("shows matching icons with a preview when the filter changes", () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.modelChanged("pencil");
    component.refreshFilter("pencil");
    expect(component.filteredIcons.some(item => item.key === "faPencil")).toBe(true);
  });

  it("emits the chosen icon key when an icon is selected", () => {
    const fixture = createComponent();
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe(key => emitted.push(key));
    fixture.componentInstance.selectIcon("faCertificate");
    expect(emitted).toEqual(["faCertificate"]);
    expect(fixture.componentInstance.value).toEqual("faCertificate");
    expect(fixture.componentInstance.filter).toEqual("faCertificate");
    expect(fixture.componentInstance.selectedIcon()?.iconName).toEqual("certificate");
    expect(fixture.componentInstance.displayedIcons.some(item => item.key === "faCertificate")).toBe(true);
  });

  it("puts the current icon in the input", async () => {
    const fixture = createComponent("faCertificate");
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.filter).toEqual("faCertificate");
    const input: HTMLInputElement = fixture.nativeElement.querySelector("#icon-filter");
    expect(input.value).toEqual("faCertificate");
    expect(fixture.nativeElement.querySelector(".icon-picker-current")).toBeNull();
  });

  it("filters the list as characters are deleted from the current icon", () => {
    const fixture = createComponent("faCertificate");
    fixture.componentInstance.openPicker();
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe(key => emitted.push(key));
    fixture.componentInstance.gridSearchChanged("faCert");
    expect(emitted).toEqual([]);
    expect(fixture.componentInstance.value).toEqual("faCertificate");
    expect(fixture.componentInstance.gridIcons.some(item => item.key === "faCertificate")).toBe(true);
    expect(fixture.componentInstance.gridIcons.length).toBeLessThan(fixture.componentInstance.iconService.iconArray.length);
  });

  it("selects an icon when the input is an exact match", () => {
    const fixture = createComponent("faCertificate");
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe(key => emitted.push(key));
    fixture.componentInstance.modelChanged("faPencil");
    expect(emitted).toEqual(["faPencil"]);
    expect(fixture.componentInstance.value).toEqual("faPencil");
    expect(fixture.componentInstance.selectedIcon()?.iconName).toEqual("pencil");
  });

  it("counts matches from the text that has been entered", () => {
    const fixture = createComponent();
    fixture.componentInstance.filter = "pencil";
    fixture.componentInstance.openPicker();
    expect(fixture.componentInstance.iconMatchCount()).toBeLessThan(fixture.componentInstance.iconService.iconArray.length);
    expect(fixture.componentInstance.gridIcons.length).toEqual(fixture.componentInstance.iconMatchCount());
  });

  it("lists every icon in the choose-icon panel", () => {
    const fixture = createComponent();
    fixture.componentInstance.openPicker();
    expect(fixture.componentInstance.pickerOpen).toBe(true);
    expect(fixture.componentInstance.gridFilter).toEqual("");
    expect(fixture.componentInstance.gridIcons.length).toEqual(fixture.componentInstance.iconService.iconArray.length);
    expect(fixture.componentInstance.gridIcons.length).toBeGreaterThan(1000);
  });

  it("shows the current icon when choosing", () => {
    const fixture = createComponent("faPencil");
    fixture.componentInstance.openPicker();
    expect(fixture.componentInstance.filter).toEqual("faPencil");
    expect(fixture.componentInstance.gridFilter).toEqual("faPencil");
    expect(fixture.componentInstance.selectedIcon()?.iconName).toEqual("pencil");
    expect(fixture.componentInstance.changeIconLabel()).toEqual("Change icon");
    expect(fixture.componentInstance.isSelected("faPencil")).toBe(true);
    expect(fixture.componentInstance.gridIcons.some(item => item.key === "faPencil")).toBe(true);
  });

  it("filters the list as the search is edited", () => {
    const fixture = createComponent("faPencil");
    fixture.componentInstance.openPicker();
    fixture.componentInstance.gridSearchChanged("penc");
    expect(fixture.componentInstance.iconMatchCount()).toBeGreaterThan(1);
    expect(fixture.componentInstance.gridIcons.length).toEqual(fixture.componentInstance.iconMatchCount());
  });

  it("does not mount every icon while typing a partial name", () => {
    const fixture = createComponent("faFile");
    fixture.componentInstance.openPicker();
    fixture.componentInstance.gridSearchChanged("faFil");
    expect(fixture.componentInstance.gridIcons.length).toBeLessThan(fixture.componentInstance.iconService.iconArray.length);
    expect(fixture.componentInstance.displayedGridIcons.length).toBeLessThanOrEqual(fixture.componentInstance.maxGridWindowRows * fixture.componentInstance.gridColumns);
  });

  it("shows the current icon name for editing", () => {
    const fixture = createComponent("faPencil");
    fixture.componentInstance.openPicker();
    expect(fixture.componentInstance.filter).toEqual("faPencil");
    expect(fixture.componentInstance.gridFilter).toEqual("faPencil");
  });

  it("selects an icon from the panel and closes it", () => {
    const fixture = createComponent();
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe(key => emitted.push(key));
    fixture.componentInstance.openPicker();
    fixture.componentInstance.selectIcon("faCertificate");
    expect(emitted).toEqual(["faCertificate"]);
    expect(fixture.componentInstance.value).toEqual("faCertificate");
    expect(fixture.componentInstance.filter).toEqual("faCertificate");
    expect(fixture.componentInstance.pickerOpen).toBe(false);
  });

  it("emits a chosen colour", () => {
    const fixture = createComponent("faPencil");
    const emitted: (string | null)[] = [];
    fixture.componentInstance.iconColourChange.subscribe(colour => emitted.push(colour));
    fixture.componentInstance.selectColourValue("#e0393e");
    expect(emitted).toEqual(["#e0393e"]);
    expect(fixture.componentInstance.iconColour).toEqual("#e0393e");
    expect(fixture.componentInstance.colourStyle()).toEqual("#e0393e");
  });

  it("offers a colour select that can open the palette", () => {
    const fixture = createComponent("faPencil");
    const menu = fixture.componentInstance.colourMenu;
    expect(menu.some(item => item.label === "Palette")).toBe(true);
    fixture.componentInstance.modelChanged("faFil");
    expect(fixture.componentInstance.colourMenu).toBe(menu);
    fixture.componentInstance.onColourMenuChange(fixture.componentInstance.IconColourMenu.PALETTE);
    expect(fixture.componentInstance.colourPaletteOpen).toBe(true);
  });

  it("opens the choose-icon panel from a partial name", () => {
    const fixture = createComponent("faFile");
    fixture.componentInstance.modelChanged("faFil");
    fixture.componentInstance.onIconNameEnter(new Event("keydown"));
    expect(fixture.componentInstance.pickerOpen).toBe(true);
    expect(fixture.componentInstance.gridFilter).toEqual("faFil");
    expect(fixture.componentInstance.gridIcons.some(item => item.key === "faFile")).toBe(true);
  });

  it("uses mintcake as the default colour", () => {
    const fixture = createComponent("faPencil");
    const emitted: (string | null)[] = [];
    fixture.componentInstance.iconColourChange.subscribe(colour => emitted.push(colour));
    expect(fixture.componentInstance.colourStyle()).toEqual("rgb(155, 200, 171)");
    expect(fixture.componentInstance.selectedColourMenuValue).toEqual(fixture.componentInstance.IconColourMenu.DEFAULT);
    expect(fixture.componentInstance.colourMenu.some(item => item.label === "Granite")).toBe(true);
    expect(fixture.componentInstance.selectedColourMenuValue).not.toEqual("#404141");
    fixture.componentInstance.onColourMenuChange("#e0393e");
    fixture.componentInstance.onColourMenuChange(fixture.componentInstance.IconColourMenu.DEFAULT);
    expect(emitted).toEqual(["#e0393e", null]);
    expect(fixture.componentInstance.iconColour).toBeNull();
    expect(fixture.componentInstance.selectedColourMenuValue).toEqual(fixture.componentInstance.IconColourMenu.DEFAULT);
  });

  it("applies a named colour from the select", () => {
    const fixture = createComponent("faPencil");
    const emitted: (string | null)[] = [];
    fixture.componentInstance.iconColourChange.subscribe(colour => emitted.push(colour));
    fixture.componentInstance.onColourMenuChange("#e0393e");
    expect(emitted).toEqual(["#e0393e"]);
    expect(fixture.componentInstance.selectedColourMenuValue).toEqual("#e0393e");
    fixture.componentInstance.onColourMenuChange("#e0393e");
    expect(emitted).toEqual(["#e0393e"]);
  });
});
