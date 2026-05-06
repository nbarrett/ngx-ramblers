import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faImage, faTrash } from "@fortawesome/free-solid-svg-icons";
import { ArticleBlock, ArticleBlockImageAlignment, SectionDividerStyle } from "../../../models/email-composer.model";
import { TiptapMarkdownEditor } from "../tiptap-editor/tiptap-markdown-editor";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { ImageActionsDropdownComponent } from "../dynamic-content/image-actions-dropdown";
import { SectionDividerSelectComponent } from "../section-divider-select/section-divider-select";
import { AwsFileData } from "../../../models/aws-object.model";
import { RootFolder } from "../../../models/system.model";
import { UrlService } from "../../../services/url.service";
import { SiteLinkInputComponent } from "../site-link-input/site-link-input";

@Component({
  selector: "app-article-block-single-editor",
  imports: [FormsModule, FontAwesomeModule, TiptapMarkdownEditor, ImageCropperAndResizerComponent, ImageActionsDropdownComponent, SectionDividerSelectComponent, SiteLinkInputComponent],
  styles: [`
    .article-block-single
      display: flex
      flex-direction: column
      gap: 8px

    .article-block-single-controls
      display: flex
      gap: 8px
      align-items: center
      flex-wrap: wrap
      justify-content: flex-end

    .article-image-row
      display: grid
      grid-template-columns: 1fr 1fr
      gap: 8px

    .article-block-image-preview
      max-width: 100%
      height: auto
      border-radius: 4px
      display: block
  `],
  template: `
    @if (block) {
      <div class="article-block-single">
        <div class="article-block-single-controls">
          <app-image-actions-dropdown
            [hasImage]="!!block.image?.src"
            [fullWidth]="false"
            buttonClass="btn btn-sm btn-primary"
            (edit)="enterImageEdit()"
            (replace)="replaceImage()"
            (remove)="removeImage()"/>
          @if (showRemove) {
            @if (pendingRemoval) {
              <button type="button" class="btn btn-sm btn-danger" (click)="performRemove()" title="Confirm remove">Confirm remove</button>
              <button type="button" class="btn btn-sm btn-primary" (click)="cancelRemove()">Cancel</button>
            } @else {
              <button type="button" class="btn btn-sm btn-danger" (click)="requestRemove()" title="Remove block">
                <fa-icon [icon]="faTrash"/>
              </button>
            }
          }
        </div>
        <div>
          <label [for]="'block-title-' + block.id">Title (optional)</label>
          <input [id]="'block-title-' + block.id" type="text" class="form-control"
                 [(ngModel)]="block.title" (ngModelChange)="emit()"/>
        </div>
        @if (block.image?.src && !imageEditing) {
          <img class="article-block-image-preview"
               [src]="resolvedImageSrc()"
               [alt]="block.image!.alt || ''"/>
        }
        @if (imageEditing) {
          <app-image-cropper-and-resizer wrapButtons
                                         [rootFolder]="rootFolder"
                                         [preloadImage]="resolvedImageSrc()"
                                         (imageChange)="onCropperImageChange($event)"
                                         (quit)="exitImageEdit()"
                                         (save)="onCropperSave($event)"/>
        }
        @if (block.image?.src) {
          <div class="article-image-row">
            <div>
              <label>Alt text</label>
              <input type="text" class="form-control"
                     [ngModel]="block.image?.alt"
                     (ngModelChange)="onImageAltChange($event)"/>
            </div>
            <div>
              <label>Alignment</label>
              <select class="form-select"
                      [ngModel]="block.image?.alignment"
                      (ngModelChange)="onImageAlignmentChange($event)">
                <option [ngValue]="ArticleBlockImageAlignment.LEFT">Left of text</option>
                <option [ngValue]="ArticleBlockImageAlignment.RIGHT">Right of text</option>
                <option [ngValue]="ArticleBlockImageAlignment.FULL">Full width above text</option>
              </select>
            </div>
          </div>
        }
        <div>
          <label>Body</label>
          <app-tiptap-markdown-editor [value]="block.markdown"
                                      (valueChange)="onBodyChange($event)"
                                      placeholder="Write the body of this article block…"
                                      [showMergeFields]="true"/>
        </div>
        <div class="article-image-row">
          <div>
            <label [for]="'block-button-text-' + block.id">Button text (optional)</label>
            <input [id]="'block-button-text-' + block.id" type="text" class="form-control"
                   placeholder="e.g. what you'd like the button to say"
                   [(ngModel)]="block.buttonText" (ngModelChange)="emit()"/>
          </div>
          <div>
            <label [for]="'block-button-url-' + block.id">Button URL</label>
            <app-site-link-input [inputId]="'block-button-url-' + block.id"
                                 placeholder="Pick a site page or paste any URL"
                                 [value]="block.buttonUrl"
                                 (valueChange)="block.buttonUrl = $event; emit()"/>
          </div>
        </div>
        @if (showDividerSelect) {
          <app-section-divider-select label="Divider after this block"
                                      [value]="block.dividerAfter ?? defaultDivider"
                                      (valueChange)="onBlockDividerChange($event)"/>
        }
      </div>
    }`
})
export class ArticleBlockSingleEditor {

