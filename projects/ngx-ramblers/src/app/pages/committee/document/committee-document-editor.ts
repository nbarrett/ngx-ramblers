import {booleanAttribute, Component, ElementRef, EventEmitter, inject, Input, Output, signal, ViewChild} from "@angular/core";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faCircleExclamation, faEye, faPencil, faPrint} from "@fortawesome/free-solid-svg-icons";
import {NgxLoggerLevel} from "ngx-logger";
import {CommitteeFile} from "../../../models/committee.model";
import {TiptapMarkdownEditor} from "../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import {StickyControlsDirective} from "../../../modules/common/tiptap-editor/sticky-controls.directive";
import {DocumentPrintService} from "../../../services/document-print.service";
import {LoggerFactory} from "../../../services/logger-factory.service";
import {CommitteeDocumentView} from "./committee-document-view";

@Component({
  selector: "app-committee-document-editor",
  imports: [FontAwesomeModule, TiptapMarkdownEditor, StickyControlsDirective, CommitteeDocumentView],
  styles: [`
    :host
      display: block
      position: relative
      z-index: 0
  `],
  template: `
    <div appStickyControls class="committee-file-editor-actions d-print-none">
      <div class="d-flex gap-2 flex-wrap">
        <ng-content/>
        @if (editable) {
          <button type="button" class="btn btn-quiet" [disabled]="disabled || printing()" (click)="togglePreview()">
            <fa-icon [icon]="previewing ? faPencil : faEye" class="me-2"/>
            {{ previewing ? 'Edit document' : 'Preview document / PDF' }}
          </button>
        }
        @if (!editable || previewing) {
          <button type="button" class="btn btn-primary" [disabled]="disabled || printing()" (click)="print()">
            <fa-icon [icon]="faPrint" class="me-2"/>
            {{ printing() ? 'Preparing print…' : 'Print / Save as PDF' }}
          </button>
        }
      </div>
    </div>
    @if (printFailed()) {
      <div class="alert alert-danger d-flex align-items-start gap-2 mt-3">
        <fa-icon [icon]="faCircleExclamation"/>
        <div><strong class="d-block">Could not print the document</strong>Please try printing again.</div>
      </div>
    }
    @if (editable && !previewing) {
      <div class="committee-document-editing">
        <app-tiptap-markdown-editor showPageBreak [value]="value ?? committeeFile?.document?.markdown ?? ''"
                                   placeholder="Write your document here…" (valueChange)="valueChange.emit($event)"/>
      </div>
    } @else {
      <div #documentPreview>
        <app-committee-document-view [committeeFile]="committeeFile"/>
      </div>
    }
  `
})
export class CommitteeDocumentEditor {
  private printer = inject(DocumentPrintService);
  private logger = inject(LoggerFactory).createLogger("CommitteeDocumentEditor", NgxLoggerLevel.ERROR);
  @Input() committeeFile: CommitteeFile;
  @Input() value: string | null = null;
  @Input({transform: booleanAttribute}) editable = true;
  @Input({transform: booleanAttribute}) disabled = false;
  @Input({transform: booleanAttribute}) previewing = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() previewingChange = new EventEmitter<boolean>();
  @ViewChild("documentPreview") private documentPreview: ElementRef<HTMLElement>;
  protected printing = signal(false);
  protected printFailed = signal(false);
  protected readonly faEye = faEye;
  protected readonly faPencil = faPencil;
  protected readonly faPrint = faPrint;
  protected readonly faCircleExclamation = faCircleExclamation;

  protected togglePreview(): void {
    this.previewing = !this.previewing;
    this.previewingChange.emit(this.previewing);
  }

  async print(): Promise<void> {
    if (this.documentPreview && !this.printing()) {
      this.printing.set(true);
      this.printFailed.set(false);
      try {
        await this.printer.print(this.documentPreview.nativeElement, this.committeeFile?.document?.title || this.committeeFile?.fileType || "Document");
      } catch (error) {
        this.logger.error("Document printing failed", error);
        this.printFailed.set(true);
      } finally {
        this.printing.set(false);
      }
    }
  }
}
