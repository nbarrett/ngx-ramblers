import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowDown, faArrowUp, faImage, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { ArticleBlock, ArticleBlockImageAlignment, ArticleBlockPosition } from "../../../models/email-composer.model";
import { TiptapMarkdownEditor } from "../tiptap-editor/tiptap-markdown-editor";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { ImageActionsDropdownComponent } from "../dynamic-content/image-actions-dropdown";
import { SectionDividerSelectComponent } from "../section-divider-select/section-divider-select";
import { SectionDividerStyle } from "../../../models/email-composer.model";
import { AwsFileData } from "../../../models/aws-object.model";
import { RootFolder } from "../../../models/system.model";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-article-blocks-editor",
  imports: [FormsModule, FontAwesomeModule, TiptapMarkdownEditor, ImageCropperAndResizerComponent, ImageActionsDropdownComponent, SectionDividerSelectComponent],
  styles: [`
    .article-block
      border: 1px solid #ced4da
      border-radius: 4px
      padding: 12px
      margin-bottom: 12px
      background-color: #fdfdfd

    .article-block-controls
      display: flex
      gap: 8px
      align-items: center
      margin-bottom: 8px

    .article-block-controls .position-pill
      font-size: 12px
      padding: 2px 6px
      background-color: #e9ecef
      border-radius: 4px

    .article-image-row
      display: grid
      grid-template-columns: 1fr 1fr
      gap: 8px
      margin-bottom: 8px

    .article-block-image-preview
      max-width: 100%
      height: auto
      border-radius: 4px
      display: block
      margin-bottom: 8px

    .article-block-image-controls
      display: flex
      gap: 8px
      align-items: center
      flex-wrap: wrap
      margin-bottom: 8px

    .add-article-row
      display: flex
      gap: 8px
      flex-wrap: wrap
      margin-top: 8px
  `],
  template: `
    <div class="article-blocks-editor">
      <h4>Article blocks</h4>
      <p class="text-muted small">Free-form content that flows into the email above or below the events list.</p>
      @for (block of orderedBlocks(); let idx = $index; track block.id) {
        <div class="article-block">
          <div class="article-block-controls">
            <span class="position-pill">{{ block.position === ArticleBlockPosition.ABOVE_EVENTS ? "Above events" : "Below events" }}</span>
            <button type="button" class="btn btn-sm btn-primary" (click)="moveUp(block)" [disabled]="!canMoveUp(block)" title="Move up">
              <fa-icon [icon]="faArrowUp"/>
            </button>
            <button type="button" class="btn btn-sm btn-primary" (click)="moveDown(block)" [disabled]="!canMoveDown(block)" title="Move down">
              <fa-icon [icon]="faArrowDown"/>
            </button>
            <app-image-actions-dropdown class="ms-auto"
                                        [hasImage]="!!block.image?.src"
                                        [fullWidth]="false"
                                        buttonClass="btn btn-sm btn-primary"
                                        (edit)="enterImageEdit(block)"
                                        (replace)="replaceImage(block)"
                                        (remove)="removeImage(block)"/>
            <button type="button" class="btn btn-sm btn-primary" (click)="togglePosition(block)" title="Move to other side of events">
              Move {{ block.position === ArticleBlockPosition.ABOVE_EVENTS ? "below" : "above" }} events
            </button>
            @if (pendingRemovalId === block.id) {
              <button type="button" class="btn btn-sm btn-danger" (click)="performRemove(block)" title="Confirm remove">
                Confirm remove
              </button>
              <button type="button" class="btn btn-sm btn-primary" (click)="cancelRemove()" title="Cancel">Cancel</button>
            } @else {
              <button type="button" class="btn btn-sm btn-danger" (click)="requestRemove(block)" title="Remove block">
                <fa-icon [icon]="faTrash"/>
              </button>
            }
          </div>
          <div class="mb-2">
            <label [for]="'block-title-' + block.id">Title (optional)</label>
            <input [id]="'block-title-' + block.id" type="text" class="form-control"
                   [(ngModel)]="block.title" (ngModelChange)="emitChange()"/>
          </div>
          @if (block.image?.src && imageEditingBlockId !== block.id) {
            <img class="article-block-image-preview"
                 [src]="urlService.imageSource(block.image!.src, true)"
                 [alt]="block.image!.alt || ''"/>
          }
          @if (imageEditingBlockId === block.id) {
            <app-image-cropper-and-resizer wrapButtons
                                           [rootFolder]="rootFolder"
                                           [preloadImage]="block.image?.src ? urlService.imageSource(block.image!.src, true) : null"
                                           (imageChange)="onCropperImageChange(block, $event)"
                                           (quit)="exitImageEdit(block)"
                                           (save)="onCropperSave(block, $event)"/>
          }
          @if (block.image?.src) {
            <div class="article-image-row">
              <div>
                <label>Alt text</label>
                <input type="text" class="form-control"
                       [ngModel]="block.image?.alt"
                       (ngModelChange)="onImageAltChange(block, $event)"/>
              </div>
              <div>
                <label>Alignment</label>
                <select class="form-select"
                        [ngModel]="block.image?.alignment"
                        (ngModelChange)="onImageAlignmentChange(block, $event)">
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
                                        (valueChange)="onBodyChange(block, $event)"
                                        placeholder="Write the body of this article block…"
                                        [showMergeFields]="true"/>
          </div>
          <app-section-divider-select label="Divider after this block"
                                      [value]="block.dividerAfter ?? defaultDivider"
                                      (valueChange)="onBlockDividerChange(block, $event)"/>
        </div>
      }
      <div class="add-article-row">
        <button type="button" class="btn btn-primary btn-sm"
                (click)="addBlock(ArticleBlockPosition.ABOVE_EVENTS)">
          <fa-icon [icon]="faPlus"/>
          Add article above events
        </button>
        <button type="button" class="btn btn-primary btn-sm"
                (click)="addBlock(ArticleBlockPosition.BELOW_EVENTS)">
          <fa-icon [icon]="faPlus"/>
          Add article below events
        </button>
      </div>
    </div>`
})
export class ArticleBlocksEditor {

  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  protected urlService = inject(UrlService);

