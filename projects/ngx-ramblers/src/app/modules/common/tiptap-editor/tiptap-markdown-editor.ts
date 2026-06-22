import { booleanAttribute, Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { HtmlBold, HtmlItalic } from "./html-marks.extension";
import Link from "@tiptap/extension-link";
import { ImageAlign, ImageSpacing, SpacedImage } from "./spaced-image.extension";
import { Markdown } from "@tiptap/markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Marked } from "marked";
import { TiptapEditorDirective } from "ngx-tiptap";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faBold,
  faBolt,
  faHeading,
  faImage,
  faItalic,
  faLink,
  faListOl,
  faListUl,
  faQuoteRight,
  faRedo,
  faRemoveFormat,
  faUndo
} from "@fortawesome/free-solid-svg-icons";
import {
  friendlyFieldLabel,
  friendlyText,
  LINK_DESTINATIONS,
  MemberMergeFieldHint,
  MERGE_FIELD_CATALOGUE,
  MergeFieldGroup
} from "../../../models/email-composer.model";
import { EditorFocusPosition, TiptapMark, TiptapTableCommand, TokenPopupType } from "../../../models/tiptap-editor.model";
import { MERGE_FIELD_NODE_NAME, MergeField } from "./merge-field.extension";
import { LINK_TOKEN_NODE_NAME, LinkToken } from "./link-token.extension";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { PAGE_BREAK_NODE_NAME, PageBreak } from "./page-break.extension";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { AwsFileData } from "../../../models/aws-object.model";
import { RootFolder } from "../../../models/system.model";
import { UrlService } from "../../../services/url.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent, NgOptionTemplateDirective } from "@ng-select/ng-select";

