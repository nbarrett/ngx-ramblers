import { Component, EventEmitter, Input, Output } from "@angular/core";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import {
  ExternalImageReference,
  ImageMigrationGroup,
  ImageMigrationSourceType,
  ImageMigrationStatus
} from "../../../../models/system.model";
import { StatusIconComponent } from "../../status-icon";
import { VisibilityToggleButton } from "../../../../shared/components/visibility-toggle-button";

@Component({
  selector: "app-image-migration-group",
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
          <span class="badge bg-warning text-dark">{{ selectedCount() }}/{{ group.images.length }}</span>
        </div>
      </div>
      @if (group.expanded) {
        <div class="migration-details">
          <table class="migration-images-table">
            <thead>
              <tr>
                <th style="width: 40px;"></th>
                <th style="width: 80px;">Preview</th>
                <th>URL</th>
                <th style="width: 100px;">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (image of group.images; track image.id) {
                <tr [ngClass]="{'row-success': image.status === ImageMigrationStatus.MIGRATED,
                               'row-danger': image.status === ImageMigrationStatus.FAILED}">
                  <td>
                    <input type="checkbox" class="form-check-input"
                           [checked]="image.selected"
                           [disabled]="image.status === ImageMigrationStatus.MIGRATED"
                           (change)="toggleImageSelection(image)">
                  </td>
                  <td>
                    <img [src]="image.thumbnailUrl"
                         [alt]="image.sourceTitle"
                         class="img-thumbnail"
                         style="max-width: 60px; max-height: 60px;"
                         (error)="onImageError($event)">
                  </td>
                  <td class="text-break small">
                    <a [href]="image.currentUrl" target="_blank" rel="noopener noreferrer"
                       class="text-decoration-none">
                      {{ truncateUrl(image.currentUrl) }}
                      <fa-icon [icon]="faExternalLinkAlt" class="ms-1 small"></fa-icon>
                    </a>
                    @if (image.newS3Url) {
                      <div class="text-success small mt-1">
                        → {{ image.newS3Url }}
                      </div>
                    }
                    @if (image.errorMessage) {
                      <div class="text-danger small mt-1">
                        {{ image.errorMessage }}
                      </div>
                    }
                  </td>
                  <td class="text-nowrap">
                    <span class="d-inline-flex align-items-center">
                      <app-status-icon noLabel [status]="statusToIcon(image.status)"/>
                      <span class="ms-1 small">{{ image.status }}</span>
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
      grid-template-columns: 28px 32px 80px 1fr 80px
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
export class ImageMigrationGroupComponent {
  @Input() group!: ImageMigrationGroup;
  @Output() groupChanged = new EventEmitter<ImageMigrationGroup>();

  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  protected readonly ImageMigrationStatus = ImageMigrationStatus;

  toggleExpand(): void {
    this.group.expanded = !this.group.expanded;
    this.groupChanged.emit(this.group);
  }

  toggleSelectAll(): void {
    this.group.selectAll = !this.group.selectAll;
    this.group.images.forEach(img => {
      if (img.status !== ImageMigrationStatus.MIGRATED) {
        img.selected = this.group.selectAll;
      }
    });
    this.groupChanged.emit(this.group);
  }

  toggleImageSelection(image: ExternalImageReference): void {
    image.selected = !image.selected;
    this.updateSelectAllState();
    this.groupChanged.emit(this.group);
  }

  selectedCount(): number {
    return this.group.images.filter(img => img.selected).length;
  }

  private updateSelectAllState(): void {
    const selectableImages = this.group.images.filter(img => img.status !== ImageMigrationStatus.MIGRATED);
    this.group.selectAll = selectableImages.length > 0 && selectableImages.every(img => img.selected);
  }

  sourceTypeLabel(type: ImageMigrationSourceType): string {
    switch (type) {
      case ImageMigrationSourceType.CONTENT_METADATA:
        return "Album";
      case ImageMigrationSourceType.PAGE_CONTENT:
        return "Page";
      case ImageMigrationSourceType.GROUP_EVENT:
        return "Walk";
      case ImageMigrationSourceType.SOCIAL_EVENT:
        return "Social";
      default:
        return type;
    }
  }

  sourceLinkFor(group: ImageMigrationGroup): string | null {
    // External URLs (http/https) are not local resources - return null
    if (group.sourcePath.startsWith("http://") || group.sourcePath.startsWith("https://")) {
      return null;
    }
    switch (group.sourceType) {
      case ImageMigrationSourceType.CONTENT_METADATA:
        return `/admin/album-gallery?album=${encodeURIComponent(group.sourcePath)}`;
      case ImageMigrationSourceType.PAGE_CONTENT:
        return `/${group.sourcePath}`;
      case ImageMigrationSourceType.GROUP_EVENT:
      case ImageMigrationSourceType.SOCIAL_EVENT:
        return group.sourcePath.startsWith("/") ? group.sourcePath : `/${group.sourcePath}`;
      default:
        return null;
    }
  }

  statusToIcon(status: ImageMigrationStatus): string {
    switch (status) {
      case ImageMigrationStatus.MIGRATED:
        return "complete";
      case ImageMigrationStatus.FAILED:
        return "error";
      case ImageMigrationStatus.IN_PROGRESS:
        return "info";
      case ImageMigrationStatus.SKIPPED:
        return "warning";
      default:
        return "info";
    }
  }

  truncateUrl(url: string): string {
    if (url.length > 80) {
      return url.substring(0, 40) + "..." + url.substring(url.length - 35);
    }
    return url;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = "none";
  }
}
