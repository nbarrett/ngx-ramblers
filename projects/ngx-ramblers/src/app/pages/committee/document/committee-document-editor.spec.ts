import {Component, EventEmitter, Input, Output} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {LoggerTestingModule} from "ngx-logger/testing";
import {CommitteeFile} from "../../../models/committee.model";
import {TiptapMarkdownEditor} from "../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import {StickyControlsDirective} from "../../../modules/common/tiptap-editor/sticky-controls.directive";
import {DocumentPrintService} from "../../../services/document-print.service";
import {CommitteeDocumentView} from "./committee-document-view";
import {CommitteeDocumentEditor} from "./committee-document-editor";

@Component({selector: "app-tiptap-markdown-editor", template: "{{ value }}"})
class MarkdownEditorStub {
  @Input() value: string;
  @Input() placeholder: string;
  @Output() valueChange = new EventEmitter<string>();
}

@Component({selector: "app-committee-document-view", template: "{{ committeeFile.document.markdown }}"})
class DocumentViewStub {
  @Input() committeeFile: CommitteeFile;
}

describe("shared committee document editing", () => {
  const file = {fileType: "Programme", document: {title: "Winter programme", markdown: "## Hillside Park"}} as CommitteeFile;
  const printer = {print: vi.fn()};

  beforeEach(() => {
    printer.print.mockReset().mockResolvedValue(null);
    TestBed.configureTestingModule({imports: [CommitteeDocumentEditor, LoggerTestingModule],
      providers: [{provide: DocumentPrintService, useValue: printer}]});
    TestBed.overrideComponent(CommitteeDocumentEditor, {
      remove: {imports: [TiptapMarkdownEditor, CommitteeDocumentView, StickyControlsDirective]},
      add: {imports: [MarkdownEditorStub, DocumentViewStub]}
    });
  });

  it("shows either editing or the shared document preview and preserves edits when switching", () => {
    const fixture = TestBed.createComponent(CommitteeDocumentEditor);
    fixture.componentRef.setInput("committeeFile", file);
    fixture.componentRef.setInput("value", "Edited programme");
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector("app-tiptap-markdown-editor")?.textContent).toBe("Edited programme");
    expect(host.querySelector("app-committee-document-view")).toBeNull();
    const previewChanged = vi.spyOn(fixture.componentInstance.previewingChange, "emit");
    host.querySelector<HTMLButtonElement>("button").click();
    fixture.detectChanges();
    expect(previewChanged).toHaveBeenCalledWith(true);
    expect(host.querySelector("app-tiptap-markdown-editor")).toBeNull();
    expect(host.querySelectorAll("app-committee-document-view")).toHaveLength(1);
    host.querySelector<HTMLButtonElement>("button").click();
    fixture.detectChanges();
    expect(host.querySelector("app-tiptap-markdown-editor")?.textContent).toBe("Edited programme");
    expect(host.querySelector("app-committee-document-view")).toBeNull();
  });

  it("uses the same print service for read-only documents and reports printing failures", async () => {
    const fixture = TestBed.createComponent(CommitteeDocumentEditor);
    fixture.componentRef.setInput("committeeFile", file);
    fixture.componentRef.setInput("editable", false);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector("app-tiptap-markdown-editor")).toBeNull();
    expect(host.querySelectorAll("button")).toHaveLength(1);
    await fixture.componentInstance.print();
    expect(printer.print).toHaveBeenCalledWith(host.querySelector("app-committee-document-view").parentElement, "Winter programme");
    printer.print.mockRejectedValueOnce(new Error("Printer unavailable"));
    await fixture.componentInstance.print();
    fixture.detectChanges();
    expect(host.querySelector(".alert-danger")?.textContent).toContain("Could not print the document");
    expect(host.querySelector<HTMLButtonElement>("button").disabled).toBe(false);
  });
});