@Component({
  selector: "app-tiptap-markdown-editor",
  encapsulation: ViewEncapsulation.None,
  imports: [TiptapEditorDirective, FontAwesomeModule, ImageCropperAndResizerComponent, FormsModule, NgSelectComponent, NgOptionTemplateDirective, TooltipDirective],
  styles: [`
    .tiptap-editor-shell
      border: 1px solid #ced4da
      border-radius: 4px
      background-color: #ffffff
      display: flex
      flex-direction: column
      max-width: 100%
      min-width: 0
      overflow-x: clip
      position: relative

    .tiptap-editor-shell-disabled
      border-color: #adb5bd
      background-color: #f8f9fa
      box-shadow: inset 0 0 0 1px rgba(173, 181, 189, 0.35)

    .tiptap-editor-shell-disabled .tiptap-content
      background-color: #f8f9fa
      color: #6c757d

    .tiptap-editor-shell-disabled .tiptap-content .ProseMirror
      cursor: not-allowed

    .token-editor-popup
      position: absolute
      z-index: 30
      display: flex
      flex-direction: column
      gap: 8px
      background-color: #ffffff
      border: 1px solid #adb5bd
      border-radius: 8px
      padding: 12px
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25)

    .token-editor-popup.above
      transform: translateY(-100%)

    .dest-opt-label
      display: block

    .dest-opt-path
      display: block
      font-size: 0.78em
      color: #6c757d

    .token-editor-popup select,
    .token-editor-popup input
      width: 100%
      padding: 4px 6px
      border-radius: 4px
      border: 1px solid #ced4da

    .token-editor-title
      font-size: 0.72rem
      font-weight: 700
      color: #343a40
      text-transform: uppercase
      letter-spacing: 0.04em
      padding-bottom: 8px
      margin-bottom: 2px
      border-bottom: 1px solid #e9ecef

    .token-editor-label
      font-size: 0.72rem
      color: #6c757d
      margin: 2px 0 -2px

    .token-type-toggle
      display: flex
      gap: 4px

    .token-type-toggle button
      flex: 1
      padding: 4px 8px
      border-radius: 4px
      border: 1px solid #ced4da
      background-color: #ffffff
      cursor: pointer

    .token-type-toggle button.is-active
      background-color: rgb(249, 177, 4)
      border-color: rgb(211, 150, 3)
      font-weight: 600

    .token-editor-actions
      display: flex
      gap: 6px

    .tiptap-toolbar
      display: flex
      flex-wrap: wrap
      gap: 4px
      padding: 6px
      border-bottom: 1px solid #e9ecef
      background-color: #f8f9fa

    .tiptap-toolbar button
      background: transparent
      border: 1px solid transparent
      border-radius: 3px
      padding: 4px 8px
      min-height: 32px
      cursor: pointer
      color: #495057

    .tiptap-toolbar button:hover
      border-color: #adb5bd
      background-color: #ffffff

    .tiptap-toolbar button.is-active
      background-color: #ffffff
      border-color: #6c757d
      color: #c05711

    .tiptap-toolbar button.toolbar-text-toggle
      font-size: 0.8rem
      font-weight: 600
      border-color: #ced4da
      color: #495057

    .tiptap-toolbar select
      padding: 4px 8px
      border-radius: 3px
      border: 1px solid #ced4da
      background-color: #ffffff
      color: #495057

    .tiptap-toolbar app-image-actions-dropdown button.dropdown-toggle
      color: #495057
      background: transparent
      padding: 4px 8px
      min-height: 32px
      margin: 0

    .tiptap-toolbar app-image-actions-dropdown button.dropdown-toggle:hover
      border-color: #adb5bd
      background-color: #ffffff

    .tiptap-toolbar .toolbar-divider
      width: 1px
      background-color: #ced4da
      margin: 4px 4px

    .tiptap-content
      padding: 12px
      min-height: 180px
      overflow-x: hidden

    .tiptap-content.email-width
      max-width: 600px
      margin: 0 auto
      padding: 30px
      box-sizing: border-box

    .tiptap-content img,
    .tiptap-content table,
    .tiptap-content video,
    .tiptap-content iframe
      max-width: 100%
      height: auto

    .tiptap-content img
      max-height: 120px
      width: auto
      border: 1px solid #ced4da
      border-radius: 4px
      padding: 2px
      background-color: #f8f9fa
      cursor: zoom-in
      transition: max-height 0.15s ease

    .tiptap-content .ProseMirror > img
      display: block
      margin-bottom: 12px

    .tiptap-content img[data-sized],
    .tiptap-content img[data-sized]:hover
      max-height: none

    .image-resize-handle
      position: absolute
      z-index: 26
      width: 10px
      height: 34px
      background-color: #ffffff
      border: 1px solid #6c757d
      border-radius: 5px
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35)
      cursor: ew-resize

    .image-resize-handle::after
      content: ""
      position: absolute
      top: 50%
      left: 50%
      transform: translate(-50%, -50%)
      width: 4px
      height: 16px
      border-left: 1px solid #adb5bd
      border-right: 1px solid #adb5bd

    .tiptap-content img:hover
      max-height: 460px
      cursor: zoom-out

    .tiptap-content img.ProseMirror-selectednode
      max-height: none
      cursor: default
      box-shadow: 0 0 0 2px rgba(249, 177, 4, 0.7)

    .tiptap-content,
    .tiptap-content p,
    .tiptap-content li,
    .tiptap-content blockquote,
    .tiptap-content pre,
    .tiptap-content a,
    .tiptap-content span
      word-wrap: break-word
      overflow-wrap: anywhere
      word-break: break-word
      max-width: 100%

    .tiptap-content .ProseMirror
      min-height: 160px
      outline: none

    .tiptap-content merge-field,
    .tiptap-content .merge-field-chip
      display: inline-block
      background-color: rgba(249, 177, 4, 0.18)
      border: 1px solid rgb(249, 177, 4)
      border-radius: 4px
      padding: 0 5px
      font-size: 0.85em
      line-height: 1.4
      white-space: nowrap
      color: #6b5200
      cursor: default

    .tiptap-content merge-field.ProseMirror-selectednode
      box-shadow: 0 0 0 2px rgba(249, 177, 4, 0.55)

    .tiptap-content page-break,
    .tiptap-content .page-break-chip
      display: flex
      align-items: center
      gap: 10px
      margin: 0.75rem 0
      color: #6b5200
      cursor: default
      user-select: none

    .tiptap-content page-break::before,
    .tiptap-content page-break::after
      content: ""
      flex: 1
      border-top: 2px dashed rgb(249, 177, 4)

    .tiptap-content .page-break-label
      font-size: 0.72rem
      font-weight: 700
      text-transform: uppercase
      letter-spacing: 0.06em
      background-color: rgba(249, 177, 4, 0.18)
      border: 1px solid rgb(249, 177, 4)
      border-radius: 4px
      padding: 0 6px

    .tiptap-content page-break.ProseMirror-selectednode .page-break-label
      box-shadow: 0 0 0 2px rgba(249, 177, 4, 0.55)

    .tiptap-content .chip-example
      display: none

    .tiptap-content.show-examples .chip-name
      display: none

    .tiptap-content.show-examples .chip-example
      display: inline

    .tiptap-content link-token,
    .tiptap-content .link-pill
      display: inline-flex
      align-items: baseline
      gap: 7px
      vertical-align: baseline
      background-color: rgba(155, 200, 171, 0.25)
      border: 1px solid rgb(155, 200, 171)
      border-radius: 6px
      padding: 1px 9px
      margin: 0 2px
      cursor: default

    .tiptap-content .link-pill-label
      color: rgb(64, 65, 65)
      font-weight: 600

    .tiptap-content .link-pill-destination
      font-size: 0.78em
      color: rgb(99, 134, 110)

    .tiptap-content link-token.ProseMirror-selectednode
      box-shadow: 0 0 0 2px rgba(155, 200, 171, 0.7)

    .tiptap-content table
      border-collapse: collapse
      margin: 8px 0
      width: 100%

    .tiptap-content table td,
    .tiptap-content table th
      border: 1px solid #ced4da
      padding: 6px 8px
      vertical-align: top
      min-width: 50px

    .tiptap-content table th
      background-color: #f8f9fa
      font-weight: bold
      text-align: left

    .tiptap-content .ProseMirror p.is-editor-empty:first-child::before
      content: attr(data-placeholder)
      float: left
      color: #adb5bd
      pointer-events: none
      height: 0

    .inline-input-bar
      display: flex
      gap: 6px
      padding: 6px
      border-bottom: 1px solid #e9ecef
      background-color: #ffffff
      flex-wrap: wrap
      align-items: center

    .inline-input-bar input
      flex: 1
      min-width: 160px
  `],
  template: `
    <div class="tiptap-editor-shell" [class.tiptap-editor-shell-disabled]="!editable" [attr.aria-disabled]="!editable">
      @if (editable) {
      <div class="tiptap-toolbar" [class.tiptap-toolbar-sticky]="stickyToolbar" role="toolbar" (mousedown)="onToolbarMousedown($event)">
        <button type="button" tooltip="Bold" container="body" delay=500 (click)="toggle(TiptapMark.Bold)" [class.is-active]="isActive('bold')">
          <fa-icon [icon]="faBold"/>
        </button>
        <button type="button" tooltip="Italic" container="body" delay=500 (click)="toggle(TiptapMark.Italic)" [class.is-active]="isActive('italic')">
          <fa-icon [icon]="faItalic"/>
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" tooltip="Heading 2" container="body" delay=500 (click)="toggleHeading(2)" [class.is-active]="isActive('heading', { level: 2 })">
          <fa-icon [icon]="faHeading"/> 2
        </button>
        <button type="button" tooltip="Heading 3" container="body" delay=500 (click)="toggleHeading(3)" [class.is-active]="isActive('heading', { level: 3 })">
          <fa-icon [icon]="faHeading"/> 3
        </button>
        <button type="button" tooltip="Heading 4 (click again to make it normal text)" container="body" delay=500 (click)="toggleHeading(4)" [class.is-active]="isActive('heading', { level: 4 })">
          <fa-icon [icon]="faHeading"/> 4
        </button>
        <button type="button" tooltip="Normal text (removes any heading)" container="body" delay=500 (click)="setNormalText()" [class.is-active]="isActive('paragraph')">
          Normal
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" tooltip="Bulleted list" container="body" delay=500 (click)="toggle(TiptapMark.BulletList)" [class.is-active]="isActive('bulletList')">
          <fa-icon [icon]="faListUl"/>
        </button>
        <button type="button" tooltip="Numbered list" container="body" delay=500 (click)="toggle(TiptapMark.OrderedList)" [class.is-active]="isActive('orderedList')">
          <fa-icon [icon]="faListOl"/>
        </button>
        <button type="button" tooltip="Quote" container="body" delay=500 (click)="toggle(TiptapMark.Blockquote)" [class.is-active]="isActive('blockquote')">
          <fa-icon [icon]="faQuoteRight"/>
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" tooltip="Insert link" container="body" delay=500 (click)="openLinkBar()">
          <fa-icon [icon]="faLink"/>
        </button>
        <button type="button" tooltip="Insert a link" container="body" delay=500 (click)="openLinkTokenInsert()">
          <fa-icon [icon]="faBolt"/>
        </button>
        <button type="button" tooltip="Insert image" container="body" delay=500 (click)="insertImage()">
          <fa-icon [icon]="faImage"/>
        </button>
        <button type="button" class="toolbar-text-toggle" tooltip="Insert a table at the cursor" container="body" delay=500 (click)="insertTable()">
          Table
        </button>
        @if (showPageBreak) {
          <button type="button" class="toolbar-text-toggle" tooltip="Insert a page break at the cursor" container="body" delay=500
                  (click)="insertPageBreak()">
            Page break
          </button>
        }
        <span class="toolbar-divider"></span>
        @if (showMergeFields) {
          <select tooltip="Insert a merge field at the cursor" container="body" delay=500 (change)="onMergeFieldInsert($event)">
            <option value="">Insert merge field…</option>
            @for (group of mergeFieldCatalogue; track group.group) {
              <optgroup [label]="group.group">
                @for (field of group.fields; track field.token) {
                  <option [value]="field.token">{{ field.label }}</option>
                }
              </optgroup>
            }
          </select>
          <button type="button" class="toolbar-text-toggle" [class.is-active]="showExampleValues"
                  tooltip="Toggle merge fields between their names and example values" container="body" delay=500
                  (click)="showExampleValues = !showExampleValues">
            {{ showExampleValues ? "Example values" : "Field names" }}
          </button>
          <span class="toolbar-divider"></span>
        }
        @if (tableSelected) {
          <button type="button" class="toolbar-text-toggle" tooltip="Add a row above the current row" container="body" delay=500 (click)="tableCommand(TiptapTableCommand.AddRowAbove)">+Row ↑</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Add a row below the current row" container="body" delay=500 (click)="tableCommand(TiptapTableCommand.AddRowBelow)">+Row ↓</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Delete the current row" container="body" delay=500 (click)="tableCommand(TiptapTableCommand.DeleteRow)">−Row</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Add a column to the left" container="body" delay=500 (click)="tableCommand(TiptapTableCommand.AddColumnLeft)">+Col ←</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Add a column to the right" container="body" delay=500 (click)="tableCommand(TiptapTableCommand.AddColumnRight)">+Col →</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Delete the current column" container="body" delay=500 (click)="tableCommand(TiptapTableCommand.DeleteColumn)">−Col</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Move the current column left" container="body" delay=500 (click)="moveTableColumn(-1)">◀ Col</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Move the current column right" container="body" delay=500 (click)="moveTableColumn(1)">Col ▶</button>
          <button type="button" class="toolbar-text-toggle" tooltip="Delete the whole table" container="body" delay=500 (click)="tableCommand(TiptapTableCommand.DeleteTable)">−Table</button>
          <span class="toolbar-divider"></span>
        }
        <button type="button" tooltip="Clear formatting" container="body" delay=500 (click)="clearFormatting()">
          <fa-icon [icon]="faRemoveFormat"/>
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" tooltip="Undo" container="body" delay=500 (click)="undo()">
          <fa-icon [icon]="faUndo"/>
        </button>
        <button type="button" tooltip="Redo" container="body" delay=500 (click)="redo()">
          <fa-icon [icon]="faRedo"/>
        </button>
      </div>
      }
      @if (linkBarOpen) {
        <div class="inline-input-bar">
          <label class="me-1">Link URL:</label>
          <input type="url" [(value)]="linkUrl" placeholder="https://example.com"
                 (keyup.enter)="confirmLink()" (input)="linkUrl = inputValue($event)">
          <button type="button" class="btn btn-sm btn-primary" (click)="confirmLink()">Apply</button>
          <button type="button" class="btn btn-sm btn-secondary" (click)="cancelLinkBar()">Cancel</button>
          @if (isActive('link')) {
            <button type="button" class="btn btn-sm btn-danger" (click)="removeLink()">Remove link</button>
          }
        </div>
      }
      @if (imageCropperOpen) {
        <div class="inline-input-bar" style="display:block">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="token-editor-title">{{ cropperPreloadSrc ? "Crop &amp; resize image" : "Add or replace image" }}</span>
            <button type="button" class="btn btn-sm btn-secondary" (click)="cancelImageCropper()">Cancel</button>
          </div>
          <app-image-cropper-and-resizer wrapButtons
                                         [rootFolder]="rootFolder"
                                         [preloadImage]="cropperPreloadSrc"
                                         (quit)="cancelImageCropper()"
                                         (save)="onImageCropperSave($event)"/>
        </div>
      }
      <div class="tiptap-content" [class.show-examples]="showExampleValues" [class.email-width]="constrainToEmailWidth && !editable">
        @if (editor) {
          <tiptap-editor [editor]="editor"></tiptap-editor>
        }
      </div>
      @if (editable && imageSelected && !imageCropperOpen) {
        <div class="image-resize-handle" [style.top.px]="imageHandleTop" [style.left.px]="imageHandleLeft"
             tooltip="Drag to set the image width" container="body" delay=500 (mousedown)="onImageResizeStart($event)"></div>
      }
      @if (editable && (mergeFieldSelected || linkTokenSelected || insertLinkMode || imageSelected)) {
        <div class="token-editor-popup" [class.above]="tokenEditorAbove"
             [style.top.px]="tokenEditorTop" [style.left.px]="tokenEditorLeft"
             [style.min-width.px]="tokenEditorMinWidth">
          @if (imageSelected) {
            <div class="token-editor-title">Image</div>
            <div class="token-editor-actions">
              <button type="button" class="btn btn-sm btn-primary" (click)="onImageActionEdit()">Crop &amp; resize</button>
              <button type="button" class="btn btn-sm btn-secondary" (click)="onImageActionReplace()">Replace</button>
              <button type="button" class="btn btn-sm btn-danger" (click)="onImageActionRemove()">Remove</button>
            </div>
            <label class="token-editor-label">Space above &amp; below</label>
            <div class="token-type-toggle">
              <button type="button" [class.is-active]="imageSpacing === ImageSpacing.None" (click)="setImageSpacing(ImageSpacing.None)">None</button>
              <button type="button" [class.is-active]="imageSpacing === ImageSpacing.Small" (click)="setImageSpacing(ImageSpacing.Small)">Small</button>
              <button type="button" [class.is-active]="imageSpacing === ImageSpacing.Medium" (click)="setImageSpacing(ImageSpacing.Medium)">Medium</button>
              <button type="button" [class.is-active]="imageSpacing === ImageSpacing.Large" (click)="setImageSpacing(ImageSpacing.Large)">Large</button>
            </div>
            <label class="token-editor-label">Align (when narrower than the email)</label>
            <div class="token-type-toggle">
              <button type="button" [class.is-active]="imageAlign === ImageAlign.Left" (click)="setImageAlign(ImageAlign.Left)">Left</button>
              <button type="button" [class.is-active]="imageAlign === ImageAlign.Center" (click)="setImageAlign(ImageAlign.Center)">Centre</button>
              <button type="button" [class.is-active]="imageAlign === ImageAlign.Right" (click)="setImageAlign(ImageAlign.Right)">Right</button>
            </div>
          } @else {
            <div class="token-editor-title">{{ insertLinkMode ? "Add" : "Edit" }}</div>
            @if (showMergeFields) {
              <div class="token-type-toggle">
                <button type="button" [class.is-active]="tokenPopupType === TokenPopupType.Field" (click)="setTokenType(TokenPopupType.Field)">Merge field</button>
                <button type="button" [class.is-active]="tokenPopupType === TokenPopupType.Link" (click)="setTokenType(TokenPopupType.Link)">Link</button>
              </div>
            }
            @if (showMergeFields && tokenPopupType === TokenPopupType.Field) {
              <label class="token-editor-label">Field</label>
              <select tooltip="Pick a merge field" container="body" delay=500 (change)="tokenFieldValue = inputValue($event)">
                <option value="">Choose a field…</option>
                @for (group of mergeFieldCatalogue; track group.group) {
                  <optgroup [label]="group.group">
                    @for (field of group.fields; track field.token) {
                      <option [value]="field.token" [selected]="field.token === tokenFieldValue">{{ field.label }}</option>
                    }
                  </optgroup>
                }
              </select>
            } @else {
              <label class="token-editor-label">Link text</label>
              <input type="text" [attr.list]="'tiptap-fields-' + editorId" [value]="linkTextDisplay"
                     placeholder="Type text or pick a field"
                     (keyup.enter)="applyToken()" (input)="linkTextDisplay = inputValue($event)">
              <datalist [id]="'tiptap-fields-' + editorId">
                @for (field of allMergeFields; track field.token) {
                  <option [value]="field.label"></option>
                }
              </datalist>
              <label class="token-editor-label">Goes to</label>
              <ng-select class="token-editor-dest" [items]="linkDestinationItems" bindLabel="label" bindValue="token"
                         [(ngModel)]="linkHrefValue" [addTag]="addExternalUrl" addTagText="Use web address:"
                         [searchFn]="searchDestinations" [clearable]="false"
                         placeholder="Pick a page or paste a web address">
                <ng-template ng-option-tmp let-item="item">
                  <span class="dest-opt-label">{{ item.label }}</span>
                  @if (destinationHint(item)) {
                    <span class="dest-opt-path">{{ destinationHint(item) }}</span>
                  }
                </ng-template>
              </ng-select>
            }
            <div class="token-editor-actions">
              <button type="button" class="btn btn-sm btn-primary" (click)="applyToken()">Apply</button>
              <button type="button" class="btn btn-sm btn-secondary" (click)="closeTokenEditor()">Cancel</button>
            </div>
          }
        </div>
      }
    </div>`
})
export class TiptapMarkdownEditor implements OnInit, OnDestroy {

