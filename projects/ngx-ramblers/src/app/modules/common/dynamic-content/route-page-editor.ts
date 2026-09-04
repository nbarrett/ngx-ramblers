import { Component, EventEmitter, inject, Input, OnChanges, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { FormsModule } from "@angular/forms";
import { StepperModule } from "primeng/stepper";
import { PrimeTemplate } from "primeng/api";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faAlignLeft, faChevronDown, faChevronLeft, faChevronRight, faEye, faEyeSlash, faGripVertical, faPlus, faTableCells, faTrash } from "@fortawesome/free-solid-svg-icons";
import { DragHoverPosition } from "../../../models/email-composer.model";
import { WriteUpSection } from "../../../models/route-follow.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { MapEditorSection, PageContent, PageContentColumn, PageContentRow, PageContentType } from "../../../models/content-text.model";
import { ROUTE_PAGE_STEPS, ROUTE_SUGGESTED_SECTIONS, RouteDetailsPart, RoutePageStep, RoutePageStepDefinition, WRITTEN_DIRECTIONS_DEFAULT, WRITTEN_DIRECTIONS_OPTIONS } from "../../../models/route-follow.model";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { routeRowIn } from "../../../functions/map-location-markers";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { RouteDetailsEdit } from "./route-details-edit";
import { DynamicContentSiteEditMap } from "./dynamic-content-site-edit-map";
import { ContentTextEditor } from "../tiptap-editor/content-text-editor";
import { TiptapMarkdownEditor } from "../tiptap-editor/tiptap-markdown-editor";
import { CardImageComponent } from "../card/image/card-image";
import { BadgeButtonComponent } from "../badge-button/badge-button";