  @Input() blocks: ArticleBlock[] = [];
  @Output() blocksChange = new EventEmitter<ArticleBlock[]>();
  @Output() removeRequested = new EventEmitter<ArticleBlock>();
  protected pendingRemovalId: string | null = null;
  protected imageEditingBlockId: string | null = null;
  protected readonly rootFolder = RootFolder.siteContent;
  protected readonly defaultDivider = SectionDividerStyle.THIN_YELLOW;

  protected readonly ArticleBlockPosition = ArticleBlockPosition;
  protected readonly ArticleBlockImageAlignment = ArticleBlockImageAlignment;
  protected readonly faArrowDown = faArrowDown;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faImage = faImage;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;

  orderedBlocks(): ArticleBlock[] {
    return [...this.blocks].sort((a, b) => {
      if (a.position !== b.position) {
        return a.position === ArticleBlockPosition.ABOVE_EVENTS ? -1 : 1;
      }
      return a.order - b.order;
    });
  }

  addBlock(position: ArticleBlockPosition): void {
    const ordered = this.orderedBlocks().filter(block => block.position === position);
    const nextOrder = ordered.length === 0 ? 0 : Math.max(...ordered.map(block => block.order)) + 1;
    const newBlock: ArticleBlock = {
      id: this.stringUtils.kebabCase(`block-${this.dateUtils.dateTimeNow().toMillis()}-${nextOrder}`),
      position,
      order: nextOrder,
      title: "",
      markdown: "",
      image: null
    };
    this.blocks = [...this.blocks, newBlock];
    this.emitChange();
  }

  requestRemove(block: ArticleBlock): void {
    this.pendingRemovalId = block.id;
  }

  cancelRemove(): void {
    this.pendingRemovalId = null;
  }

