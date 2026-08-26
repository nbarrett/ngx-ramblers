import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faUpload } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { CmsImagePickerImage, CmsImagePickerPage } from "../../../models/cms-image-picker.model";
import { CmsPageImageService } from "../../../services/cms-page-image.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { DraggableModalComponent } from "../draggable-modal/draggable-modal";

@Component({
  selector: "app-cms-image-picker",
  imports: [DraggableModalComponent, FontAwesomeModule, FormsModule],
  styles: [`
    .cms-image-grid
      display: grid
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))
      gap: 12px
      max-height: 55vh
      overflow-y: auto

    .cms-image-option
      min-height: 150px
      padding: 0
      overflow: hidden
      border: 3px solid transparent
      border-radius: 4px
      background: var(--ramblers-colour-cloudy, #f1f1f1)

      &.selected
        border-color: var(--ramblers-colour-sunrise, #f9b104)

      img
        width: 100%
        height: 150px
        object-fit: cover
        display: block
  `],
  template: `
    <app-draggable-modal [open]="open" contentWidth="min(960px, 95vw)" [showCloseButton]="false" (closed)="close()">
      <h4 modalTitle>Choose an image from your website</h4>
      <div modalBody>
        @if (loading) {
          <div class="d-flex align-items-center gap-2 py-4 justify-content-center">
            <span class="spinner-border" role="status"><span class="visually-hidden">Loading images</span></span>
            <strong>Finding images on nearby pages…</strong>
          </div>
        } @else if (loadFailed) {
          <div class="alert alert-danger d-flex align-items-start gap-2 mb-0">
            <fa-icon [icon]="faCircleExclamation"/><div><strong class="d-block">Images could not be loaded</strong>{{ errorMessage }}</div>
          </div>
        } @else if (pages.length === 0) {
          <div class="alert alert-warning d-flex align-items-start gap-2 mb-0">
            <fa-icon [icon]="faCircleExclamation"/><div><strong class="d-block">No website images found</strong>The supporting page and its nearby pages do not contain any selectable images.</div>
          </div>
        } @else {
          <label for="cms-image-page" class="form-label">Page containing the image</label>
          <select id="cms-image-page" class="form-select mb-3" [(ngModel)]="selectedPagePath">
            @for (page of pages; track page.path) {
              <option [ngValue]="page.path">{{ page.title }} — {{ page.label }} — {{ page.images.length }} image{{ page.images.length === 1 ? "" : "s" }}</option>
            }
          </select>
          <div class="cms-image-grid">
            @for (image of selectedPageImages(); track image.pagePath + image.src) {
              <button type="button" class="cms-image-option" [class.selected]="image.src === currentImageSrc"
                      [attr.aria-label]="'Use image from ' + image.alt" (click)="select(image)">
                <img [src]="image.resolvedSrc" [alt]="image.alt" loading="lazy"/>
              </button>
            }
          </div>
        }
      </div>
      <button modalFooter type="button" class="btn btn-quiet" (click)="uploadRequested.emit()"><fa-icon [icon]="faUpload" class="me-1"/>Upload another image</button>
      <button modalFooter type="button" class="btn btn-quiet" (click)="close()">Cancel</button>
    </app-draggable-modal>
  `
})
export class CmsImagePickerComponent {
  private cmsPageImageService = inject(CmsPageImageService);
  private logger: Logger = inject(LoggerFactory).createLogger("CmsImagePickerComponent", NgxLoggerLevel.ERROR);
  private startingPaths: string[] = [];

  @Input() currentImageSrc: string | null = null;
  @Input() set startingPagePaths(value: string[]) {
    this.startingPaths = value ?? [];
  }
  get startingPagePaths(): string[] {
    return this.startingPaths;
  }
  @Input() set open(value: boolean) {
    this.isOpen = value;
    if (value) {
      this.loadPages();
    }
  }
  get open(): boolean {
    return this.isOpen;
  }
  @Output() selected = new EventEmitter<CmsImagePickerImage>();
  @Output() uploadRequested = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  protected isOpen = false;
  protected loading = false;
  protected loadFailed = false;
  protected errorMessage = "";
  protected pages: CmsImagePickerPage[] = [];
  protected selectedPagePath: string | null = null;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faUpload = faUpload;

  protected selectedPageImages(): CmsImagePickerImage[] {
    return this.pages.find(page => page.path === this.selectedPagePath)?.images ?? [];
  }

  protected select(image: CmsImagePickerImage): void {
    this.selected.emit(image);
    this.isOpen = false;
  }

  protected close(): void {
    this.isOpen = false;
    this.closed.emit();
  }

  private async loadPages(): Promise<void> {
    this.loading = true;
    this.loadFailed = false;
    this.errorMessage = "";
    try {
      this.pages = await this.cmsPageImageService.pagesNear(this.startingPaths);
      this.selectedPagePath = this.pages[0]?.path ?? null;
    } catch (error) {
      this.logger.error("loadPages failed", error);
      this.pages = [];
      this.loadFailed = true;
      this.errorMessage = String(error);
    } finally {
      this.loading = false;
    }
  }
}
