import { Component, EventEmitter, Input, Output } from "@angular/core";
import { faExternalLinkAlt, faFileImage, faFilePdf, faFileExcel, faFileWord, faFile } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import {
  ContentMigrationDocumentType,
  ExternalContentReference,
  ContentMigrationGroup,
  ContentMigrationSourceType,
  ContentMigrationStatus
} from "../../../../models/system.model";
import { StatusIconComponent } from "../../status-icon";
import { VisibilityToggleButton } from "../../../../shared/components/visibility-toggle-button";

@Component({
  selector: "app-content-migration-group",
  template: `
    <div class="migration-item" [class.expanded]="group.expanded">
      <div class="migration-header clickable" (click)="toggleExpand()">
        <div class="migration-toggle">
          <app-visibility-toggle-button [expanded]="group.expanded"/>
        </div>
        <div class="migration-checkbox" (click)="$event.stopPropagation()">
          <input type="checkbox" class="form-check-input"
                 [checked]="group.selectAll"
                 (change)="toggleSelectAll()">
        </div>
        <div class="migration-type">{{ sourceTypeLabel(group.sourceType) }}</div>
        <div class="migration-path">
          @if (sourceLinkFor(group)) {
            <a [href]="sourceLinkFor(group)" target="_blank" rel="noopener noreferrer"
               class="rams-text-decoration-pink" (click)="$event.stopPropagation()">
              {{ group.sourceTitle }}
            </a>
          } @else {
            {{ group.sourceTitle }}
          }
        </div>
        <div class="migration-count">
          <span class="badge bg-warning text-dark">{{ selectedCount() }}/{{ group.items.length }}</span>
        </div>
      </div>
      @if (group.expanded) {
        <div class="migration-details">
          <table class="migration-images-table">
            <thead>
              <tr>
                <th style="width: 40px;"></th>
                <th style="width: 80px;">Preview</th>
                <th style="width: 90px;">Type</th>
                <th>URL</th>
                <th style="width: 100px;">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (item of group.items; track item.id) {
                <tr [ngClass]="{'row-success': item.status === ContentMigrationStatus.MIGRATED,
                               'row-danger': item.status === ContentMigrationStatus.FAILED}">
                  <td>
                    <input type="checkbox" class="form-check-input"
                           [checked]="item.selected"
                           [disabled]="item.status === ContentMigrationStatus.MIGRATED"
                           (change)="toggleItemSelection(item)">
                  </td>
                  <td>
                    @if (item.documentType === ContentMigrationDocumentType.IMAGE) {
                      <img [src]="item.thumbnailUrl"
                           [alt]="item.sourceTitle"
                           class="img-thumbnail"
                           style="max-width: 60px; max-height: 60px;"
                           (error)="onImageError($event)">
                    } @else {
                      <fa-icon [icon]="documentTypeIcon(item.documentType)" size="2x" class="text-muted"/>
                    }
                  </td>
                  <td>
                    <span class="badge" [ngClass]="documentTypeBadgeClass(item.documentType)">
                      {{ item.documentType }}
                    </span>
                  </td>
                  <td class="text-break small">
                    <a [href]="item.currentUrl" target="_blank" rel="noopener noreferrer"
                       class="text-decoration-none">
                      {{ truncateUrl(item.currentUrl) }}
                      <fa-icon [icon]="faExternalLinkAlt" class="ms-1 small"></fa-icon>
                    </a>
                    @if (item.newS3Url) {
                      <div class="text-success small mt-1">
                        → {{ item.newS3Url }}
                      </div>
                    }
                    @if (item.errorMessage) {
                      <div class="text-danger small mt-1">
                        {{ item.errorMessage }}
                      </div>
                    }
                  </td>
                  <td class="text-nowrap">
                    <span class="d-inline-flex align-items-center">
                      <app-status-icon noLabel [status]="statusToIcon(item.status)"/>
                      <span class="ms-1 small">{{ item.status }}</span>
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host
      display: block
      border-bottom: 1px solid #dee2e6

    :host:last-child
      border-bottom: none

    :host:nth-child(odd) .migration-item
      background-color: #ffffff

    :host:nth-child(even) .migration-item
      background-color: #f8f9fa

    .migration-item

    .migration-item.expanded
      background-color: rgba(155, 200, 171, 0.15)
      border-left: 3px solid var(--ramblers-colour-mintcake, rgb(155, 200, 171))

    .migration-header
      display: grid
      grid-template-columns: 28px 32px 120px 1fr 80px
      gap: 12px
      padding: 12px 16px
      align-items: center
      transition: background-color 0.15s ease

    .migration-header.clickable
      cursor: pointer

    .migration-toggle
      display: flex
      justify-content: center
      align-items: center

    .migration-checkbox
      display: flex
      justify-content: center
      align-items: center

    .migration-type
      font-weight: 600
      color: #495057
      white-space: nowrap

    .migration-path
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .migration-count
      text-align: right

    .migration-details
      padding: 16px
      animation: slideDown 0.2s ease-out

    @keyframes slideDown
      from
        opacity: 0
        transform: translateY(-8px)
      to
        opacity: 1
        transform: translateY(0)

    .migration-images-table
      width: 100%
      border-collapse: separate
      border-spacing: 0
      background: white
      border-radius: 8px
      overflow: hidden
      border: 1px solid rgba(155, 200, 171, 0.4)
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)

    .migration-images-table th,
    .migration-images-table td
      padding: 10px 14px
      vertical-align: middle
      border-bottom: 1px solid #e9ecef

    .migration-images-table th
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.3), rgba(155, 200, 171, 0.15))
      color: #495057
      font-weight: 600
      text-align: left

    .migration-images-table tbody tr:last-child td
      border-bottom: none

    .migration-images-table tbody tr:nth-child(odd)
      background-color: #ffffff

    .migration-images-table tbody tr:nth-child(even)
      background-color: #fafafa

    .migration-images-table tbody tr:hover
      background-color: rgba(155, 200, 171, 0.1)

    .row-success
      background-color: rgba(40, 167, 69, 0.1) !important

    .row-danger
      background-color: rgba(220, 53, 69, 0.1) !important
  `],
  imports: [
    FontAwesomeModule,
    FormsModule,
    NgClass,
    StatusIconComponent,
    VisibilityToggleButton
  ]
})
export class ContentMigrationGroupComponent {
  @Input() group!: ContentMigrationGroup;
  @Output() groupChanged = new EventEmitter<ContentMigrationGroup>();

  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  protected readonly ContentMigrationStatus = ContentMigrationStatus;
  protected readonly ContentMigrationDocumentType = ContentMigrationDocumentType;

