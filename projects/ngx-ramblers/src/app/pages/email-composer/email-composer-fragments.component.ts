import { Component, inject, Input, TemplateRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGripVertical, faAlignLeft, faAddressCard, faCalendarDays, faSignature, faCircleInfo, faTableColumns, faGripLines, faFile, faChevronDown, faChevronRight, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import { isUndefined } from "es-toolkit/compat";
import { ArticleBlock, ComposerFragment, ComposerFragmentKind, EmailComposerState, EventInclusionMode, EXPANDABLE_FRAGMENT_KINDS, DragHoverPosition, SECTION_DIVIDER_OPTIONS } from "../../models/email-composer.model";
import { CommitteeFile } from "../../models/committee.model";
import { EmailComposerFragmentBodyContext } from "../../models/email-composer.model";
import { EmailComposerFragmentsService } from "../../services/email-composer/email-composer-fragments.service";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { SectionDividerSelectComponent } from "../../modules/common/section-divider-select/section-divider-select";
@Component({
    selector: "app-email-composer-fragments",
    imports: [CommonModule, FontAwesomeModule, SectionDividerSelectComponent],
    styleUrls: ["./email-composer-fragments.sass"],
    template: `
    <ng-container *ngTemplateOutlet="fragmentListTemplate; context: {$implicit: state.fragmentOrder ?? [], parentPath: []}"/>
    <ng-template #fragmentListTemplate let-fragments let-parentPath="parentPath">
      <div class="fragment-list">
        @for (fragment of fragments; let i = $index; track fragment.id + ':' + i) {
          @if (showComposerFragment(fragment)) {
          <div class="fragment-row"
               [class.fragment-row-hover-before]="editor.isDragHover(state, parentPath.concat([i])) && editor.dragHoverPosition === DragHoverPosition.Before"
               [class.fragment-row-hover-after]="editor.isDragHover(state, parentPath.concat([i])) && editor.dragHoverPosition === DragHoverPosition.After"
               (dragover)="editor.onFragmentDragOver(state, parentPath.concat([i]), $event)"
               (drop)="editor.onFragmentDrop(state, parentPath.concat([i]))">
            <div class="fragment-row-header" [attr.draggable]="true"
                 (dragstart)="editor.onFragmentDragStart(state, parentPath.concat([i]), $event)"
                 (dragend)="editor.onFragmentDragEnd(state)"
                 [class.fragment-row-header-clickable]="fragmentIsExpandable(fragment) || fragment.kind === ComposerFragmentKind.EVENTS || fragment.kind === ComposerFragmentKind.TEMPLATE_CONTENT"
                 (click)="(fragmentIsExpandable(fragment) || fragment.kind === ComposerFragmentKind.EVENTS || fragment.kind === ComposerFragmentKind.TEMPLATE_CONTENT) && editor.toggleFragmentExpanded(state, fragment.id)">
              <span class="fragment-handle" title="Drag to reorder this section">
                <fa-icon [icon]="faGripVertical"/>
              </span>
              <span class="fragment-icon">
                @switch (fragment.kind) {
                  @case (ComposerFragmentKind.INTRO) { <fa-icon [icon]="faAlignLeft"/> }
                  @case (ComposerFragmentKind.ARTICLE) { <fa-icon [icon]="faAddressCard"/> }
                  @case (ComposerFragmentKind.EVENTS) { <fa-icon [icon]="faCalendarDays"/> }
                  @case (ComposerFragmentKind.SIGNOFF) { <fa-icon [icon]="faSignature"/> }
                  @case (ComposerFragmentKind.TEMPLATE_CONTENT) { <fa-icon [icon]="faCircleInfo"/> }
                  @case (ComposerFragmentKind.MULTI_COLUMN) { <fa-icon [icon]="faTableColumns"/> }
                  @case (ComposerFragmentKind.DIVIDER) { <fa-icon [icon]="faGripLines"/> }
                  @case (ComposerFragmentKind.COMMITTEE_FILE) { <fa-icon [icon]="faFile"/> }
                }
              </span>
              <div class="fragment-meta">
                <div class="fragment-label">{{ fragmentLabel(fragment) }}</div>
                <div class="fragment-preview text-muted small">{{ fragmentPreview(fragment) }}</div>
              </div>
              @if (fragmentIsExpandable(fragment)) {
                <span class="fragment-chevron"
                      [title]="editor.isFragmentExpanded(state, fragment.id) ? 'Collapse' : 'Expand'">
                  <fa-icon [icon]="editor.isFragmentExpanded(state, fragment.id) ? faChevronDown : faChevronRight"/>
                </span>
              }
              @if (fragment.kind !== ComposerFragmentKind.TEMPLATE_CONTENT) {
                <button type="button" class="btn btn-sm btn-danger"
                        (click)="$event.stopPropagation(); editor.removeFragment(state, parentPath.concat([i]))"
                        title="Remove section">
                  <fa-icon [icon]="faTrash"/>
                </button>
              }
            </div>
            <div class="fragment-divider-cell" (click)="$event.stopPropagation()">
              <app-section-divider-select [label]="fragment.kind === ComposerFragmentKind.DIVIDER ? 'Style' : 'Divider after'"
                                          [value]="fragment.dividerAfter"
                                          (valueChange)="editor.onFragmentDividerChange(state, parentPath.concat([i]), $event)"/>
            </div>
            @if (editor.isFragmentExpanded(state, fragment.id)) {
              <div class="fragment-row-body">
                @if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) {
                    <div class="composer-multi-column-row">
                      @for (column of fragment.columns ?? []; let columnIndex = $index; track columnIndex) {
                        <div class="composer-column"
                             [class.composer-column-hover]="editor.isColumnDragHover(state, parentPath.concat([i, columnIndex]))">
                          <div class="composer-column-heading text-muted small">Column {{ columnIndex + 1 }}</div>
                          <ng-container *ngTemplateOutlet="fragmentListTemplate; context: { $implicit: column, parentPath: parentPath.concat([i, columnIndex]) }"/>
                          <div class="composer-column-tail"
                               (dragover)="editor.onColumnDragOver(state, parentPath.concat([i, columnIndex]), $event)"
                               (drop)="editor.onColumnDrop(state, parentPath.concat([i, columnIndex]))">
                            Drop section here
                          </div>
                          <div class="composer-column-add">
                            <button type="button" class="btn btn-sm btn-primary"
                                    (click)="editor.addArticleFragment(state, parentPath.concat([i, columnIndex]))">
                              <fa-icon [icon]="faPlus"/> Add article to column
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                } @else {
                  <ng-container *ngTemplateOutlet="bodyTemplate; context: {$implicit: fragment}"/>
                }
              </div>
            }
          </div>
          }
        }
        <div class="fragment-list-tail"
             (dragover)="editor.onColumnDragOver(state, parentPath, $event)"
             (drop)="editor.onColumnDrop(state, parentPath)"
             [class.fragment-list-tail-hover]="editor.isColumnDragHover(state, parentPath)"></div>
      </div>
    </ng-template>
  `
})
export class EmailComposerFragmentsComponent {
    @Input({ required: true })
    state!: EmailComposerState;
    @Input({ required: true })
    bodyTemplate!: TemplateRef<EmailComposerFragmentBodyContext>;
    @Input()
    committeeFiles = new Map<string, CommitteeFile>();
    @Input()
    eventSummary = "";
    protected editor = inject(EmailComposerFragmentsService);
    protected committeeDisplayService = inject(CommitteeDisplayService);
    protected readonly ComposerFragmentKind = ComposerFragmentKind;
    protected readonly DragHoverPosition = DragHoverPosition;
    protected readonly faGripVertical = faGripVertical;
    protected readonly faAlignLeft = faAlignLeft;
    protected readonly faAddressCard = faAddressCard;
    protected readonly faCalendarDays = faCalendarDays;
    protected readonly faSignature = faSignature;
    protected readonly faCircleInfo = faCircleInfo;
    protected readonly faTableColumns = faTableColumns;
    protected readonly faGripLines = faGripLines;
    protected readonly faFile = faFile;
    protected readonly faChevronDown = faChevronDown;
    protected readonly faChevronRight = faChevronRight;
    protected readonly faTrash = faTrash;
    protected readonly faPlus = faPlus;
    protected fragmentLabel(fragment: ComposerFragment): string {
        switch (fragment.kind) {
            case ComposerFragmentKind.INTRO: return "Body / intro";
            case ComposerFragmentKind.ARTICLE: return "Article block";
            case ComposerFragmentKind.EVENTS: return "Events list";
            case ComposerFragmentKind.SIGNOFF: return "Signoff";
            case ComposerFragmentKind.TEMPLATE_CONTENT: return "Template content";
            case ComposerFragmentKind.MULTI_COLUMN: return `${(fragment.columns ?? []).length}-column row`;
            case ComposerFragmentKind.DIVIDER: return "Divider";
            case ComposerFragmentKind.COMMITTEE_FILE: {
                const count = (fragment.committeeFileIds ?? []).length;
                return count > 1 ? `Committee files (${count})` : "Committee file";
            }
            default: return fragment.kind;
        }
    }
    protected fragmentPreview(fragment: ComposerFragment): string {
        const truncate = (input: string, max: number): string => {
            const decoded = this.toPlainTextPreview(input ?? "");
            const stripped = decoded.replace(/\s+/g, " ").trim();
            if (stripped.length <= max) {
                return stripped;
            }
            else {
                return `${stripped.slice(0, max).trim()}…`;
            }
        };
        switch (fragment.kind) {
            case ComposerFragmentKind.INTRO: return truncate(this.state.introMarkdown, 80) || "(empty)";
            case ComposerFragmentKind.SIGNOFF: return truncate(this.state.signoffTextMarkdown, 80) || "(empty)";
            case ComposerFragmentKind.EVENTS: return this.eventSummary;
            case ComposerFragmentKind.TEMPLATE_CONTENT: return "Template provides this content";
            case ComposerFragmentKind.ARTICLE: {
                const block = this.findArticleBlock(fragment.id);
                if (!block) {
                    return "(missing block)";
                }
                else {
                    const title = (block.title ?? "").trim();
                    if (title) {
                        return truncate(title, 80);
                    }
                    else {
                        return truncate(block.markdown, 80) || "(empty)";
                    }
                }
            }
            case ComposerFragmentKind.MULTI_COLUMN: return `${(fragment.columns ?? []).length} columns side by side`;
            case ComposerFragmentKind.DIVIDER: return SECTION_DIVIDER_OPTIONS.find(opt => opt.key === fragment.dividerAfter)?.label ?? "None";
            case ComposerFragmentKind.COMMITTEE_FILE: {
                const ids = fragment.committeeFileIds ?? [];
                if (ids.length === 0) {
                    return "(no files chosen)";
                }
                else {
                    const files = (fragment.committeeFileIds ?? []).map(id => this.committeeFiles.get(id)).filter(file => !!file);
                    if (files.length === 0) {
                        return ids.length === 1 ? "(file not found)" : `(${ids.length} files not found)`;
                    }
                    else {
                        if (files.length === 1) {
                            return truncate(this.committeeDisplayService.fileTitle(files[0]), 80);
                        }
                        else {
                            return truncate(files.map(file => this.committeeDisplayService.fileTitle(file)).join(", "), 80);
                        }
                    }
                }
            }
            default: return "";
        }
    }
    protected fragmentIsExpandable(fragment: ComposerFragment): boolean {
        return EXPANDABLE_FRAGMENT_KINDS.has(fragment.kind);
    }
    protected showComposerFragment(fragment: ComposerFragment): boolean {
        if (fragment.kind === ComposerFragmentKind.EVENTS && this.state.eventInclusion === EventInclusionMode.NONE) {
            return false;
        }
        else {
            return true;
        }
    }
    private toPlainTextPreview(input: string): string {
        if (isUndefined(document)) {
            return input;
        }
        else {
            const container = document.createElement("div");
            container.innerHTML = input;
            return container.textContent ?? "";
        }
    }
    protected findArticleBlock(id: string): ArticleBlock | null {
        return (this.state.articleBlocks ?? []).find(b => b.id === id) ?? null;
    }
}