  @Input() set value(markdown: string) {
    const incoming = markdown ?? "";
    if (this.editor) {
      const current = this.currentMarkdown();
      if (incoming !== current) {
        this.editor.commands.setContent(incoming, { contentType: "markdown", emitUpdate: false });
      }
    } else {
      this.pendingValue = incoming;
    }
  }

  private pendingFocusPosition: EditorFocusPosition | null = null;

  public focusAtStart(): void {
    this.focusWhenReady(EditorFocusPosition.START);
  }

  public focusAtEnd(): void {
    this.focusWhenReady(EditorFocusPosition.END);
  }

  public focusWhenReady(position: EditorFocusPosition = EditorFocusPosition.START): void {
    if (this.editor) {
      this.attemptFocus(position, 0);
    } else {
      this.pendingFocusPosition = position;
    }
  }

  private attemptFocus(position: EditorFocusPosition, attempt: number): void {
    const editor = this.editor;
    if (!editor) {
      return;
    }
    editor.commands.focus(position);
    if (!editor.isFocused && attempt < 12) {
      requestAnimationFrame(() => this.attemptFocus(position, attempt + 1));
    }
  }

  @Input() placeholder: string = "Start writing…";
  @Input() showMergeFields: boolean = false;
  @Input({transform: booleanAttribute}) showPageBreak = false;
  @Input() constrainToEmailWidth: boolean = false;
  @Input({transform: booleanAttribute}) stickyToolbar = false;
  @Input() editable: boolean = true;
  private _extraLinkDestinations: MemberMergeFieldHint[] = [];
  @Input() set extraLinkDestinations(value: MemberMergeFieldHint[]) {
    this._extraLinkDestinations = value || [];
    this.rebuildLinkDestinations();
  }
  get extraLinkDestinations(): MemberMergeFieldHint[] {
    return this._extraLinkDestinations;
  }