  performRemove(block: ArticleBlock): void {
    this.blocks = this.blocks.filter(item => item.id !== block.id);
    this.normaliseOrders();
    this.emitChange();
    this.removeRequested.emit(block);
    this.pendingRemovalId = null;
  }

  togglePosition(block: ArticleBlock): void {
    const updatedPosition = block.position === ArticleBlockPosition.ABOVE_EVENTS ? ArticleBlockPosition.BELOW_EVENTS : ArticleBlockPosition.ABOVE_EVENTS;
    block.position = updatedPosition;
    this.normaliseOrders();
    this.emitChange();
  }

  moveUp(block: ArticleBlock): void {
    const siblings = this.orderedBlocks().filter(item => item.position === block.position);
    const idx = siblings.findIndex(item => item.id === block.id);
    if (idx <= 0) return;
    const previous = siblings[idx - 1];
    const blockOrder = block.order;
    block.order = previous.order;
    previous.order = blockOrder;
    this.emitChange();
  }

  moveDown(block: ArticleBlock): void {
    const siblings = this.orderedBlocks().filter(item => item.position === block.position);
    const idx = siblings.findIndex(item => item.id === block.id);
    if (idx < 0 || idx === siblings.length - 1) return;
    const next = siblings[idx + 1];
    const blockOrder = block.order;
    block.order = next.order;
    next.order = blockOrder;
    this.emitChange();
  }

  canMoveUp(block: ArticleBlock): boolean {
    const siblings = this.orderedBlocks().filter(item => item.position === block.position);
    return siblings.findIndex(item => item.id === block.id) > 0;
  }

  canMoveDown(block: ArticleBlock): boolean {
    const siblings = this.orderedBlocks().filter(item => item.position === block.position);
    const idx = siblings.findIndex(item => item.id === block.id);
    return idx >= 0 && idx < siblings.length - 1;
  }

  onBodyChange(block: ArticleBlock, value: string): void {
    block.markdown = value;
    this.emitChange();
  }

  onBlockDividerChange(block: ArticleBlock, style: SectionDividerStyle): void {
    block.dividerAfter = style;
    this.emitChange();
  }

  enterImageEdit(block: ArticleBlock): void {
    this.imageEditingBlockId = block.id;
  }

  exitImageEdit(block: ArticleBlock): void {
    if (this.imageEditingBlockId === block.id) {
      this.imageEditingBlockId = null;
    }
  }

  onCropperImageChange(_block: ArticleBlock, _awsFileData: AwsFileData): void {
  }

  onCropperSave(block: ArticleBlock, awsFileData: AwsFileData): void {
    block.image = {
      src: awsFileData.awsFileName,
      alt: block.image?.alt ?? "",
      width: block.image?.width,
      alignment: block.image?.alignment ?? ArticleBlockImageAlignment.FULL
    };
    this.imageEditingBlockId = null;
    this.emitChange();
  }

  replaceImage(block: ArticleBlock): void {
    block.image = null;
    this.imageEditingBlockId = block.id;
    this.emitChange();
  }

  removeImage(block: ArticleBlock): void {
    block.image = null;
    this.imageEditingBlockId = null;
    this.emitChange();
  }

  onImageAltChange(block: ArticleBlock, alt: string): void {
    if (!block.image) return;
    block.image = { ...block.image, alt };
    this.emitChange();
  }

  onImageAlignmentChange(block: ArticleBlock, alignment: ArticleBlockImageAlignment): void {
    if (!block.image) return;
    block.image = { ...block.image, alignment };
    this.emitChange();
  }

  private normaliseOrders(): void {
    const above = this.blocks.filter(item => item.position === ArticleBlockPosition.ABOVE_EVENTS).sort((a, b) => a.order - b.order);
    const below = this.blocks.filter(item => item.position === ArticleBlockPosition.BELOW_EVENTS).sort((a, b) => a.order - b.order);
    above.forEach((block, idx) => block.order = idx);
    below.forEach((block, idx) => block.order = idx);
  }

  emitChange(): void {
    this.blocksChange.emit(this.blocks);
  }
}