  protected urlService = inject(UrlService);

  @Input() block: ArticleBlock | null = null;
  @Input() showRemove = true;
  @Input() showDividerSelect = false;
  @Output() blockChange = new EventEmitter<ArticleBlock>();
  @Output() removeRequested = new EventEmitter<ArticleBlock>();

  protected pendingRemoval = false;
  protected imageEditing = false;
  protected readonly rootFolder = RootFolder.siteContent;
  protected readonly defaultDivider = SectionDividerStyle.THIN_YELLOW;
  protected readonly ArticleBlockImageAlignment = ArticleBlockImageAlignment;
  protected readonly faImage = faImage;
  protected readonly faTrash = faTrash;

  emit(): void {
    if (this.block) this.blockChange.emit(this.block);
  }

  protected resolvedImageSrc(): string | null {
    const raw = this.block?.image?.src;
    if (!raw) return null;
    if (this.urlService.isRemoteUrl(raw)) return raw;
    const cleaned = raw.replace(/^\/+/, "");
    return this.urlService.imageSource(cleaned, true);
  }

  onBodyChange(value: string): void {
    if (!this.block) return;
    this.block.markdown = value;
    this.emit();
  }

  onBlockDividerChange(style: SectionDividerStyle): void {
    if (!this.block) return;
    this.block.dividerAfter = style;
    this.emit();
  }

  enterImageEdit(): void {
    this.imageEditing = true;
  }

  exitImageEdit(): void {
    this.imageEditing = false;
  }

  onCropperImageChange(_: AwsFileData): void {
  }

  onCropperSave(awsFileData: AwsFileData): void {
    if (!this.block) return;
    this.block.image = {
      src: awsFileData.awsFileName,
      alt: this.block.image?.alt ?? "",
      width: this.block.image?.width,
      alignment: this.block.image?.alignment ?? ArticleBlockImageAlignment.FULL
    };
    this.imageEditing = false;
    this.emit();
  }

  replaceImage(): void {
    if (!this.block) return;
    this.block.image = null;
    this.imageEditing = true;
    this.emit();
  }

  removeImage(): void {
    if (!this.block) return;
    this.block.image = null;
    this.imageEditing = false;
    this.emit();
  }

  onImageAltChange(alt: string): void {
    if (!this.block?.image) return;
    this.block.image = { ...this.block.image, alt };
    this.emit();
  }

  onImageAlignmentChange(alignment: ArticleBlockImageAlignment): void {
    if (!this.block?.image) return;
    this.block.image = { ...this.block.image, alignment };
    this.emit();
  }

  requestRemove(): void {
    this.pendingRemoval = true;
  }

  cancelRemove(): void {
    this.pendingRemoval = false;
  }

  performRemove(): void {
    if (!this.block) return;
    this.removeRequested.emit(this.block);
    this.pendingRemoval = false;
  }
}