  toggleExpand(): void {
    this.group.expanded = !this.group.expanded;
    this.groupChanged.emit(this.group);
  }

  toggleSelectAll(): void {
    this.group.selectAll = !this.group.selectAll;
    this.group.items.forEach(item => {
      if (item.status !== ContentMigrationStatus.MIGRATED) {
        item.selected = this.group.selectAll;
      }
    });
    this.groupChanged.emit(this.group);
  }

  toggleItemSelection(item: ExternalContentReference): void {
    item.selected = !item.selected;
    this.updateSelectAllState();
    this.groupChanged.emit(this.group);
  }

  selectedCount(): number {
    return this.group.items.filter(item => item.selected).length;
  }

  private updateSelectAllState(): void {
    const selectableItems = this.group.items.filter(item => item.status !== ContentMigrationStatus.MIGRATED);
    this.group.selectAll = selectableItems.length > 0 && selectableItems.every(item => item.selected);
  }

  sourceTypeLabel(type: ContentMigrationSourceType): string {
    switch (type) {
      case ContentMigrationSourceType.CONTENT_METADATA:
        return "Album";
      case ContentMigrationSourceType.PAGE_CONTENT:
        return "Page";
      case ContentMigrationSourceType.GROUP_EVENT:
        return "Walk";
      case ContentMigrationSourceType.SOCIAL_EVENT:
        return "Social";
      case ContentMigrationSourceType.COMMITTEE_FILE:
        return "Committee File";
      default:
        return type;
    }
  }

  sourceLinkFor(group: ContentMigrationGroup): string | null {
    const isExternalUrl = group.sourcePath.startsWith("http://") || group.sourcePath.startsWith("https://");
    if (isExternalUrl) {
      return null;
    }
    switch (group.sourceType) {
      case ContentMigrationSourceType.CONTENT_METADATA:
        return `/admin/carousel-editor?carousel=${encodeURIComponent(group.sourceTitle)}`;
      case ContentMigrationSourceType.PAGE_CONTENT:
        return `/${group.sourcePath}`;
      case ContentMigrationSourceType.GROUP_EVENT:
      case ContentMigrationSourceType.SOCIAL_EVENT:
        return group.sourcePath.startsWith("/") ? group.sourcePath : `/${group.sourcePath}`;
      case ContentMigrationSourceType.COMMITTEE_FILE:
        return null;
      default:
        return null;
    }
  }

  documentTypeIcon(type: ContentMigrationDocumentType) {
    switch (type) {
      case ContentMigrationDocumentType.IMAGE:
        return faFileImage;
      case ContentMigrationDocumentType.PDF:
        return faFilePdf;
      case ContentMigrationDocumentType.SPREADSHEET:
        return faFileExcel;
      case ContentMigrationDocumentType.DOCUMENT:
        return faFileWord;
      default:
        return faFile;
    }
  }

  documentTypeBadgeClass(type: ContentMigrationDocumentType): string {
    switch (type) {
      case ContentMigrationDocumentType.IMAGE:
        return "bg-primary";
      case ContentMigrationDocumentType.PDF:
        return "bg-danger";
      case ContentMigrationDocumentType.SPREADSHEET:
        return "bg-success";
      case ContentMigrationDocumentType.DOCUMENT:
        return "bg-info";
      default:
        return "bg-secondary";
    }
  }

  statusToIcon(status: ContentMigrationStatus): string {
    switch (status) {
      case ContentMigrationStatus.MIGRATED:
        return "complete";
      case ContentMigrationStatus.FAILED:
        return "error";
      case ContentMigrationStatus.IN_PROGRESS:
        return "info";
      case ContentMigrationStatus.SKIPPED:
        return "warning";
      default:
        return "info";
    }
  }

  truncateUrl(url: string): string {
    const display = this.decodeForDisplay(url);
    if (display.length > 80) {
      return display.substring(0, 40) + "..." + display.substring(display.length - 35);
    }
    return display;
  }

  private decodeForDisplay(url: string): string {
    if (!url) {
      return url;
    }
    try {
      return decodeURI(url);
    } catch {
      return url;
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = "none";
  }
}
