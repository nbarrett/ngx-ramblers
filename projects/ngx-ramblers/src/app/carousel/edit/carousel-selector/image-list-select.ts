import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { ContentMetadata } from "../../../models/content-metadata.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageContentService } from "../../../services/page-content.service";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { FormsModule } from "@angular/forms";
import { NgStyle } from "@angular/common";
import { BadgeButtonComponent } from "../../../modules/common/badge-button/badge-button";
import { first } from "es-toolkit/compat";

@Component({
  selector: "app-image-list-select",
  template: `
    <div class="d-inline-flex align-items-center flex-nowrap w-100">
      @if (multiple) {
        <div class="image-list-select-container me-2 flex-grow-1" [ngStyle]="{'max-width.px': maxWidth}">
          @for (contentMetadata of allContentMetadata; track contentMetadata) {
            <div class="image-list-select-item"
                 [class.selected]="isSelected(contentMetadata)"
                 (click)="toggleSelection(contentMetadata, $event)">
              <span class="image-list-name">{{ contentMetadataService.contentMetadataName(contentMetadata) }}</span>
              <span class="image-list-meta">
                <span class="badge-mintcake ms-2">{{ stringUtils.pluraliseWithCount(contentMetadata.files.length, "image") }}</span>
                @if (usageCount(contentMetadata) > 0) {
                  <span class="badge bg-warning text-dark ms-1">{{ stringUtils.pluraliseWithCount(usageCount(contentMetadata), "page") }}</span>
                } @else {
                  <span class="badge-cloudy ms-1">{{ stringUtils.pluraliseWithCount(0, "page") }}</span>
                }
              </span>
            </div>
          }
        </div>
      } @else {
        <select class="form-control me-2 flex-grow-1"
                [(ngModel)]="selectedContentMetadata"
                [id]="id"
                (ngModelChange)="emitAndPublishMetadata($event)"
                [style.flex]="'1 1 auto'"
                [style.min-width.px]="0"
                [ngStyle]="{'max-width.px': maxWidth}">
          @for (contentMetadata of allContentMetadata; track contentMetadata) {
            <option [ngValue]="contentMetadata">
              {{ contentMetadataService.contentMetadataName(contentMetadata) }}
              ({{ stringUtils.pluraliseWithCount(contentMetadata.files.length, "image") }})
            </option>
          }
        </select>
      }
      @if (showNewButton) {
        <app-badge-button [icon]="faPlus" [caption]="'new'"
                          (click)="nameEditToggle.emit(true)"/>
      }
    </div>`,
  styles: [`
    .image-list-select-container
      border: 1px solid #ced4da
      border-radius: 4px
      overflow-y: auto
      max-height: calc(100vh - 250px)
      background: white

    .image-list-select-item
      display: flex
      justify-content: space-between
      align-items: center
      padding: 6px 10px
      cursor: pointer
      user-select: none
      border-bottom: 1px solid #f0f0f0

      &:last-child
        border-bottom: none

      &:hover
        background-color: #f8f9fa

      &.selected
        background-color: rgba(155, 200, 171, 0.15)
        border-left: 3px solid var(--ramblers-colour-mintcake, rgb(155, 200, 171))
        font-weight: 600

    .image-list-name
      flex: 1
      min-width: 0
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .image-list-meta
      flex-shrink: 0
      margin-left: 8px
  `],
  imports: [FormsModule, NgStyle, BadgeButtonComponent]
})
export class ImageListSelect implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("ImageListSelect", NgxLoggerLevel.ERROR);
  contentMetadataService = inject(ContentMetadataService);
  pageContentService = inject(PageContentService);
  stringUtils = inject(StringUtilsService);
  private broadcastService = inject<BroadcastService<ContentMetadata[] | ContentMetadata>>(BroadcastService);

  @Input() public multiple: boolean;
  @Input() public name: string;
  @Input() public id: string;
  @Input() public maxWidth: number;

  @Input("showNewButton") set showNewButtonValue(showNewButton: boolean) {
    this.showNewButton = coerceBooleanProperty(showNewButton);
  }

  public showNewButton: boolean;

  @Output() metadataChange: EventEmitter<ContentMetadata | ContentMetadata[]> = new EventEmitter();
  @Output() nameEditToggle: EventEmitter<boolean> = new EventEmitter();

  protected readonly faPlus = faPlus;
  public selectedContentMetadata: ContentMetadata | ContentMetadata[];
  public allContentMetadata: ContentMetadata[];
  private usageCounts: Map<string, number> = new Map();

  ngOnInit() {
    this.logger.debug("ngOnInit:name", this.name);
    this.contentMetadataService.refreshLookups();
    this.contentMetadataService.contentMetadataNotifications().subscribe(item => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.name, item);
      this.allContentMetadata = allAndSelectedContentMetaData.contentMetadataItems;
      this.selectedContentMetadata = allAndSelectedContentMetaData.contentMetadata ? [allAndSelectedContentMetaData.contentMetadata] : [];
      this.logger.info("contentMetadataNotifications().subscribe.allContentMetadata", this.allContentMetadata, "selectedContentMetadata:", this.selectedContentMetadata);
    });
    if (this.multiple) {
      this.loadUsageCounts();
    }
  }

  private loadUsageCounts() {
    this.pageContentService.albumNames().then(albumPaths => {
      const counts = new Map<string, number>();
      albumPaths.forEach(({albumName}) => counts.set(albumName, (counts.get(albumName) || 0) + 1));
      this.usageCounts = counts;
      this.logger.debug("loadUsageCounts:", Object.fromEntries(counts));
    }).catch(err => this.logger.error("Failed to load usage counts", err));
  }

  usageCount(contentMetadata: ContentMetadata): number {
    return this.usageCounts.get(contentMetadata.name) || 0;
  }

  isSelected(contentMetadata: ContentMetadata): boolean {
    const selected = this.selectedContentMetadata as ContentMetadata[];
    return selected?.some(s => s.name === contentMetadata.name) ?? false;
  }

  toggleSelection(contentMetadata: ContentMetadata, event: MouseEvent) {
    const current = (this.selectedContentMetadata as ContentMetadata[]) || [];
    if (event.ctrlKey || event.metaKey) {
      const idx = current.findIndex(s => s.name === contentMetadata.name);
      const updated = idx >= 0 ? current.filter((_, i) => i !== idx) : [...current, contentMetadata];
      this.selectedContentMetadata = updated;
      this.emitAndPublishMetadata(updated);
    } else {
      this.selectedContentMetadata = [contentMetadata];
      this.emitAndPublishMetadata([contentMetadata]);
    }
  }

  emitAndPublishMetadata(contentMetadata: ContentMetadata[]) {
    const emittedData = !this.multiple ? first(contentMetadata) : contentMetadata;
    this.logger.info("emitAndPublishMetadata:", contentMetadata, "multiple:", this.multiple, "emittedData:", emittedData);
    this.metadataChange.emit(emittedData);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.CONTENT_METADATA_CHANGED, emittedData));
  }
}