@Component({
  selector: "app-route-page-editor",
  template: `
    <p-stepper [value]="activeIndex" (valueChange)="goToStep($event)" [linear]="false">
      @for (step of steps; let idx = $index; track step.key) {
        <p-step-item [value]="idx">
          <p-step>
            <div class="walk-step-header">
              <span class="walk-step-number">{{ idx + 1 }}</span>
              <div class="walk-step-text">
                <div class="walk-step-label">{{ step.label }}</div>
                <div class="walk-step-hint">{{ step.hint }}</div>
              </div>
            </div>
          </p-step>
          <p-step-panel>
            <ng-template pTemplate="content">
            @if (step.key === RoutePageStep.ABOUT) {
              <app-route-details-edit [row]="routeRow" [part]="RouteDetailsPart.ABOUT" id="route-page"/>
            } @else if (step.key === RoutePageStep.START) {
              <p class="guidance">Type the place, postcode or grid reference and the rest is looked up. Drag the pin on the map to place it exactly.</p>
              <app-route-details-edit [row]="routeRow" [part]="RouteDetailsPart.START" id="route-page"/>
            } @else if (step.key === RoutePageStep.LINE) {
              <app-dynamic-content-site-edit-map [row]="routeRow" id="route-line" [pageContent]="pageContent" [sections]="[MapEditorSection.ROUTES]"/>
            } @else if (step.key === RoutePageStep.DIRECTIONS) {
              <p class="guidance">Generate the turns from the route, then step through them here or full screen. Each direction and note can be reworded beside the map, and each pin dragged along the route.</p>
              @if (routeRow?.routeGuide) {
                <div class="mb-3">
                  <label class="form-label">Written directions</label>
                  <app-tiptap-markdown-editor [value]="routeRow.routeGuide.writtenDirections || ''" (valueChange)="routeRow.routeGuide.writtenDirections = $event; routeGuideChanged()"
                                              placeholder="The directions as written, one paragraph or numbered item per leg. Generating the turns hangs these on the nearest turns as notes."/>
                  <label class="form-label mt-2" for="route-written-directions-display">On the page</label>
                  <select class="form-control" id="route-written-directions-display"
                          [ngModel]="routeRow.routeGuide.writtenDirectionsDisplay || WRITTEN_DIRECTIONS_DEFAULT"
                          (ngModelChange)="routeRow.routeGuide.writtenDirectionsDisplay = $event; routeGuideChanged()">
                    @for (option of writtenDirectionsOptions; track option.value) {
                      <option [ngValue]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </div>
              }
              <app-dynamic-content-site-edit-map [row]="routeRow" id="route-directions" [pageContent]="pageContent" [sections]="[MapEditorSection.MARKERS, MapEditorSection.PREVIEW]"/>
            } @else if (step.key === RoutePageStep.WRITE_UP) {
              <p class="guidance">Each block is a section of the page. Drag a block by its handle to reorder, open it to edit, or remove it.</p>
              <div class="fragment-list mb-3">
                @for (section of writeUpSections; let i = $index; track section.row) {
                  <div class="fragment-row"
                       [class.fragment-row-hover-before]="dragHoverIndex === i && dragHoverPosition === DragHoverPosition.Before"
                       [class.fragment-row-hover-after]="dragHoverIndex === i && dragHoverPosition === DragHoverPosition.After"
                       (dragover)="onSectionDragOver(i, $event)" (drop)="onSectionDrop(i)">
                    <div class="fragment-row-header fragment-row-header-clickable" draggable="true"
                         (dragstart)="onSectionDragStart(i, $event)" (dragend)="onSectionDragEnd()" (click)="toggleSection(section.row)">
                      <span class="fragment-handle" title="Drag to reorder this section"><fa-icon [icon]="faGripVertical"/></span>
                      <span class="fragment-icon"><fa-icon [icon]="faAlignLeft"/></span>
                      <div class="fragment-meta">
                        <div class="fragment-label">{{ section.label }}</div>
                        <div class="fragment-preview text-muted small">{{ section.preview }}</div>
                      </div>
                      <span class="fragment-chevron" [title]="isExpanded(section.row) ? 'Collapse' : 'Expand'"><fa-icon [icon]="isExpanded(section.row) ? faChevronDown : faChevronRight"/></span>
                      <button type="button" class="btn btn-sm btn-danger" (click)="$event.stopPropagation(); removeSection(section)" title="Remove section"><fa-icon [icon]="faTrash"/></button>
                    </div>
                    @if (isExpanded(section.row)) {
                      <div class="fragment-row-body">
                        <app-content-text-editor class="w-100" [text]="section.column.contentText" [name]="'route-write-up-' + i" [category]="pageContent.path"
                                                 (changed)="actions.notifyPageContentTextChange($event, section.column, pageContent)"/>
                      </div>
                    }
                  </div>
                }
              </div>
              <div class="d-flex flex-wrap align-items-center gap-2">
                <span class="small text-muted">Add a section:</span>
                @for (heading of suggestedSections; track heading) {
                  <app-badge-button [icon]="faPlus" [caption]="heading" (click)="addSection(heading)"/>
                }
              </div>
            } @else if (step.key === RoutePageStep.PHOTOS) {
              @if (imageColumns.length === 0) {
                <p class="guidance">There are no pictures on this page yet. Pictures are added to a text section in the full page editor.</p>
              }
              <div class="row gy-3">
                @for (image of imageColumns; track image.column) {
                  <div class="col-md-4">
                    <app-card-image [imageSource]="image.column.imageSource" [height]="180"/>
                    <div class="d-flex align-items-center justify-content-between mt-2">
                      <span class="small text-muted">{{ image.label }}</span>
                      <app-badge-button [icon]="hidden(image.column) ? faEye : faEyeSlash" [caption]="hidden(image.column) ? 'Show' : 'Hide'" (click)="toggleHidden(image.column)"/>
                    </div>
                  </div>
                }
              </div>
              <p class="small text-muted mt-3 mb-0">To crop, replace or add pictures, open the full page editor.</p>
            } @else if (step.key === RoutePageStep.DISPLAY) {
              <app-dynamic-content-site-edit-map [row]="routeRow" id="route-display" [pageContent]="pageContent" [sections]="[MapEditorSection.PREVIEW, MapEditorSection.TEXT, MapEditorSection.DISPLAY]" [showSteps]="false"/>
            }
            <div class="stepper-nav">
              @if (idx > 0) {
                <button type="button" class="btn btn-quiet" (click)="goToStep(idx - 1)"><fa-icon [icon]="faChevronLeft" class="me-2"/>Back</button>
              }
              @if (idx < steps.length - 1) {
                <button type="button" class="btn btn-primary" (click)="goToStep(idx + 1)">Next: {{ steps[idx + 1].label }}<fa-icon [icon]="faChevronRight" class="ms-2"/></button>
              } @else {
                <button type="button" class="btn btn-quiet" (click)="openFullEditor.emit()"><fa-icon [icon]="faTableCells" class="me-2"/>Open the full page editor</button>
              }
            </div>
            </ng-template>
          </p-step-panel>
        </p-step-item>
      }
    </p-stepper>
  `,
  imports: [FormsModule, StepperModule, PrimeTemplate, FontAwesomeModule, RouteDetailsEdit, DynamicContentSiteEditMap, ContentTextEditor, CardImageComponent, BadgeButtonComponent, TiptapMarkdownEditor]
})
export class RoutePageEditor implements OnChanges {
  protected readonly WRITTEN_DIRECTIONS_DEFAULT = WRITTEN_DIRECTIONS_DEFAULT;
  protected readonly writtenDirectionsOptions = WRITTEN_DIRECTIONS_OPTIONS;
  protected actions = inject(PageContentActionsService);
  private broadcastService = inject(BroadcastService);
  @Input() pageContent!: PageContent;
  @Output() openFullEditor = new EventEmitter<void>();
  private uiActions = inject(UiActionsService);
  private activatedRoute = inject(ActivatedRoute);
  protected activeIndex = Math.min(Math.max(Number(this.activatedRoute.snapshot.queryParamMap.get(StoredValue.ROUTE_EDITOR_STEP)) - 1, 0), ROUTE_PAGE_STEPS.length - 1) || 0;

