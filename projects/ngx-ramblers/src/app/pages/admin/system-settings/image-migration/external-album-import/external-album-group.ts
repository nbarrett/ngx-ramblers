import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { ExternalAlbumSummary } from "../../../../../models/system.model";
import { UrlService } from "../../../../../services/url.service";
import { VisibilityToggleButton } from "../../../../../shared/components/visibility-toggle-button";

@Component({
  selector: "app-external-album-group",
  template: `
    <div class="album-item" [class.expanded]="album.expanded" [class.selected]="album.selected">
      <div class="album-header clickable" (click)="toggleExpand()">
        <div class="album-toggle">
          <app-visibility-toggle-button [expanded]="album.expanded"/>
        </div>
        <div class="album-checkbox" (click)="$event.stopPropagation()">
          <input type="checkbox" class="form-check-input"
                 [checked]="album.selected"
                 (change)="toggleSelection()">
        </div>
        <div class="album-cover">
          @if (album.coverPhotoUrl) {
            <img [src]="album.coverPhotoUrl" [alt]="album.title" (error)="onImageError($event)">
          }
        </div>
        <div class="album-title">
          <strong>{{ album.title }}</strong>
          @if (!album.expanded && album.selected && editableTargetPath) {
            <span class="text-muted ms-2 small">→ {{ album.targetPath }}</span>
          }
        </div>
        <div class="album-count">
          <span class="badge bg-warning text-dark">{{ album.photoCount }} photos</span>
        </div>
      </div>
      @if (album.expanded) {
        <div class="album-details">
          @if (editableTargetPath && album.selected) {
            <div class="target-path-row">
              <label class="form-label mb-1">Target Path</label>
              <input type="text"
                     class="form-control form-control-sm"
                     [(ngModel)]="album.targetPath"
                     (ngModelChange)="onTargetPathChange()"
                     placeholder="e.g., gallery/album-name"
                     (click)="$event.stopPropagation()">
            </div>
          }
          @if (splitByPhotoTitle && album.selected) {
            <div class="split-preview-actions mt-3">
              <button type="button" class="btn btn-sm btn-outline-secondary"
                      (click)="requestSplitPreview()"
                      [disabled]="album.splitPreviewLoading">
                {{ album.splitPreviewLoading ? "Loading preview..." : "Load split preview" }}
              </button>
              @if (album.splitPreviewError) {
                <div class="text-danger small mt-2">{{ album.splitPreviewError }}</div>
              }
            </div>
            @if (album.splitPreview?.length) {
              <div class="split-preview-list mt-3">
                @for (item of album.splitPreview; track item.path) {
                  <div class="split-preview-item">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <div class="d-flex align-items-center gap-2 text-truncate">
                        <input class="form-check-input" type="checkbox"
                               [(ngModel)]="item.included"
                               (ngModelChange)="onSplitSelectionChanged()">
                        <div class="text-truncate">
                          <strong>{{ item.title }}</strong>
                          <span class="text-muted ms-2">→ {{ item.path }}</span>
                        </div>
                      </div>
                      <span class="badge bg-warning text-dark">{{ item.count }} photos</span>
                    </div>
                    <div class="d-flex flex-wrap gap-2 mb-2">
                      @for (photo of item.previewPhotos || []; track photo.id) {
                        <div class="preview-thumbnail">
                          <img [src]="photo.thumbnailUrl" [alt]="photo.title" [title]="photo.title">
                        </div>
                      }
                      @if (item.count > (item.previewPhotos?.length || 0)) {
                        <div class="preview-more d-flex align-items-center justify-content-center">
                          +{{ item.count - (item.previewPhotos?.length || 0) }} more
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }
          @if (album.description) {
            <p class="text-muted mb-0 mt-2">{{ album.description }}</p>
          }
          @if (!album.selected) {
            <p class="text-muted mb-0 mt-2 fst-italic">Select this album to configure import settings</p>
          }
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

    :host:nth-child(odd) .album-item:not(.selected)
      background-color: #ffffff

    :host:nth-child(even) .album-item:not(.selected)
      background-color: #f8f9fa

    .album-item

    .album-item.expanded
      border-left: 3px solid var(--ramblers-colour-mintcake, rgb(155, 200, 171))

    .album-item.selected:not(.expanded)
      background-color: rgba(155, 200, 171, 0.1)

    .album-item.selected.expanded
      background-color: rgba(155, 200, 171, 0.15)

    .album-header
      display: grid
      grid-template-columns: 28px 32px 50px 1fr 90px
      gap: 12px
      padding: 12px 16px
      align-items: center
      transition: background-color 0.15s ease

    .album-header.clickable
      cursor: pointer

    .album-toggle
      display: flex
      justify-content: center
      align-items: center

    .album-checkbox
      display: flex
      justify-content: center
      align-items: center

    .album-cover
      width: 50px
      height: 50px
      overflow: hidden
      border-radius: 4px
      background-color: #e9ecef

      img
        width: 100%
        height: 100%
        object-fit: cover

    .album-title
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .album-count
      text-align: right

    .album-details
      padding: 16px
      padding-left: 138px
      animation: slideDown 0.2s ease-out

    @keyframes slideDown
      from
        opacity: 0
        transform: translateY(-8px)
      to
        opacity: 1
        transform: translateY(0)

    .target-path-row
      max-width: 400px

    .split-preview-list
      display: flex
      flex-direction: column
      gap: 8px

    .split-preview-item
      padding: 8px 12px
      border: 1px solid #dee2e6
      border-radius: 6px
      background-color: #ffffff

    .split-preview-item .form-check-input
      margin-top: 0
      margin-left: 2px

    .preview-thumbnail
      width: 60px
      height: 60px
      overflow: hidden
      border-radius: 4px
      border: 1px solid #dee2e6

      img
        width: 100%
        height: 100%
        object-fit: cover

    .preview-more
      width: 60px
      height: 60px
      border-radius: 4px
      border: 1px solid #dee2e6
      background-color: #f8f9fa
      color: #6c757d
      font-size: 0.75rem
  `],
  imports: [
    FontAwesomeModule,
    FormsModule,
    VisibilityToggleButton
  ]
})
export class ExternalAlbumGroupComponent {
  @Input() album!: ExternalAlbumSummary;
  @Input() editableTargetPath = false;
  @Input() splitByPhotoTitle = false;
  @Output() albumChanged = new EventEmitter<ExternalAlbumSummary>();
  @Output() splitPreviewRequested = new EventEmitter<ExternalAlbumSummary>();

  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  private urlService = inject(UrlService);

  toggleExpand(): void {
    this.album.expanded = !this.album.expanded;
    this.albumChanged.emit(this.album);
  }

  toggleSelection(): void {
    this.album.selected = !this.album.selected;
    this.albumChanged.emit(this.album);
  }

  onTargetPathChange(): void {
    if (this.album.targetPath) {
      const reformatted = this.urlService.reformatLocalHref(this.album.targetPath);
      if (reformatted && reformatted.startsWith("/")) {
        this.album.targetPath = reformatted.replace(/^\/+/, "");
      } else {
        this.album.targetPath = reformatted;
      }
    }
    this.albumChanged.emit(this.album);
  }

  requestSplitPreview(): void {
    this.splitPreviewRequested.emit(this.album);
  }

  onSplitSelectionChanged(): void {
    if (this.album.splitPreview) {
      const selected = this.album.splitPreview
        .filter(entry => entry.included)
        .map(entry => entry.path);
      this.album.splitAlbumPaths = selected;
    } else {
      this.album.splitAlbumPaths = [];
    }
    this.albumChanged.emit(this.album);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = "none";
  }
}
