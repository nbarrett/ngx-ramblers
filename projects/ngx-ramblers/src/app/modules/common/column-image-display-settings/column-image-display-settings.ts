import { Component, inject, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ImageFit, PageContentColumn } from "../../../models/content-text.model";
import { FocalPoint } from "../../../models/image-cropper.model";
import { UrlService } from "../../../services/url.service";
import { FocalPointPickerComponent } from "../focal-point-picker/focal-point-picker";

@Component({
  selector: "app-column-image-display-settings",
  imports: [FormsModule, FontAwesomeModule, TooltipDirective, FocalPointPickerComponent],
  template: `
    @if (column) {
      <div class="form-group">
        <label class="form-label" [for]="idFor('image-fit')">Image Fit</label>
        <select [ngModel]="imageFit()"
                (ngModelChange)="onImageFitChanged($event)"
                [id]="idFor('image-fit')"
                class="form-control input-sm">
          <option [ngValue]="ImageFit.COVER">Crop to fill</option>
          <option [ngValue]="ImageFit.CONTAIN">Show entire image</option>
        </select>
      </div>
      <div class="form-group">
        <div class="form-check form-check-inline">
          <input [id]="idFor('image-padding')"
                 type="checkbox"
                 class="form-check-input"
                 [checked]="imagePaddingEnabled()"
                 (change)="onImagePaddingChanged($event)">
          <label class="form-check-label" [for]="idFor('image-padding')">
            Image padding</label>
        </div>
      </div>
      @if (imagePaddingEnabled()) {
        <div class="form-group">
          <label class="form-label" [for]="idFor('image-padding-size')">Padding Size</label>
          <input [(ngModel)]="column.imagePadding"
                 [id]="idFor('image-padding-size')"
                 min="0"
                 max="48"
                 class="form-control input-sm"
                 type="number">
        </div>
      }
      <div class="form-group">
        <label class="form-label">Focal Point</label>
        <p class="small text-muted mb-2">Click the image to choose which part stays in view. Scroll or use the slider to zoom.</p>
        <app-focal-point-picker
          [imageSrc]="resolvedImageSrc()"
          [minZoom]="0.2"
          [height]="previewHeight"
          [maxPreviewHeight]="previewHeight ? null : maxPreviewHeight"
          [focalPoint]="column.imageFocalPoint || defaultFocalPoint"
          (focalPointChange)="onFocalPointChange($event)">
        </app-focal-point-picker>
      </div>
      @if (imageSettingsChanged()) {
        <div class="form-group">
          <button type="button"
                  class="badge-button border-0"
                  tooltip="Reset image fit, padding and focal point to their defaults"
                  container="body"
                  (click)="resetImageSettings()">
            <fa-icon [icon]="faRotateLeft"></fa-icon>
            <span>Back to default</span>
          </button>
        </div>
      }
    }
  `
})
export class ColumnImageDisplaySettingsComponent {
  private urlService = inject(UrlService);
  @Input() column: PageContentColumn;
  @Input() imageSrc: string;
  @Input() idPrefix = "image-display";
  @Input() previewHeight: number = null;
  @Input() maxPreviewHeight = 260;
  protected readonly ImageFit = ImageFit;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly defaultFocalPoint: FocalPoint = {x: 50, y: 50, zoom: 1};

  idFor(name: string): string {
    return `${this.idPrefix}-${name}`;
  }

  resolvedImageSrc(): string {
    return this.imageSrc ? this.urlService.imageSource(this.imageSrc) : null;
  }

  imageFit(): ImageFit {
    return this.column?.imageFit || ImageFit.COVER;
  }

  onImageFitChanged(imageFit: ImageFit) {
    this.column.imageFit = imageFit;
  }

  imagePaddingEnabled(): boolean {
    return (this.column?.imagePadding || 0) > 0;
  }

  onImagePaddingChanged(event: Event) {
    const target = event.target as HTMLInputElement;
    this.column.imagePadding = target.checked ? (this.column.imagePadding || 16) : 0;
  }

  onFocalPointChange(focalPoint: FocalPoint) {
    this.column.imageFocalPoint = focalPoint || null;
  }

  imageSettingsChanged(): boolean {
    return !!this.column?.imageFit || (this.column?.imagePadding || 0) > 0 || !!this.column?.imageFocalPoint;
  }

  resetImageSettings() {
    this.column.imageFit = null;
    this.column.imagePadding = null;
    this.column.imageFocalPoint = null;
  }
}