  goToStep(index: number): void {
    this.activeIndex = index;
    void this.uiActions.updateQueryParameter(StoredValue.ROUTE_EDITOR_STEP, index > 0 ? index + 1 : null);
  }
  protected expandedSections = new Set<PageContentRow>();
  protected draggedIndex: number | null = null;
  protected dragHoverIndex: number | null = null;
  protected dragHoverPosition: DragHoverPosition | null = null;
  protected readonly DragHoverPosition = DragHoverPosition;
  protected readonly faGripVertical = faGripVertical;
  protected readonly faAlignLeft = faAlignLeft;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faTrash = faTrash;
  protected readonly steps: RoutePageStepDefinition[] = ROUTE_PAGE_STEPS;
  protected readonly suggestedSections = ROUTE_SUGGESTED_SECTIONS;
  protected readonly RoutePageStep = RoutePageStep;
  protected readonly RouteDetailsPart = RouteDetailsPart;
  protected readonly MapEditorSection = MapEditorSection;
  protected readonly faPlus = faPlus;
  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;
  protected readonly faTableCells = faTableCells;
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;

  ngOnChanges(): void {
    this.ensureRouteRow();
  }

  routeGuideChanged(): void {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.routeRow));
  }

  get routeRow(): PageContentRow {
    return routeRowIn(this.pageContent);
  }

  get writeUpSections(): WriteUpSection[] {
    const rows = this.pageContent?.rows || [];
    return rows
      .slice(1)
      .filter(row => row.type === PageContentType.TEXT && !this.isTail(row))
      .flatMap(row => this.sectionsOf(row, rows));
  }

  isExpanded(row: PageContentRow): boolean {
    return this.expandedSections.has(row);
  }

  toggleSection(row: PageContentRow): void {
    if (this.expandedSections.has(row)) {
      this.expandedSections.delete(row);
    } else {
      this.expandedSections.add(row);
    }
  }

  removeSection(section: WriteUpSection): void {
    section.container.splice(section.container.indexOf(section.row), 1);
    this.expandedSections.delete(section.row);
  }

  onSectionDragStart(index: number, event: DragEvent): void {
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  onSectionDragOver(index: number, event: DragEvent): void {
    if (this.draggedIndex !== null && this.draggedIndex !== index) {
      event.preventDefault();
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.dragHoverPosition = event.clientY < rect.top + rect.height / 2 ? DragHoverPosition.Before : DragHoverPosition.After;
      this.dragHoverIndex = index;
    }
  }

  onSectionDrop(index: number): void {
    const sections = this.writeUpSections;
    const from = this.draggedIndex === null ? null : sections[this.draggedIndex];
    const to = sections[index];
    if (from && to && from !== to) {
      from.container.splice(from.container.indexOf(from.row), 1);
      const insertAt = to.container.indexOf(to.row) + (this.dragHoverPosition === DragHoverPosition.After ? 1 : 0);
      to.container.splice(insertAt, 0, from.row);
    }
    this.onSectionDragEnd();
  }

  onSectionDragEnd(): void {
    this.draggedIndex = null;
    this.dragHoverIndex = null;
    this.dragHoverPosition = null;
  }

  private sectionsOf(row: PageContentRow, container: PageContentRow[]): WriteUpSection[] {
    const own = (row.columns || []).filter(column => !!column.contentText?.trim());
    const nested = (row.columns || []).flatMap(column => (column.rows || []).filter(inner => inner.type === PageContentType.TEXT).flatMap(inner => this.sectionsOf(inner, column.rows)));
    return own.length > 0 && nested.length === 0
      ? [{row, container, column: own[0], label: this.headingOf(own[0]) || "Text", preview: this.previewOf(own[0])}]
      : nested;
  }

  private previewOf(column: PageContentColumn): string {
    return (column.contentText || "").split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#")).join(" ").replace(/[*_`>\[\]]/g, "").slice(0, 120);
  }

  private isTail(row: PageContentRow): boolean {
    return (row.columns || []).some(column => /Automatically migrated from/.test(column.contentText || ""));
  }

  get imageColumns(): {column: PageContentColumn; label: string}[] {
    return (this.pageContent?.rows || [])
      .flatMap((row, rowIndex) => this.columnsWithin(row).map(column => ({column, rowIndex})))
      .filter(item => !!item.column.imageSource)
      .map(item => ({column: item.column, label: item.rowIndex === 0 ? "Banner" : this.headingOf(item.column) || `Picture in section ${item.rowIndex}`}));
  }

  hidden(column: PageContentColumn): boolean {
    return column.accessLevel === AccessLevel.HIDDEN;
  }

  toggleHidden(column: PageContentColumn): void {
    column.accessLevel = this.hidden(column) ? AccessLevel.PUBLIC : AccessLevel.HIDDEN;
  }

  addSection(heading: string): void {
    const rows = this.pageContent.rows;
    const insertBefore = rows.findIndex(row => row.type === PageContentType.SHARED_FRAGMENT || (row.columns || []).some(column => /Automatically migrated from/.test(column.contentText || "")));
    const section: PageContentRow = {
      type: PageContentType.TEXT,
      maxColumns: 1,
      showSwiper: false,
      columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: `## ${heading}\n\n`}]
    };
    rows.splice(insertBefore < 0 ? rows.length : insertBefore, 0, section);
    this.expandedSections.add(section);
  }

  private ensureRouteRow(): void {
    if (this.pageContent?.rows && !this.routeRow) {
      const routeRow: PageContentRow = {type: PageContentType.ROUTE, maxColumns: 1, showSwiper: false, marginBottom: 3, columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC}]};
      this.actions.ensureRouteGuide(routeRow);
      this.pageContent.rows.splice(Math.min(1, this.pageContent.rows.length), 0, routeRow);
    }
  }

  private columnsWithin(row: PageContentRow): PageContentColumn[] {
    return (row.columns || []).flatMap(column => [column, ...(column.rows || []).flatMap(inner => this.columnsWithin(inner))]);
  }

  private headingOf(column: PageContentColumn): string {
    return (column.contentText || "").match(/^#+\s*(.+)$/m)?.[1] || "";
  }
}