  protected linkDestinationItems: MemberMergeFieldHint[] = [...LINK_DESTINATIONS];

  private rebuildLinkDestinations(): void {
    const items = [...this.linkDestinations, ...this._extraLinkDestinations];
    const current = (this.linkHrefValue || "").trim();
    if (current && !items.some(destination => destination.token === current)) {
      items.unshift({token: current, label: this.displayDestination(current)});
    }
    this.linkDestinationItems = items;
  }

  protected destinationHint(item: MemberMergeFieldHint): string {
    const match = (item?.token || "").match(/APP_URL\s*\}\}(.*)$/);
    return match ? (match[1] || "/") : "";
  }

  protected searchDestinations = (term: string, item: MemberMergeFieldHint): boolean => {
    const normalise = (value: string): string => (value || "").toLowerCase().replace(/[\s\-_]/g, "");
    return normalise(`${item?.label} ${item?.token}`).includes(normalise(term));
  };

  protected addExternalUrl = (term: string): MemberMergeFieldHint => ({token: (term || "").trim(), label: (term || "").trim()});
  @Output() valueChange = new EventEmitter<string>();
  @Output() rawPaste = new EventEmitter<{ text: string; consume: () => void }>();

  protected editor: Editor | null = null;
  private pendingValue: string = "";
  private urlService = inject(UrlService);
  private pasteMarked = new Marked();
  private _mergeFieldCatalogue: MergeFieldGroup[] = MERGE_FIELD_CATALOGUE;
  @Input() set mergeFieldCatalogue(value: MergeFieldGroup[] | undefined) {
    this._mergeFieldCatalogue = value ?? MERGE_FIELD_CATALOGUE;
    this.allMergeFields = this._mergeFieldCatalogue.flatMap(group => group.fields);
  }
  get mergeFieldCatalogue(): MergeFieldGroup[] {
    return this._mergeFieldCatalogue;
  }
  protected allMergeFields: MemberMergeFieldHint[] = MERGE_FIELD_CATALOGUE.flatMap(group => group.fields);
  protected linkDestinations: MemberMergeFieldHint[] = LINK_DESTINATIONS;
  protected linkTextDisplay: string = "";
  protected linkHrefValue: string = "";
  protected readonly editorId: number = TiptapMarkdownEditor.nextEditorId();
  private static editorInstanceCount = 0;
  private static nextEditorId(): number {
    return TiptapMarkdownEditor.editorInstanceCount += 1;
  }
  protected mergeFieldSelected: boolean = false;
  protected tableSelected = false;
  protected linkBarOpen: boolean = false;
  protected imageCropperOpen: boolean = false;
  protected imageSelected: boolean = false;
  protected imageSpacing: ImageSpacing = ImageSpacing.Small;
  protected imageAlign: ImageAlign = ImageAlign.Center;
  protected readonly ImageAlign = ImageAlign;
  protected imageHandleTop: number = 0;
  protected imageHandleLeft: number = 0;
  private imageResizeState: { startX: number; startWidth: number; pos: number; img: HTMLImageElement } | null = null;
  protected showExampleValues: boolean = false;
  protected cropperPreloadSrc: string | null = null;
  protected replaceSelectedImageOnSave: boolean = false;
  protected linkUrl: string = "";
  protected linkTokenOriginalLabel: string = "";
  protected linkTokenSelected: boolean = false;
  protected insertLinkMode: boolean = false;
  protected tokenPopupType: TokenPopupType = TokenPopupType.Field;
  protected readonly TokenPopupType = TokenPopupType;
  protected readonly ImageSpacing = ImageSpacing;
  protected tokenEditorTop: number = 0;
  protected tokenEditorLeft: number = 0;
  protected tokenEditorMinWidth: number = 210;
  protected tokenEditorAbove: boolean = false;
  protected tokenFieldValue: string = "";
  protected readonly rootFolder = RootFolder.siteContent;

  private logger: Logger = inject(LoggerFactory).createLogger("TiptapMarkdownEditor", NgxLoggerLevel.ERROR);

  protected readonly TiptapMark = TiptapMark;
  protected readonly TiptapTableCommand = TiptapTableCommand;
  protected readonly faBold = faBold;
  protected readonly faBolt = faBolt;
  protected readonly faImage = faImage;
  protected readonly faItalic = faItalic;
  protected readonly faLink = faLink;
  protected readonly faListOl = faListOl;
  protected readonly faListUl = faListUl;
  protected readonly faQuoteRight = faQuoteRight;
  protected readonly faUndo = faUndo;
  protected readonly faRedo = faRedo;
  protected readonly faHeading = faHeading;
  protected readonly faRemoveFormat = faRemoveFormat;

  ngOnInit(): void {
    const extensions: any[] = [
      StarterKit.configure({ bold: false, italic: false }),
      HtmlBold,
      HtmlItalic,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      SpacedImage.configure({ inline: false, allowBase64: false }),
      MergeField,
      LinkToken,
      PageBreak,
      Markdown,
      Table.configure({ resizable: false, HTMLAttributes: { class: "tiptap-table" } }),
      TableRow,
      TableHeader,
      TableCell
    ];
    this.editor = new Editor({
      extensions,
      editable: this.editable,
      editorProps: {
        attributes: {
          "data-placeholder": this.placeholder ?? ""
        },
        handlePaste: (_view, event) => {
          const pastedHtml = event.clipboardData?.getData("text/html") ?? "";
          const internalPaste = this.isInternalPaste(pastedHtml);
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (text) {
            let consumed = false;
            this.rawPaste.emit({ text, consume: () => { consumed = true; } });
            if (consumed) {
              event.preventDefault();
              return true;
            }
          }
          if (!internalPaste && text && this.looksLikeMarkdown(text)) {
            event.preventDefault();
            const sanitised = this.sanitiseMarkdownForPaste(text);
            try {
              const html = this.pasteMarked.parse(sanitised, { async: false }) as string;
              const normalised = this.normaliseHtmlForInsert(html);
              this.editor?.commands.insertContent(normalised);
            } catch (error) {
              this.logger.error("markdown paste failed, falling back to plain text:", error);
              this.editor?.commands.insertContent(sanitised);
            }
            return true;
          }
          return false;
        },
        transformPastedHTML: (html: string) => this.isInternalPaste(html) ? html : this.sanitiseHtmlForPaste(html)
      },
      content: this.pendingValue,
      contentType: "markdown",
      onCreate: () => {
        if (this.pendingFocusPosition) {
          const position = this.pendingFocusPosition;
          this.pendingFocusPosition = null;
          this.attemptFocus(position, 0);
        }
      }
    });
    this.editor.on("update", () => {
      const markdown = this.currentMarkdown();
      this.valueChange.emit(markdown);
    });
    this.editor.on("selectionUpdate", () => {
      this.imageSelected = this.editor?.isActive("image") ?? false;
      this.mergeFieldSelected = this.editor?.isActive(MERGE_FIELD_NODE_NAME) ?? false;
      this.tableSelected = this.editor?.isActive("table") ?? false;
      this.linkTokenSelected = this.editor?.isActive(LINK_TOKEN_NODE_NAME) ?? false;
      if (this.mergeFieldSelected) {
        this.insertLinkMode = false;
        this.tokenPopupType = TokenPopupType.Field;
        this.tokenFieldValue = `{{${this.editor?.getAttributes(MERGE_FIELD_NODE_NAME)["token"]}}}`;
        this.positionTokenEditor();
      } else if (this.linkTokenSelected) {
        this.insertLinkMode = false;
        this.tokenPopupType = TokenPopupType.Link;
        const attributes = this.editor?.getAttributes(LINK_TOKEN_NODE_NAME) ?? {};
        this.linkTokenOriginalLabel = (attributes["label"] as string) ?? "";
        this.linkHrefValue = (attributes["href"] as string) ?? LINK_DESTINATIONS[0].token;
        this.rebuildLinkDestinations();
        this.linkTextDisplay = friendlyText(this.linkTokenOriginalLabel);
        this.positionTokenEditor();
      } else if (this.imageSelected) {
        this.insertLinkMode = false;
        this.imageSpacing = (this.editor?.getAttributes("image")["spacing"] as ImageSpacing) ?? ImageSpacing.Small;
        this.imageAlign = (this.editor?.getAttributes("image")["align"] as ImageAlign) ?? ImageAlign.Center;
        this.positionTokenEditor();
        this.positionImageHandle();
      }
    });
  }

  private isInternalPaste(html: string): boolean {
    return !!html && html.includes("data-pm-slice");
  }

  private sanitiseHtmlForPaste(html: string): string {
    if (!html) return html;
    try {
      const collapsed = html.replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ");
      const doc = new DOMParser().parseFromString(collapsed, "text/html");
      const widthAffectingAttrs = ["style", "width", "height", "bgcolor", "align", "valign", "cellpadding", "cellspacing", "border"];
      doc.querySelectorAll("*").forEach(el => {
        widthAffectingAttrs.forEach(attr => el.removeAttribute(attr));
        const cls = (el.getAttribute("class") ?? "")
          .split(/\s+/)
          .filter(c => c && !/^mso/i.test(c) && !/^Mso/.test(c))
          .join(" ");
        if (cls) el.setAttribute("class", cls); else el.removeAttribute("class");
      });
      doc.querySelectorAll("o\\:p, v\\:shape, v\\:imagedata, v\\:roundrect, v\\:line, v\\:rect, v\\:textbox, w\\:wordDocument").forEach(el => el.remove());
      doc.querySelectorAll("font").forEach(el => {
        const span = doc.createElement("span");
        Array.from(el.childNodes).forEach(child => span.appendChild(child));
        el.replaceWith(span);
      });
      doc.querySelectorAll("table").forEach(table => {
        const fragment = doc.createDocumentFragment();
        table.querySelectorAll("td, th").forEach(cell => {
          Array.from(cell.childNodes).forEach(child => fragment.appendChild(child));
          fragment.appendChild(doc.createElement("br"));
        });
        table.replaceWith(fragment);
      });
      return doc.body.innerHTML;
    } catch {
      return html;
    }
  }

  private normaliseHtmlForInsert(html: string): string {
    return html
      .replace(/<\/?thead[^>]*>/gi, "")
      .replace(/<\/?tbody[^>]*>/gi, "")
      .replace(/>\s+</g, "><");
  }

  private sanitiseMarkdownForPaste(text: string): string {
    let cleaned = text;
    if (cleaned.startsWith("---\n")) {
      const closingIdx = cleaned.indexOf("\n---", 4);
      if (closingIdx > 0) {
        const afterClosing = closingIdx + 4;
        const newlineAfter = cleaned.indexOf("\n", afterClosing);
        cleaned = cleaned.slice(newlineAfter > 0 ? newlineAfter + 1 : afterClosing);
      }
    }
    cleaned = cleaned.replace(/<\/?(?:Tabs|Tab|Note|Tip|Warning|Steps|Step|Frame|Card|CardGroup|Accordion|AccordionGroup|CodeGroup|Info|Check|Callout)\b[^>]*>/gi, "");
    cleaned = cleaned.replace(/^\s*```[a-zA-Z0-9]*\s+theme=\{null\}\s*$/gm, "```");
    return cleaned;
  }

  private looksLikeMarkdown(text: string): boolean {
    if (!text || text.length < 4) return false;
    let score = 0;
    if (/^#{1,6} \S/m.test(text)) score += 2;
    if (/^[-*+] \S/m.test(text)) score += 2;
    if (/^\d+\. \S/m.test(text)) score += 2;
    if (/^> /m.test(text)) score += 2;
    if (/^```/m.test(text)) score += 2;
    if (/!\[[^\]]*\]\([^)]+\)/.test(text)) score += 2;
    if (/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/m.test(text)) score += 2;
    if (/\*\*\S[^*]*\S\*\*/.test(text)) score += 1;
    if (/`[^`\n]+`/.test(text)) score += 1;
    if (/\[[^\]]+\]\([^)]+\)/.test(text)) score += 1;
    return score >= 2;
  }

  ngOnDestroy(): void {
    document.removeEventListener("mousemove", this.onImageResizeMove);
    document.removeEventListener("mouseup", this.onImageResizeEnd);
    this.editor?.destroy();
    this.editor = null;
  }

  private currentMarkdown(): string {
    const markdown = this.editor?.getMarkdown?.() ?? this.editor?.getHTML() ?? "";
    return this.stripOrphanInlineMarks(markdown);
  }

  private stripOrphanInlineMarks(markdown: string): string {
    return markdown
      .replace(/<(strong|em)>\s*<\/\1>/g, "")
      .replace(/<(strong|em)>[ \t]*(\n|$)/g, "$2");
  }

  isActive(name: string, attrs?: Record<string, any>): boolean {
    if (!this.editor) return false;
    return attrs ? this.editor.isActive(name, attrs) : this.editor.isActive(name);
  }

  onToolbarMousedown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target?.closest("button")) {
      event.preventDefault();
    }
  }

  toggle(name: TiptapMark): void {
    if (!this.editor) return;
    if (name === TiptapMark.Bold) {
      this.toggleInlineMark("bold");
      return;
    }
    if (name === TiptapMark.Italic) {
      this.toggleInlineMark("italic");
      return;
    }
    const chain = this.editor.chain().focus();
    if (name === TiptapMark.BulletList) chain.toggleBulletList().run();
    else if (name === TiptapMark.OrderedList) chain.toggleOrderedList().run();
    else if (name === TiptapMark.Blockquote) chain.toggleBlockquote().run();
  }

  private toggleInlineMark(markName: string): void {
    if (!this.editor) return;
    const { from, to, empty } = this.editor.state.selection;
    if (empty) {
      this.editor.chain().focus().toggleMark(markName).run();
      return;
    }
    const text = this.editor.state.doc.textBetween(from, to, "￼", "￼");
    const leading = text.length - text.replace(/^\s+/, "").length;
    const trailing = text.length - text.replace(/\s+$/, "").length;
    const trimmedFrom = from + leading;
    const trimmedTo = to - trailing;
    if (trimmedTo <= trimmedFrom) {
      this.editor.chain().focus().toggleMark(markName).run();
      return;
    }
    this.editor.chain().focus().setTextSelection({ from: trimmedFrom, to: trimmedTo }).toggleMark(markName).run();
  }

  toggleHeading(level: 2 | 3 | 4): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  insertTable(): void {
    this.editor?.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run();
  }

  tableCommand(command: TiptapTableCommand): void {
    const chain = this.editor?.chain().focus();
    if (command === TiptapTableCommand.AddRowAbove) {
      chain?.addRowBefore().run();
    } else if (command === TiptapTableCommand.AddRowBelow) {
      chain?.addRowAfter().run();
    } else if (command === TiptapTableCommand.DeleteRow) {
      chain?.deleteRow().run();
    } else if (command === TiptapTableCommand.AddColumnLeft) {
      chain?.addColumnBefore().run();
    } else if (command === TiptapTableCommand.AddColumnRight) {
      chain?.addColumnAfter().run();
    } else if (command === TiptapTableCommand.DeleteColumn) {
      chain?.deleteColumn().run();
    } else if (command === TiptapTableCommand.DeleteTable) {
      chain?.deleteTable().run();
    }
  }

  moveTableColumn(direction: number): void {
    const state = this.editor?.state;
    if (!state) {
      return;
    }
    const anchor = state.selection.$anchor;
    const depths = Array.from({length: anchor.depth}, (ignored, index) => anchor.depth - index);
    const cellDepth = depths.find(depth => ["tableCell", "tableHeader"].includes(anchor.node(depth).type.name));
    const tableDepth = depths.find(depth => anchor.node(depth).type.name === "table");
    if (!cellDepth || !tableDepth) {
      return;
    }
    const columnIndex = anchor.index(cellDepth - 1);
    const table = anchor.node(tableDepth);
    const targetIndex = columnIndex + direction;
    if (targetIndex < 0 || targetIndex >= table.child(0).childCount) {
      return;
    }
    const json: any = table.toJSON();
    json.content.forEach((row: any) => {
      const moved = row.content.splice(columnIndex, 1)[0];
      row.content.splice(targetIndex, 0, moved);
    });
    const from = anchor.before(tableDepth);
    this.editor?.chain().focus().insertContentAt({from, to: from + table.nodeSize}, json).run();
  }

  insertPageBreak(): void {
    this.editor?.chain().focus().insertContent({type: PAGE_BREAK_NODE_NAME}).run();
  }

  insertImage(): void {
    this.cropperPreloadSrc = null;
    this.replaceSelectedImageOnSave = false;
    this.linkBarOpen = false;
    this.imageCropperOpen = true;
  }

  openLinkBar(): void {
    if (!this.editor) return;
    this.linkUrl = (this.editor.getAttributes("link")["href"] as string) ?? "";
    this.imageCropperOpen = false;
    this.linkBarOpen = true;
  }

  cancelLinkBar(): void {
    this.linkBarOpen = false;
    this.linkUrl = "";
  }

  confirmLink(): void {
    if (!this.editor) return;
    const url = (this.linkUrl ?? "").trim();
    if (!url) {
      this.removeLink();
      return;
    }
    this.editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    this.linkBarOpen = false;
    this.linkUrl = "";
  }

  removeLink(): void {
    this.editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    this.linkBarOpen = false;
    this.linkUrl = "";
  }

  openLinkTokenInsert(): void {
    if (!this.editor) {
      return;
    }
    this.editor.chain().focus().setTextSelection(this.editor.state.selection.to).run();
    this.linkTokenOriginalLabel = "";
    this.linkTextDisplay = "";
    this.linkHrefValue = LINK_DESTINATIONS[0].token;
    this.tokenFieldValue = this.allMergeFields[0].token;
    this.tokenPopupType = TokenPopupType.Link;
    this.linkBarOpen = false;
    this.imageCropperOpen = false;
    this.insertLinkMode = true;
    this.positionTokenEditor();
  }

  setTokenType(type: TokenPopupType): void {
    this.tokenPopupType = type;
    if (type === TokenPopupType.Field && !this.tokenFieldValue) {
      this.tokenFieldValue = this.allMergeFields[0].token;
    }
    if (type === TokenPopupType.Link && !this.linkHrefValue) {
      this.linkHrefValue = LINK_DESTINATIONS[0].token;
    }
  }

  private displayDestination(href: string): string {
    return (href || "").startsWith("{{") ? friendlyFieldLabel(href) : (href || "");
  }

  private resolveLinkText(): string {
    const display = (this.linkTextDisplay ?? "").trim();
    if (this.linkTokenOriginalLabel && display === friendlyText(this.linkTokenOriginalLabel).trim()) {
      return this.linkTokenOriginalLabel;
    }
    const matched = this.allMergeFields.find(field => field.label === display);
    return matched ? matched.token : display;
  }

  applyToken(): void {
    if (!this.editor) {
      return;
    }
    if (this.tokenPopupType === TokenPopupType.Field) {
      const raw = this.tokenFieldValue;
      if (raw) {
        const token = raw.replace(/^\{\{\s*|\s*\}\}$/g, "");
        this.editor.chain().focus().insertContent({type: MERGE_FIELD_NODE_NAME, attrs: {token}}).run();
      }
    } else {
      const label = this.resolveLinkText();
      const href = (this.linkHrefValue || "").trim();
      if (label && href) {
        if (href.startsWith("{{")) {
          this.editor.chain().focus().insertContent({type: LINK_TOKEN_NODE_NAME, attrs: {label, href}}).run();
        } else {
          this.editor.chain().focus().insertContent({type: "text", text: label, marks: [{type: "link", attrs: {href}}]}).run();
        }
      }
    }
    this.closeTokenEditor();
  }

  private positionTokenEditor(): void {
    if (!this.editor) {
      return;
    }
    const shell = this.editor.view.dom.closest(".tiptap-editor-shell") as HTMLElement;
    if (!shell) {
      return;
    }
    const rect = shell.getBoundingClientRect();
    const fieldNode = this.editor.view.nodeDOM(this.editor.state.selection.from) as HTMLElement;
    if (this.imageSelected && fieldNode?.getBoundingClientRect) {
      const imageRect = fieldNode.getBoundingClientRect();
      this.tokenEditorAbove = true;
      this.tokenEditorMinWidth = 0;
      this.tokenEditorTop = imageRect.top - rect.top - 6;
      this.tokenEditorLeft = Math.max(4, imageRect.left - rect.left);
      return;
    }
    const coords = this.editor.view.coordsAtPos(this.editor.state.selection.from);
    const fieldWidth = fieldNode?.getBoundingClientRect ? fieldNode.getBoundingClientRect().width : 0;
    this.tokenEditorAbove = false;
    this.tokenEditorMinWidth = Math.min(Math.max(280, fieldWidth), shell.clientWidth - 8);
    this.tokenEditorTop = coords.bottom - rect.top + 4;
    this.tokenEditorLeft = Math.max(4, Math.min(coords.left - rect.left, shell.clientWidth - this.tokenEditorMinWidth - 4));
  }

  closeTokenEditor(): void {
    this.insertLinkMode = false;
    this.linkTokenOriginalLabel = "";
    this.linkTextDisplay = "";
    this.linkHrefValue = "";
    if (this.editor) {
      this.editor.chain().focus().setTextSelection(this.editor.state.selection.to).run();
    }
  }

  setNormalText(): void {
    this.editor?.chain().focus().setParagraph().run();
  }

  onImageActionEdit(): void {
    if (!this.editor) return;
    if (this.imageSelected) {
      this.cropperPreloadSrc = (this.editor.getAttributes("image")["src"] as string) ?? null;
      this.replaceSelectedImageOnSave = true;
    } else {
      this.cropperPreloadSrc = null;
      this.replaceSelectedImageOnSave = false;
    }
    this.linkBarOpen = false;
    this.imageCropperOpen = true;
  }

  onImageActionReplace(): void {
    if (!this.editor || !this.imageSelected) return;
    this.cropperPreloadSrc = null;
    this.replaceSelectedImageOnSave = true;
    this.linkBarOpen = false;
    this.imageCropperOpen = true;
  }

  onImageActionRemove(): void {
    if (!this.editor || !this.imageSelected) return;
    this.editor.chain().focus().deleteSelection().run();
    this.imageSelected = false;
  }

  setImageSpacing(level: ImageSpacing): void {
    if (!this.editor || !this.imageSelected) return;
    this.imageSpacing = level;
    this.editor.chain().focus().updateAttributes("image", { spacing: level }).run();
  }

  setImageAlign(align: ImageAlign): void {
    if (!this.editor || !this.imageSelected) return;
    this.imageAlign = align;
    this.editor.chain().focus().updateAttributes("image", { align }).run();
    this.positionImageHandle();
  }

  private positionImageHandle(): void {
    if (!this.editor || !this.imageSelected) {
      return;
    }
    const shell = this.editor.view.dom.closest(".tiptap-editor-shell") as HTMLElement;
    const img = this.editor.view.nodeDOM(this.editor.state.selection.from) as HTMLElement;
    if (!shell || !img?.getBoundingClientRect) {
      return;
    }
    const shellRect = shell.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    this.imageHandleTop = imageRect.top - shellRect.top + (imageRect.height / 2) - 17;
    this.imageHandleLeft = imageRect.right - shellRect.left - 5;
  }

  onImageResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.editor) {
      return;
    }
    const pos = this.editor.state.selection.from;
    const img = this.editor.view.nodeDOM(pos) as HTMLImageElement;
    if (!img?.getBoundingClientRect) {
      return;
    }
    this.imageResizeState = { startX: event.clientX, startWidth: img.getBoundingClientRect().width, pos, img };
    document.addEventListener("mousemove", this.onImageResizeMove);
    document.addEventListener("mouseup", this.onImageResizeEnd);
  }

  private onImageResizeMove = (event: MouseEvent): void => {
    if (!this.imageResizeState || !this.editor) {
      return;
    }
    const editable = this.editor.view.dom as HTMLElement;
    const maxWidth = editable?.clientWidth ? editable.clientWidth : 540;
    const delta = event.clientX - this.imageResizeState.startX;
    const width = Math.max(60, Math.min(Math.round(this.imageResizeState.startWidth + delta), maxWidth));
    this.imageResizeState.img.style.width = `${width}px`;
    this.imageResizeState.img.style.maxHeight = "none";
    this.positionImageHandle();
  };

  private onImageResizeEnd = (): void => {
    document.removeEventListener("mousemove", this.onImageResizeMove);
    document.removeEventListener("mouseup", this.onImageResizeEnd);
    if (!this.imageResizeState || !this.editor) {
      this.imageResizeState = null;
      return;
    }
    const width = Math.round(this.imageResizeState.img.getBoundingClientRect().width);
    const pos = this.imageResizeState.pos;
    this.imageResizeState = null;
    const node = this.editor.state.doc.nodeAt(pos);
    if (node) {
      this.editor.view.dispatch(this.editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width }));
      this.positionImageHandle();
    }
  };

  cancelImageCropper(): void {
    this.imageCropperOpen = false;
    this.cropperPreloadSrc = null;
    this.replaceSelectedImageOnSave = false;
  }

  onImageCropperSave(awsFileData: AwsFileData): void {
    if (!this.editor) return;
    const relative = this.urlService.resourceRelativePathForAWSFileName(awsFileData.awsFileName);
    const src = `${this.urlService.publicBaseUrl().replace(/\/$/, "")}/${relative}`;
    if (this.replaceSelectedImageOnSave && this.imageSelected) {
      this.editor.chain().focus().updateAttributes("image", { src }).run();
    } else {
      this.editor.chain().focus().setImage({ src, alt: "" }).run();
    }
    this.imageCropperOpen = false;
    this.cropperPreloadSrc = null;
    this.replaceSelectedImageOnSave = false;
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  clearFormatting(): void {
    this.editor?.chain().focus().clearNodes().unsetAllMarks().run();
  }

  undo(): void {
    this.editor?.chain().focus().undo().run();
  }

  redo(): void {
    this.editor?.chain().focus().redo().run();
  }

  onMergeFieldInsert(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const raw = target.value;
    if (raw && this.editor) {
      const token = raw.replace(/^\{\{\s*|\s*\}\}$/g, "");
      this.editor.chain().focus().setTextSelection(this.editor.state.selection.to).insertContent({ type: MERGE_FIELD_NODE_NAME, attrs: { token } }).run();
    }
    target.value = "";
  }

}
