import {NgSelectComponent} from "@ng-select/ng-select";
import {Component, EventEmitter, Input, Output} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {provideRouter} from "@angular/router";
import {describe, expect, it, vi} from "vitest";
import {EventTemplateSettingsComponent} from "./event-template-settings";
import {EventTemplatePreviewComponent} from "./event-template-preview";
import {TiptapMarkdownEditor} from "../../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import {EventTemplateService} from "../../../../services/mail/event-template.service";
import {PageContent} from "../../../../models/content-text.model";

@Component({selector: "app-tiptap-markdown-editor", template: `<div>{{value}}</div>`})
class EditorStub {
  @Input() value = "";
  @Input() showMergeFields = false;
  @Input() mergeFieldCatalogue = [];
  @Input() eventImageHeight = 240;
  @Output() valueChange = new EventEmitter<string>();
  @Output() eventImageHeightChange = new EventEmitter<number>();
}

@Component({selector: "app-event-template-preview", template: `<div>{{template}}</div>`})
class PreviewStub {
  @Input() template = "";
  @Input() imageHeight = 240;
}

describe("existing event format settings", () => {
  const original = {path: "fragments/templates/event-programme/detailed", migrationTemplate: {templateName: "Detailed"}} as PageContent;

  async function setup() {
    const templates = {available: vi.fn().mockResolvedValue([original]), content: () => "{{title}}", imageHeight: () => 240,
      save: vi.fn().mockImplementation(async (name: string, markdown: string, existing: PageContent | null) => ({
        ...original, id: existing ? "saved-format" : "copied-format",
        path: existing ? original.path : "fragments/templates/event-programme/walk-with-image",
        migrationTemplate: {templateName: name}, markdown
      }))};
    TestBed.configureTestingModule({imports: [EventTemplateSettingsComponent],
      providers: [provideRouter([]), {provide: EventTemplateService, useValue: templates}]});
    TestBed.overrideComponent(EventTemplateSettingsComponent, {remove: {imports: [TiptapMarkdownEditor, EventTemplatePreviewComponent]},
      add: {imports: [EditorStub, PreviewStub]}});
    const fixture = TestBed.createComponent(EventTemplateSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {fixture, templates, host: fixture.nativeElement as HTMLElement};
  }

  it("starts with an existing format and saves edits to that format while updating preview", async () => {
    const {fixture, templates, host} = await setup();
    expect(fixture.debugElement.query(By.directive(NgSelectComponent)).componentInstance.selectedItems[0].label).toContain("Detailed");
    expect(host.querySelector<HTMLInputElement>("#event-template-name").value).toBe("Detailed");
    fixture.debugElement.query(By.directive(EditorStub)).componentInstance.valueChange.emit("Revised {{title}} {{image}}");
    fixture.detectChanges();
    expect(host.querySelector("app-event-template-preview").textContent).toContain("Revised {{title}} {{image}}");
    host.querySelector<HTMLButtonElement>("button.btn-primary").click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(templates.save).toHaveBeenCalledWith("Detailed", "Revised {{title}} {{image}}", original, 240);
    expect(host.textContent).toContain("Event format saved");
  });

  it("saves a renamed copy without replacing the selected format", async () => {
    const {fixture, templates, host} = await setup();
    fixture.debugElement.query(By.directive(EditorStub)).componentInstance.valueChange.emit("{{title}} {{image}}");
    const name = host.querySelector<HTMLInputElement>("#event-template-name");
    name.value = "Walk with image";
    name.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>("button.btn-quiet").click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(templates.save).toHaveBeenCalledWith("Walk with image", "{{title}} {{image}}", null, 240);
    expect(host.querySelector<HTMLInputElement>("#event-template-name").value).toBe("Walk with image");
    expect(host.textContent).toContain("The original is unchanged");
  });

  it("asks for a new name before saving a copy of the same format", async () => {
    const {fixture, templates, host} = await setup();
    host.querySelector<HTMLButtonElement>("button.btn-quiet").click();
    fixture.detectChanges();
    expect(templates.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Enter a new name to save a copy");
  });
});
