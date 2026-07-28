import {
  booleanAttribute,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation
} from "@angular/core";
import { NgClass } from "@angular/common";
import { Editor, JSONContent } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { redoDepth, undoDepth } from "@tiptap/pm/history";
import StarterKit from "@tiptap/starter-kit";
import { ListItem } from "@tiptap/extension-list";
import { HtmlBold, HtmlItalic, markdownMarksForClipboard } from "./html-marks.extension";
import Link from "@tiptap/extension-link";
import { ImageAlign, ImageSpacing, SpacedImage } from "./spaced-image.extension";
import { Markdown } from "@tiptap/markdown";
import { MermaidCodeBlock, refreshMermaidCodeBlockPreviews } from "./mermaid-code-block.extension";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TiptapEditorDirective } from "ngx-tiptap";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faBold,
  faBolt,
  faCode,
  faEnvelope,
  faHeading,
  faImage,
  faItalic,
  faLink,
  faListOl,
  faListUl,
  faQuoteRight,
  faRedo,
  faRemoveFormat,
  faToggleOn,
  faToggleOff,
  faUndo
} from "@fortawesome/free-solid-svg-icons";
import { Subscription } from "rxjs";
import { BuiltInRole, CommitteeMember, CONTACT_US_TYPE, RoleType } from "../../../models/committee.model";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { MemberNamingService } from "../../../services/member/member-naming.service";
import {
  buildContactUsHref,
  contactUsRoleOptionLabel,
  defaultContactUsLabel,
  isContactUsHref,
  parseContactUsHref
} from "./contact-us-link";
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
import { AwsFileData, AwsFileUploadResponse } from "../../../models/aws-object.model";
import { RootFolder } from "../../../models/system.model";
import { S3_BASE_URL } from "../../../models/content-metadata.model";
import { UrlService } from "../../../services/url.service";
import { FileUtilsService } from "../../../file-utils.service";
import { hasSoftWrappedParagraph, unwrapSoftLineBreaks } from "../../../functions/unwrap-line-breaks";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PasteDetectionService } from "../../../services/paste-detection.service";
import { NgxLoggerLevel } from "ngx-logger";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { NgSelectComponent, NgOptionTemplateDirective } from "@ng-select/ng-select";
import { isString } from "es-toolkit/compat";

@Component({
  selector: "app-tiptap-markdown-editor",
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass, TiptapEditorDirective, FontAwesomeModule, ImageCropperAndResizerComponent, FormsModule, NgSelectComponent, NgOptionTemplateDirective, TooltipDirective],
  styles: [`
    .tiptap-editor-shell
      border: 1px solid transparent
      border-radius: 4px
      background-color: transparent
      display: flex
      flex-direction: column
      max-width: 100%
      min-width: 0
      position: relative
      transition: border-color 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease

    .tiptap-editor-shell.tiptap-editor-shell-detail
      border-style: solid
      border-color: #ced4da
      background-color: #ffffff

    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled):not(.tiptap-editor-shell-detail)
      cursor: pointer

    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled):not(.tiptap-editor-shell-detail):hover
      border-style: dashed
      border-color: #adb5bd
      background-color: rgba(248, 249, 250, 0.7)
      box-shadow: inset 0 0 0 1px rgba(173, 181, 189, 0.15)

    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled):not(.tiptap-editor-shell-detail) .tiptap-content .ProseMirror,
    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled):not(.tiptap-editor-shell-detail) .tiptap-content a,
    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled):not(.tiptap-editor-shell-detail) .tiptap-content .as-button a,
    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled):not(.tiptap-editor-shell-detail) .tiptap-content.as-button a
      cursor: pointer

    .tiptap-editor-shell:not(.tiptap-editor-shell-detail) .tiptap-content
      padding: 0

    .tiptap-editor-shell-disabled
      border-color: transparent
      background-color: transparent
      box-shadow: none
      cursor: default

    .tiptap-editor-shell-disabled .tiptap-content
      background-color: transparent
      color: inherit

    .tiptap-editor-shell-disabled .tiptap-content .ProseMirror
      cursor: not-allowed

    .tiptap-editor-shell.tiptap-editor-shell-detail:not(.tiptap-editor-shell-disabled) .tiptap-content .ProseMirror
      cursor: text

    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled).tiptap-editor-shell-detail .tiptap-content a
      cursor: text
      pointer-events: auto

    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled).tiptap-editor-shell-detail .tiptap-content .as-button a,
    .tiptap-editor-shell:not(.tiptap-editor-shell-disabled).tiptap-editor-shell-detail .tiptap-content.as-button a
      cursor: text
      box-shadow: inset 0 0 0 1px rgba(64, 65, 65, 0.15)

    .tiptap-click-to-edit-hint
      position: fixed
      z-index: 1080
      pointer-events: none
      padding: 4px 8px
      border-radius: 4px
      background-color: #212529
      color: #ffffff
      font-size: 0.75rem
      line-height: 1.2
      white-space: nowrap
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22)
      transform: translate(12px, 14px)

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

    .tiptap-toolbar.tiptap-toolbar-sticky
      position: sticky
      top: var(--tiptap-toolbar-offset, 0)
      z-index: 20
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

    .tiptap-toolbar button:disabled
      opacity: 0.4
      cursor: not-allowed
      color: #adb5bd

    .tiptap-toolbar button:disabled:hover
      border-color: transparent
      background: transparent

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

    .tiptap-toolbar .toolbar-extras
      display: contents

    .table-picker-wrap
      position: relative
      display: inline-flex

    .table-picker-popup
      position: absolute
      top: calc(100% + 4px)
      left: 0
      z-index: 40
      background: #ffffff
      border: 1px solid #ced4da
      border-radius: 8px
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18)
      padding: 10px
      min-width: 168px
      user-select: none

    .table-picker-label
      font-size: 0.78rem
      font-weight: 600
      color: #495057
      margin-bottom: 8px
      text-align: center

    .table-picker-grid
      display: grid
      grid-template-columns: repeat(10, 14px)
      gap: 3px
      justify-content: center

    .table-picker-cell
      width: 14px
      height: 14px
      border: 1px solid #ced4da
      border-radius: 2px
      background: #ffffff
      box-sizing: border-box

    .table-picker-cell.is-selected
      background: rgba(192, 87, 17, 0.18)
      border-color: #c05711

    .table-picker-hint
      margin-top: 8px
      font-size: 0.72rem
      color: #6c757d
      text-align: center

    .tiptap-content
      padding: 8px 12px
      min-height: 0
      overflow-x: clip

    .tiptap-code-block
      margin: 0.75rem 0

    .tiptap-code-block-mermaid
      border: 1px solid #e9ecef
      border-radius: 6px
      padding: 10px
      background-color: #fafbfc

    .tiptap-mermaid-preview
      overflow-x: auto
      text-align: center
      margin-bottom: 6px

    .tiptap-mermaid-preview svg
      max-width: 100%
      height: auto

    .tiptap-mermaid-preview-error
      color: #842029
      background-color: #f8d7da
      border-radius: 4px
      padding: 8px 10px
      text-align: left
      font-size: 0.9rem

    .tiptap-mermaid-source-toggle
      display: inline-flex
      align-items: center
      margin: 0 0 6px
      padding: 2px 8px
      min-height: 28px
      border: 1px solid #ced4da
      border-radius: 4px
      background: #ffffff
      color: #495057
      font-size: 0.8rem
      cursor: pointer

    .tiptap-mermaid-source-toggle:hover
      border-color: #adb5bd
      background: #f8f9fa

    .tiptap-code-block pre
      margin: 0
      padding: 8px 10px
      border-radius: 4px
      background-color: #f1f3f5
      overflow-x: auto

    .tiptap-code-block code
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace
      font-size: 0.85rem
      white-space: pre

    .tiptap-code-block-mermaid:not(.tiptap-code-block-mermaid-source-open) > pre
      display: none

    .tiptap-code-block-mermaid.tiptap-code-block-mermaid-source-open > pre
      display: block

    .tiptap-content.email-width
      max-width: 600px
      margin: 0 auto
      padding: 30px
      box-sizing: border-box
      min-height: 180px

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

    .tiptap-content .ProseMirror code
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace
      font-size: 0.9em
      color: #c7254e
      background-color: #f7f2f4
      border-radius: 3px
      padding: 0.1em 0.35em

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

    .tiptap-content blockquote
      border-left: 4px solid #a8d08d
      margin: 0.75rem 0
      padding: 0.6rem 1rem
      background-color: rgba(168, 208, 141, 0.12)
      color: #444
      font-style: italic

    .tiptap-content blockquote p
      margin-bottom: 0

    .tiptap-content blockquote p + p
      margin-top: 0.5rem

    .tiptap-content .ProseMirror
      min-height: 2.5rem
      outline: none

    .tiptap-content.email-width .ProseMirror
      min-height: 160px

    .tiptap-content .ProseMirror ul
      list-style: revert
      padding-left: revert
      margin: revert

    .tiptap-content.list-arrow .ProseMirror ul,
    .tiptap-content.list-tick-large .ProseMirror ul,
    .tiptap-content.list-tick-medium .ProseMirror ul,
    .tiptap-content.list-default .ProseMirror ul
      list-style: none
      padding: 0
      margin: 0

    .tiptap-content.list-arrow .ProseMirror ul li,
    .tiptap-content.list-tick-large .ProseMirror ul li,
    .tiptap-content.list-tick-medium .ProseMirror ul li
      list-style: none

    .tiptap-content.background-panel
      border-radius: 6px

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

    .link-url-bar
      display: flex
      flex-direction: column
      align-items: stretch
      gap: 8px
      padding: 8px 10px
      border-bottom: 1px solid #e9ecef
      background-color: #ffffff

    .link-url-label
      margin: 0
      font-size: 0.75rem
      font-weight: 600
      color: #495057

    .link-url-input
      width: 100%
      min-width: 0

    .link-url-actions
      display: flex
      flex-wrap: wrap
      gap: 6px

    .link-url-hint
      font-size: 0.78rem
      color: #6c757d
      margin: 0

    .contact-button-bar
      display: flex
      flex-direction: column
      align-items: stretch
      gap: 8px
      padding: 8px 10px
      border-bottom: 1px solid #e9ecef
      background-color: #ffffff

    .contact-button-bar .link-url-label
      margin: 0
      font-size: 0.75rem
      font-weight: 600
      color: #495057

    .contact-button-bar .form-select,
    .contact-button-bar .form-control
      width: 100%
      min-width: 0

    .contact-button-preview
      font-size: 0.78rem
      color: #6c757d
      word-break: break-all

    .contact-button-actions
      display: flex
      flex-wrap: wrap
      gap: 6px
  `],
  template: `
    <div class="tiptap-editor-shell"
         [class.tiptap-editor-shell-disabled]="!editable"
         [class.tiptap-editor-shell-detail]="editable && toolbarExpanded"
         [attr.aria-disabled]="!editable"
         (pointerenter)="onCalmPointerEnter($event)"
         (pointermove)="onCalmPointerMove($event)"
         (pointerleave)="onCalmPointerLeave()">
      @if (clickToEditHintVisible) {
        <div class="tiptap-click-to-edit-hint"
             [style.left.px]="clickToEditHintX"
             [style.top.px]="clickToEditHintY">Click to edit</div>
      }
      @if (editable && toolbarExpanded) {
      <div class="tiptap-toolbar" [class.tiptap-toolbar-sticky]="stickyToolbar"
           role="toolbar" (mousedown)="onToolbarMousedown($event)">
        <button type="button" tooltip="Bold" container="body" delay=500 (click)="toggle(TiptapMark.Bold)" [class.is-active]="isActive('bold')">
          <fa-icon [icon]="faBold"/>
        </button>
        <button type="button" tooltip="Italic" container="body" delay=500 (click)="toggle(TiptapMark.Italic)" [class.is-active]="isActive('italic')">
          <fa-icon [icon]="faItalic"/>
        </button>
        <button type="button" tooltip="Inline code" container="body" delay=500
                (click)="toggle(TiptapMark.Code)" [class.is-active]="isActive('code')">
          <fa-icon [icon]="faCode"/>
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
        <button type="button" tooltip="Contact button — pick a committee role" container="body" delay=500
                [class.is-active]="contactBarOpen"
                (click)="openContactButtonBar()">
          <fa-icon [icon]="faEnvelope"/>
        </button>
        <button type="button" tooltip="Insert a link" container="body" delay=500 (click)="openLinkTokenInsert()">
          <fa-icon [icon]="faBolt"/>
        </button>
        <button type="button" tooltip="Insert image" container="body" delay=500 (click)="insertImage()">
          <fa-icon [icon]="faImage"/>
        </button>
        <div class="table-picker-wrap">
          <button type="button" class="toolbar-text-toggle" [class.is-active]="tablePickerOpen"
                  tooltip="Insert a table — press and drag across the grid to choose size" container="body" delay=500
                  (pointerdown)="onTableButtonPointerDown($event)"
                  (click)="$event.preventDefault(); $event.stopPropagation()">
            Table
          </button>
          @if (tablePickerOpen) {
            <div class="table-picker-popup">
              <div class="table-picker-label">{{ tablePickerLabel() }}</div>
              <div class="table-picker-grid">
                @for (row of tablePickerRows; track row) {
                  @for (col of tablePickerCols; track col) {
                    <div class="table-picker-cell"
                         [class.is-selected]="tablePickerHasSelection && row <= tablePickerHoverRows && col <= tablePickerHoverCols"
                         [attr.data-table-row]="row"
                         [attr.data-table-col]="col"
                         [attr.aria-label]="col + ' by ' + row + ' table'">
                    </div>
                  }
                }
              </div>
              <div class="table-picker-hint">Hold and drag, then release</div>
            </div>
          }
        </div>
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
        <button type="button" class="toolbar-text-toggle" [class.is-active]="unwrapLineBreaksOnPaste"
                [tooltip]="(unwrapLineBreaksOnPaste ? 'On' : 'Off') + ': when on, line breaks within paragraphs of pasted text are unwrapped so body text flows as one paragraph; headings, lists, blank lines and code blocks are kept as they are. Click to turn ' + (unwrapLineBreaksOnPaste ? 'off' : 'on') + '.'"
                container="body" delay=500
                (click)="unwrapLineBreaksOnPaste = !unwrapLineBreaksOnPaste">
          <fa-icon [icon]="unwrapLineBreaksOnPaste ? faToggleOn : faToggleOff" [class.text-success]="unwrapLineBreaksOnPaste" class="me-1"/>
          Unwrap on paste
        </button>
        <ng-content select="[toolbarExtras]"/>
        <span class="toolbar-divider"></span>
        <button type="button" [tooltip]="undoTooltip" container="body" delay=500
                [disabled]="!canUndo" (click)="undo()">
          <fa-icon [icon]="faUndo"/>
        </button>
        <button type="button" [tooltip]="redoTooltip" container="body" delay=500
                [disabled]="!canRedo" (click)="redo()">
          <fa-icon [icon]="faRedo"/>
        </button>
      </div>
      }
      @if (linkBarOpen) {
        <div class="link-url-bar">
          <label class="link-url-label" for="tiptap-link-url">Link URL</label>
          <input #linkUrlInput
                 id="tiptap-link-url"
                 type="text"
                 class="form-control form-control-sm link-url-input"
                 name="tiptap-link-url"
                 [(ngModel)]="linkUrl"
                 placeholder="https://…  /walks/…  or ?contact-us&role=…&redirect=…"
                 (keyup.enter)="confirmLink()">
          @if (linkHrefMissing) {
            <div class="link-url-hint">This link has no URL stored. Enter a path or address, then Apply.</div>
          }
          <div class="link-url-actions">
            <button type="button" class="btn btn-sm btn-primary" (click)="confirmLink()">Apply</button>
            <button type="button" class="btn btn-sm btn-secondary" (click)="cancelLinkBar()">Cancel</button>
            @if (isActive("link")) {
              <button type="button" class="btn btn-sm btn-secondary" (click)="removeLink()">Remove link</button>
            }
          </div>
        </div>
      }
      @if (contactBarOpen) {
        <div class="contact-button-bar">
          <label class="link-url-label" for="tiptap-contact-role">Committee role</label>
          <select id="tiptap-contact-role"
                  class="form-select form-select-sm"
                  name="tiptap-contact-role"
                  [(ngModel)]="contactRoleType"
                  (ngModelChange)="onContactRoleChange($event)">
            <option value="">Select role…</option>
            @for (member of contactRoles; track member.type) {
              <option [value]="member.type">{{ contactRoleLabel(member) }}</option>
            }
          </select>
          <label class="link-url-label" for="tiptap-contact-label">Link name</label>
          <input id="tiptap-contact-label"
                 type="text"
                 class="form-control form-control-sm"
                 name="tiptap-contact-label"
                 [(ngModel)]="contactLabel"
                 placeholder="Contact Nick"
                 (keyup.enter)="applyContactButton()">
          <div class="contact-button-preview">
            Redirects back to <strong>{{ contactRedirectPath || "this page" }}</strong>
            @if (contactRoleType && contactLabel) {
              <div class="mt-1"><code>{{ contactHrefPreview() }}</code></div>
            }
          </div>
          <div class="contact-button-actions">
            <button type="button" class="btn btn-sm btn-primary"
                    [disabled]="!contactRoleType || !contactLabel.trim()"
                    (click)="applyContactButton()">
              {{ contactUpdatingExisting ? "Update button" : "Insert button" }}
            </button>
            <button type="button" class="btn btn-sm btn-secondary" (click)="cancelContactButtonBar()">Cancel</button>
          </div>
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
      @if (pastedImageUploading) {
        <div class="inline-input-bar" style="display:block">
          <span class="token-editor-title">Uploading pasted image…</span>
        </div>
      }
      <div class="tiptap-content"
           [class.show-examples]="showExampleValues"
           [class.email-width]="constrainToEmailWidth && !editable"
           [ngClass]="contentClass">
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
        this.clearEditorHistory();
        this.queueMermaidPreviewRefresh();
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
  @Input() undoTooltip: string = "Undo";
  @Input() redoTooltip: string = "Redo";
  @Input() contentClass: string | string[] | Set<string> | {[klass: string]: unknown} = "";
  @Input() showMergeFields: boolean = false;
  @Input({transform: booleanAttribute}) showPageBreak = false;
  @Input() constrainToEmailWidth: boolean = false;
  @Input({transform: booleanAttribute}) stickyToolbar = true;
  private _editable = true;
  @Input() set editable(value: boolean) {
    this._editable = value !== false;
    this.editor?.setEditable(this._editable);
  }
  get editable(): boolean {
    return this._editable;
  }
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
  @Output() rawPaste = new EventEmitter<{ text: string; html?: string; consume: () => void }>();
  @Output() contactButtonApplied = new EventEmitter<void>();

  protected editor: Editor | null = null;
  private pendingValue: string = "";
  private urlService = inject(UrlService);
  private committeeConfigService = inject(CommitteeConfigService);
  private memberNamingService = inject(MemberNamingService);
  private committeeSubscription: Subscription | null = null;
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
  protected canUndo = false;
  protected canRedo = false;
  protected tablePickerOpen = false;
  protected tablePickerHasSelection = false;
  protected tablePickerHoverRows = 1;
  protected tablePickerHoverCols = 1;
  protected readonly tablePickerMax = 10;
  protected readonly tablePickerRows: number[] = Array.from({length: 10}, (_, index) => index + 1);
  protected readonly tablePickerCols: number[] = Array.from({length: 10}, (_, index) => index + 1);
  private tablePickerDragging = false;
  private readonly onTablePickerPointerMove = (event: PointerEvent) => this.updateTablePickerFromPointer(event);
  private readonly onTablePickerPointerUp = (event: PointerEvent) => this.finishTablePickerDrag(event);
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
  protected linkHrefMissing = false;
  protected contactBarOpen = false;
  protected contactRoles: CommitteeMember[] = [];
  protected contactRoleType = "";
  protected contactLabel = "";
  protected contactRedirectPath = "";
  protected contactUpdatingExisting = false;
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
  protected pastedImageUploading = false;
  protected unwrapLineBreaksOnPaste = true;
  private http = inject(HttpClient);
  private fileUtilsService = inject(FileUtilsService);

  private logger: Logger = inject(LoggerFactory).createLogger("TiptapMarkdownEditor", NgxLoggerLevel.ERROR);
  private changeDetector = inject(ChangeDetectorRef);
  private pasteDetectionService = inject(PasteDetectionService);
  private host = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);
  private readonly onDocumentPointerDown = (event: PointerEvent) => this.handleDocumentPointerDown(event);

  protected readonly TiptapMark = TiptapMark;
  protected readonly TiptapTableCommand = TiptapTableCommand;
  protected readonly faBold = faBold;
  protected readonly faBolt = faBolt;
  protected readonly faCode = faCode;
  protected readonly faImage = faImage;
  protected readonly faItalic = faItalic;
  protected readonly faLink = faLink;
  protected readonly faEnvelope = faEnvelope;
  protected readonly faListOl = faListOl;
  protected readonly faListUl = faListUl;
  protected readonly faQuoteRight = faQuoteRight;
  protected readonly faUndo = faUndo;
  protected readonly faRedo = faRedo;
  protected readonly faHeading = faHeading;
  protected readonly faRemoveFormat = faRemoveFormat;
  protected readonly faToggleOn = faToggleOn;
  protected readonly faToggleOff = faToggleOff;
  protected toolbarExpanded = false;
  protected clickToEditHintVisible = false;
  protected clickToEditHintX = 0;
  protected clickToEditHintY = 0;
  private clickToEditHintTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.committeeSubscription = this.committeeConfigService.committeeReferenceDataEvents().subscribe(data => {
      this.contactRoles = (data?.committeeMembers() || []).filter(member => this.contactButtonRoleAllowed(member));
      this.changeDetector.markForCheck();
    });
    const extensions: any[] = [
      StarterKit.configure({ bold: false, italic: false, listItem: false, link: false, codeBlock: false }),
      MermaidCodeBlock,
      ListItem.extend({
        content: "block+"
      }),
      HtmlBold,
      HtmlItalic,
      Link.configure({
        openOnClick: false,
        enableClickSelection: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
        isAllowedUri: (url, ctx) => this.linkHrefAllowed(url, ctx)
      }),
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
        clipboardTextSerializer: content => markdownMarksForClipboard(this.editor?.markdown?.serialize({
          type: "doc",
          content: content.content.toJSON()
        }) ?? ""),
        handleDOMEvents: {
          click: (view, event) => this.handleEditableLinkClick(view, event),
          auxclick: (view, event) => this.handleEditableLinkClick(view, event)
        },
        handleKeyDown: (_view, event) => this.handleEditorKeyDown(event),
        handlePaste: (_view, event) => {
          const pastedImage = Array.from(event.clipboardData?.files ?? []).find(file => file.type.startsWith("image/"));
          const pastedHtml = event.clipboardData?.getData("text/html") ?? "";
          const internalPaste = this.isInternalPaste(pastedHtml);
          const text = event.clipboardData?.getData("text/plain") ?? "";
          const consumed = {value: false};
          let handled = false;
          if (pastedImage) {
            event.preventDefault();
            void this.uploadAndInsertPastedImage(pastedImage);
            handled = true;
          } else if (text || pastedHtml) {
            this.rawPaste.emit({
              text,
              html: pastedHtml || undefined,
              consume: () => {
                consumed.value = true;
              }
            });
            if (consumed.value) {
              event.preventDefault();
              handled = true;
            } else if (!internalPaste && text && this.looksLikeMarkdown(text)) {
              event.preventDefault();
              const sanitised = this.unwrapIfEnabled(this.sanitiseMarkdownForPaste(text));
              try {
                this.editor?.commands.insertContent(sanitised, {contentType: "markdown"});
              } catch (error) {
                this.logger.error("markdown paste failed, falling back to plain text:", error);
                this.editor?.commands.insertContent(sanitised);
              }
              handled = true;
            } else if (!internalPaste && text && this.unwrapLineBreaksOnPaste && hasSoftWrappedParagraph(text)) {
              event.preventDefault();
              const html = unwrapSoftLineBreaks(text)
                .split(/\n{2,}/)
                .map(block => `<p>${block.replace(/\n/g, "<br>")}</p>`)
                .join("");
              this.editor?.commands.insertContent(html);
              handled = true;
            }
          }
          return handled;
        },
        transformPastedHTML: (html: string) => this.isInternalPaste(html) ? html : this.sanitiseHtmlForPaste(html)
      },
      content: this.pendingValue,
      contentType: "markdown",
      onCreate: () => {
        this.clearEditorHistory();
        this.queueMermaidPreviewRefresh();
        if (this.pendingFocusPosition) {
          const position = this.pendingFocusPosition;
          this.pendingFocusPosition = null;
          this.attemptFocus(position, 0);
        }
      }
    });
    this.clearEditorHistory();
    this.queueMermaidPreviewRefresh();
    this.editor.on("focus", () => {
      this.zone.run(() => this.enterDetailMode());
    });
    this.editor.on("blur", () => {
      this.zone.run(() => {
        requestAnimationFrame(() => {
          if (!this.editor?.isFocused && !this.hostContainsActiveElement()) {
            this.exitDetailMode();
            this.queueMermaidPreviewRefresh();
          }
        });
      });
    });
    this.zone.runOutsideAngular(() => {
      document.addEventListener("pointerdown", this.onDocumentPointerDown, true);
    });
    this.editor.on("transaction", () => {
      this.refreshHistoryState();
    });
    this.editor.on("update", () => {
      const markdown = this.currentMarkdown();
      this.valueChange.emit(markdown);
      this.refreshHistoryState();
    });
    this.editor.on("selectionUpdate", () => {
      this.refreshHistoryState();
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

  public unwrapIfEnabled(text: string): string {
    return this.unwrapLineBreaksOnPaste ? unwrapSoftLineBreaks(text) : text;
  }

  private looksLikeMarkdown(text: string): boolean {
    return this.pasteDetectionService.looksLikeMarkdown(text);
  }

  ngOnDestroy(): void {
    document.removeEventListener("pointerdown", this.onDocumentPointerDown, true);
    document.removeEventListener("mousemove", this.onImageResizeMove);
    document.removeEventListener("mouseup", this.onImageResizeEnd);
    this.detachTablePickerDragListeners();
    this.hideClickToEditHint();
    this.committeeSubscription?.unsubscribe();
    this.committeeSubscription = null;
    if (this.mermaidPreviewTimer) {
      clearTimeout(this.mermaidPreviewTimer);
      this.mermaidPreviewTimer = null;
    }
    this.editor?.destroy();
    this.editor = null;
  }

  protected onCalmPointerEnter(event: PointerEvent): void {
    if (this.calmHintActive()) {
      this.scheduleClickToEditHint(event);
    }
  }

  protected onCalmPointerMove(event: PointerEvent): void {
    if (!this.calmHintActive()) {
      this.hideClickToEditHint();
    } else {
      this.clickToEditHintX = event.clientX;
      this.clickToEditHintY = event.clientY;
      if (!this.clickToEditHintVisible && !this.clickToEditHintTimer) {
        this.scheduleClickToEditHint(event);
      }
    }
  }

  protected onCalmPointerLeave(): void {
    this.hideClickToEditHint();
  }

  private calmHintActive(): boolean {
    return this.editable && !this.toolbarExpanded;
  }

  private scheduleClickToEditHint(event: PointerEvent): void {
    this.clearClickToEditHintTimer();
    this.clickToEditHintX = event.clientX;
    this.clickToEditHintY = event.clientY;
    this.clickToEditHintTimer = setTimeout(() => {
      this.clickToEditHintTimer = null;
      if (this.calmHintActive()) {
        this.clickToEditHintVisible = true;
        this.changeDetector.markForCheck();
      }
    }, 650);
  }

  private hideClickToEditHint(): void {
    this.clearClickToEditHintTimer();
    if (this.clickToEditHintVisible) {
      this.clickToEditHintVisible = false;
      this.changeDetector.markForCheck();
    }
  }

  private clearClickToEditHintTimer(): void {
    if (this.clickToEditHintTimer) {
      clearTimeout(this.clickToEditHintTimer);
      this.clickToEditHintTimer = null;
    }
  }

  private enterDetailMode(): void {
    this.toolbarExpanded = true;
    this.hideClickToEditHint();
    this.changeDetector.markForCheck();
  }

  private exitDetailMode(): void {
    this.toolbarExpanded = false;
    this.linkBarOpen = false;
    this.contactBarOpen = false;
    this.tablePickerOpen = false;
    this.insertLinkMode = false;
    this.mergeFieldSelected = false;
    this.linkTokenSelected = false;
    this.imageSelected = false;
    this.changeDetector.markForCheck();
  }

  private hostContainsActiveElement(): boolean {
    const active = document.activeElement;
    return !!(active && this.host.nativeElement.contains(active));
  }

  private handleDocumentPointerDown(event: PointerEvent): void {
    const target = event.target as Node | null;
    const shouldExit = this.toolbarExpanded
      && this.editable
      && !!target
      && !this.host.nativeElement.contains(target)
      && !this.isExternalOverlayTarget(target);
    if (shouldExit) {
      this.zone.run(() => this.exitDetailMode());
    }
  }

  private isExternalOverlayTarget(target: Node): boolean {
    const element = target instanceof Element ? target : target.parentElement;
    const overlay = element?.closest(
      ".dropdown-menu, .bs-dropdown-menu, .tooltip, .popover, .modal, .modal-backdrop, ng-dropdown-panel, .cdk-overlay-container"
    );
    return !!overlay;
  }

  private mermaidPreviewTimer: ReturnType<typeof setTimeout> | null = null;

  private queueMermaidPreviewRefresh(): void {
    if (this.mermaidPreviewTimer) {
      clearTimeout(this.mermaidPreviewTimer);
    }
    this.mermaidPreviewTimer = setTimeout(() => {
      const root = this.editor?.view?.dom as HTMLElement | undefined;
      if (root?.querySelector?.(".tiptap-code-block-mermaid")) {
        refreshMermaidCodeBlockPreviews(root);
      }
    }, 200);
    setTimeout(() => {
      const root = this.editor?.view?.dom as HTMLElement | undefined;
      if (root?.querySelector?.(".tiptap-code-block-mermaid")) {
        refreshMermaidCodeBlockPreviews(root);
      }
    }, 600);
  }

  private currentMarkdown(): string {
    const markdown = this.editor?.getMarkdown?.() ?? this.editor?.getHTML() ?? "";
    return this.stripOrphanInlineMarks(markdown);
  }

  public markdown(): string {
    return this.currentMarkdown();
  }

  public splitMarkdownAtSelection(): { before: string; selected: string; after: string } {
    if (!this.editor) {
      return {before: this.pendingValue, selected: "", after: ""};
    }
    const {from, to} = this.editor.state.selection;
    const docSize = this.editor.state.doc.content.size;
    return {
      before: this.serializeMarkdownRange(0, from),
      selected: this.serializeMarkdownRange(from, to),
      after: this.serializeMarkdownRange(to, docSize)
    };
  }

  private serializeMarkdownRange(start: number, end: number): string {
    if (!this.editor || end <= start) {
      return "";
    }
    const node = this.editor.state.doc.cut(start, end);
    try {
      const content = node.toJSON() as JSONContent;
      const serialised = this.editor.markdown?.serialize(content);
      if (isString(serialised)) {
        return this.stripOrphanInlineMarks(serialised);
      }
    } catch (error) {
      this.logger.debug("serializeMarkdownRange failed, using text content:", error);
    }
    return node.textContent || "";
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
    if (this.editor) {
      if (name === TiptapMark.Bold) {
        this.toggleInlineMark("bold");
      } else if (name === TiptapMark.Italic) {
        this.toggleInlineMark("italic");
      } else if (name === TiptapMark.Code) {
        this.toggleInlineMark("code");
      } else if (name === TiptapMark.BulletList) {
        this.editor.chain().focus().toggleBulletList().run();
      } else if (name === TiptapMark.OrderedList) {
        this.editor.chain().focus().toggleOrderedList().run();
      } else if (name === TiptapMark.Blockquote) {
        this.toggleBlockquote();
      }
    }
  }

  private toggleBlockquote(): void {
    if (!this.editor) {
      return;
    }
    if (this.editor.isActive("blockquote")) {
      this.editor.chain().focus().lift("blockquote").run();
      return;
    }
    if (this.editor.can().toggleBlockquote()) {
      this.editor.chain().focus().toggleBlockquote().run();
      return;
    }
    if (this.editor.isActive("listItem")) {
      this.editor.chain().focus().liftListItem("listItem").toggleBlockquote().run();
      return;
    }
    this.editor.chain().focus().setBlockquote().run();
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

  private handleEditorKeyDown(event: KeyboardEvent): boolean {
    if (event.key !== "Tab" || !this.editor || !this.editable) {
      return false;
    }
    const inListItem = this.editor.isActive("listItem");
    if (!inListItem) {
      return false;
    }
    if (event.shiftKey) {
      this.editor.commands.liftListItem("listItem");
      return true;
    }
    this.editor.commands.sinkListItem("listItem");
    return true;
  }

  insertTable(): void {
    this.insertTableAtSize(3, 3);
  }

  onTableButtonPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.tablePickerHasSelection = false;
    this.tablePickerHoverRows = 1;
    this.tablePickerHoverCols = 1;
    this.tablePickerOpen = true;
    this.tablePickerDragging = true;
    this.attachTablePickerDragListeners();
    this.updateTablePickerFromPointer(event);
  }

  tablePickerLabel(): string {
    if (!this.tablePickerHasSelection) {
      return "Choose size";
    }
    return `${this.tablePickerHoverCols} × ${this.tablePickerHoverRows}`;
  }

  insertTableAtSize(rows: number, cols: number): void {
    const safeRows = Math.min(Math.max(rows, 1), this.tablePickerMax);
    const safeCols = Math.min(Math.max(cols, 1), this.tablePickerMax);
    this.editor?.chain().focus().insertTable({
      rows: safeRows,
      cols: safeCols,
      withHeaderRow: true
    }).run();
    this.closeTablePicker();
  }

  closeTablePicker(): void {
    this.tablePickerOpen = false;
    this.tablePickerDragging = false;
    this.tablePickerHasSelection = false;
    this.detachTablePickerDragListeners();
  }

  private updateTablePickerFromPointer(event: PointerEvent): void {
    if (!this.tablePickerOpen) {
      return;
    }
    const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const cell = hit?.closest?.("[data-table-row][data-table-col]") as HTMLElement | null;
    if (!cell) {
      return;
    }
    const rows = Number(cell.getAttribute("data-table-row"));
    const cols = Number(cell.getAttribute("data-table-col"));
    if (!rows || !cols) {
      return;
    }
    this.tablePickerHoverRows = rows;
    this.tablePickerHoverCols = cols;
    this.tablePickerHasSelection = true;
  }

  private finishTablePickerDrag(event: PointerEvent): void {
    if (!this.tablePickerDragging) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.updateTablePickerFromPointer(event);
    if (this.tablePickerHasSelection) {
      this.insertTableAtSize(this.tablePickerHoverRows, this.tablePickerHoverCols);
      return;
    }
    this.closeTablePicker();
  }

  private attachTablePickerDragListeners(): void {
    this.detachTablePickerDragListeners();
    document.addEventListener("pointermove", this.onTablePickerPointerMove);
    document.addEventListener("pointerup", this.onTablePickerPointerUp);
    document.addEventListener("pointercancel", this.onTablePickerPointerUp);
  }

  private detachTablePickerDragListeners(): void {
    document.removeEventListener("pointermove", this.onTablePickerPointerMove);
    document.removeEventListener("pointerup", this.onTablePickerPointerUp);
    document.removeEventListener("pointercancel", this.onTablePickerPointerUp);
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
    if (this.editor) {
      const href = this.editorLinkHref();
      if (isContactUsHref(href)) {
        this.openContactButtonBar(href);
      } else {
        this.contactBarOpen = false;
        this.populateLinkBar(null);
      }
    }
  }

  openContactButtonBar(existingHref: string | null = null): void {
    if (this.editor) {
      this.enterDetailMode();
      this.linkBarOpen = false;
      this.imageCropperOpen = false;
      this.insertLinkMode = false;
      if (this.editor.isActive("link") || existingHref) {
        this.editor.chain().focus().extendMarkRange("link").run();
      }
      this.contactRedirectPath = this.currentPageRedirectPath();
      const href = existingHref || this.editorLinkHref();
      const parsed = parseContactUsHref(href);
      const linkText = this.selectedPlainText();
      if (parsed) {
        this.contactUpdatingExisting = true;
        this.ensureContactRoleOption(parsed.role);
        this.contactRoleType = parsed.role;
        this.previousContactRoleType = parsed.role;
        this.contactLabel = linkText || this.defaultLabelForRole(parsed.role);
      } else {
        this.contactUpdatingExisting = this.editor.isActive("link");
        this.contactRoleType = this.contactRoles[0]?.type || "";
        this.previousContactRoleType = this.contactRoleType;
        this.contactLabel = linkText || this.defaultLabelForRole(this.contactRoleType);
      }
      this.contactBarOpen = true;
      this.changeDetector.markForCheck();
      this.zone.runOutsideAngular(() => {
        requestAnimationFrame(() => {
          const input = this.host.nativeElement.querySelector("#tiptap-contact-label") as HTMLInputElement | null;
          if (input) {
            input.focus();
            if (this.contactUpdatingExisting && this.contactLabel) {
              input.select();
            }
          }
        });
      });
    }
  }

  contactRoleLabel(member: CommitteeMember): string {
    return contactUsRoleOptionLabel(member);
  }

  onContactRoleChange(roleType: string): void {
    this.contactRoleType = roleType;
    const previousDefault = this.defaultLabelForRole(this.previousContactRoleType || "");
    if (!this.contactLabel.trim() || this.contactLabel.trim() === previousDefault) {
      this.contactLabel = this.defaultLabelForRole(roleType);
    }
    this.previousContactRoleType = roleType;
  }

  private previousContactRoleType = "";

  private contactButtonRoleAllowed(member: CommitteeMember): boolean {
    let allowed = true;
    if (!member?.type || member.vacant) {
      allowed = false;
    } else if (member.type === CONTACT_US_TYPE || member.builtInRoleMapping === BuiltInRole.CONTACT_US) {
      allowed = false;
    }
    return allowed;
  }

  private ensureContactRoleOption(roleType: string): void {
    if (roleType && roleType !== CONTACT_US_TYPE && !this.contactRoles.some(member => member.type === roleType)) {
      this.contactRoles = [
        ...this.contactRoles,
        {
          type: roleType,
          fullName: roleType,
          description: roleType,
          email: "",
          roleType: RoleType.COMMITTEE_MEMBER
        }
      ];
    }
  }

  contactHrefPreview(): string {
    let preview = "";
    if (this.contactRoleType) {
      preview = buildContactUsHref(this.contactRoleType, this.contactRedirectPath);
    }
    return preview;
  }

  applyContactButton(): void {
    if (this.editor) {
      const label = (this.contactLabel || "").trim();
      const roleType = (this.contactRoleType || "").trim();
      if (label && roleType) {
        const href = buildContactUsHref(roleType, this.currentPageRedirectPath());
        const emptySelection = this.editor.state.selection.empty;
        if (this.editor.isActive("link") || !emptySelection) {
          if (this.editor.isActive("link")) {
            this.editor.commands.extendMarkRange("link");
          }
          const range = {from: this.editor.state.selection.from, to: this.editor.state.selection.to};
          this.editor.chain().focus().insertContentAt(range, {
            type: "text",
            text: label,
            marks: [{type: "link", attrs: {href}}]
          }).run();
        } else {
          this.editor.chain().focus().insertContent({
            type: "text",
            text: label,
            marks: [{type: "link", attrs: {href}}]
          }).run();
        }
        this.contactButtonApplied.emit();
        this.cancelContactButtonBar();
      }
    }
  }

  cancelContactButtonBar(): void {
    this.contactBarOpen = false;
    this.contactRoleType = "";
    this.contactLabel = "";
    this.contactUpdatingExisting = false;
    this.changeDetector.markForCheck();
  }

  private currentPageRedirectPath(): string {
    return this.urlService.pathSegments().filter(segment => !!segment).join("/") || "home";
  }

  private defaultLabelForRole(roleType: string): string {
    const member = this.contactRoles.find(role => role.type === roleType) || null;
    return defaultContactUsLabel(member, fullName => {
      const parts = this.memberNamingService.firstAndLastNameFrom(fullName);
      let firstName: string | null = null;
      if (parts?.firstName) {
        firstName = parts.firstName;
      }
      return firstName;
    });
  }

  private selectedPlainText(): string {
    let text = "";
    if (this.editor) {
      const {from, to, empty} = this.editor.state.selection;
      if (!empty) {
        text = this.editor.state.doc.textBetween(from, to, " ").trim();
      }
    }
    return text;
  }

  private linkHrefAllowed(
    url: string,
    ctx: { defaultValidate: (href: string) => boolean }
  ): boolean {
    const href = (url || "").trim();
    let allowed = false;
    if (!href) {
      allowed = false;
    } else if (href.startsWith("{{")) {
      allowed = true;
    } else if (/^(javascript:|data:)/i.test(href)) {
      allowed = false;
    } else if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      allowed = true;
    } else if (/^(https?:|mailto:|tel:)/i.test(href)) {
      allowed = true;
    } else {
      allowed = ctx.defaultValidate(href);
    }
    return allowed;
  }

  private editorLinkHref(domLink: HTMLAnchorElement | null = null): string {
    let href = "";
    if (this.editor) {
      if (this.editor.isActive("link")) {
        this.editor.commands.extendMarkRange("link");
      }
      const markHref = this.linkHrefFromSelection();
      const fromDom = (domLink?.getAttribute("href") || "").trim();
      href = markHref || fromDom;
    }
    return href;
  }

  private linkHrefFromSelection(): string {
    let href = "";
    if (this.editor) {
      const linkType = this.editor.state.schema.marks["link"];
      if (!linkType) {
        href = ((this.editor.getAttributes("link")["href"] as string) || "").trim();
      } else {
        const {from, to, empty, $from} = this.editor.state.selection;
        const progress = {href: ""};
        if (!empty) {
          this.editor.state.doc.nodesBetween(from, to, node => {
            let continueWalk = true;
            if (!progress.href) {
              const mark = linkType.isInSet(node.marks);
              if (mark?.attrs?.["href"]) {
                progress.href = String(mark.attrs["href"]);
                continueWalk = false;
              }
            }
            return continueWalk;
          });
        }
        if (!progress.href) {
          const mark = linkType.isInSet(this.editor.state.storedMarks || $from.marks());
          if (mark?.attrs?.["href"]) {
            progress.href = String(mark.attrs["href"]);
          }
        }
        if (!progress.href) {
          progress.href = ((this.editor.getAttributes("link")["href"] as string) || "").trim();
        }
        href = (progress.href || "").trim();
      }
    }
    return href;
  }

  private populateLinkBar(domLink: HTMLAnchorElement | null): void {
    this.linkUrl = this.editorLinkHref(domLink);
    this.linkHrefMissing = this.editor?.isActive("link") === true && !this.linkUrl;
    this.imageCropperOpen = false;
    this.linkBarOpen = true;
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        const input = this.host.nativeElement.querySelector("#tiptap-link-url") as HTMLInputElement | null;
        if (input) {
          input.focus();
          if (this.linkUrl) {
            input.select();
          }
        }
      });
    });
  }

  private handleEditableLinkClick(view: {editable: boolean; dom: HTMLElement}, event: Event): boolean {
    let handled = false;
    if (view.editable && this.editable) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;
      if (link && view.dom.contains(link)) {
        event.preventDefault();
        event.stopPropagation();
        this.zone.run(() => {
          this.enterDetailMode();
          this.editor?.chain().focus().extendMarkRange("link").run();
          const href = this.editorLinkHref(link);
          if (isContactUsHref(href)) {
            this.openContactButtonBar(href);
          } else {
            this.contactBarOpen = false;
            this.populateLinkBar(link);
          }
        });
        handled = true;
      }
    }
    return handled;
  }

  cancelLinkBar(): void {
    this.linkBarOpen = false;
    this.linkUrl = "";
    this.linkHrefMissing = false;
  }

  confirmLink(): void {
    if (this.editor) {
      const url = (this.linkUrl ?? "").trim();
      if (!url) {
        this.removeLink();
      } else {
        const applied = this.editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        if (!applied) {
          this.logger.warn("setLink rejected href:", url);
        } else {
          this.linkBarOpen = false;
          this.linkUrl = "";
          this.linkHrefMissing = false;
        }
      }
    }
  }

  removeLink(): void {
    this.editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    this.linkBarOpen = false;
    this.linkUrl = "";
    this.linkHrefMissing = false;
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

  private async uploadAndInsertPastedImage(pastedImage: File): Promise<void> {
    if (!this.editable) {
      return;
    }
    this.pastedImageUploading = true;
    try {
      const fileName = pastedImage.name || this.fileUtilsService.pastedFilenameForMime(pastedImage.type);
      const fileToUpload = await this.resizedForEmail(pastedImage, fileName);
      const formData = new FormData();
      formData.append("file", fileToUpload, fileName);
      const response = await firstValueFrom(this.http.post<AwsFileUploadResponse>(`${S3_BASE_URL}/file-upload?root-folder=${this.rootFolder}`, formData));
      const fileNameData = response?.responses?.[0]?.fileNameData;
      if (fileNameData) {
        const relative = this.urlService.resourceRelativePathForAWSFileName(`${fileNameData.rootFolder}/${fileNameData.awsFileName}`);
        const src = `${this.urlService.publicBaseUrl().replace(/\/$/, "")}/${relative}`;
        this.editor?.chain().focus().setImage({src, alt: ""}).run();
      } else {
        this.logger.error("pasted image upload returned no file data:", response);
      }
    } catch (error) {
      this.logger.error("pasted image upload failed:", error);
    } finally {
      this.pastedImageUploading = false;
    }
  }

  private async resizedForEmail(file: File, fileName: string): Promise<File> {
    const maximumBytes = 300000;
    if (file.size <= maximumBytes) {
      return file;
    }
    const base64Files = await this.fileUtilsService.fileListToBase64Files([file]);
    const base64Content = base64Files[0]?.base64Content;
    if (!base64Content) {
      return file;
    }
    const resized = await this.fileUtilsService.resizeBase64Image(base64Content, fileName, maximumBytes, 1200);
    return resized ? this.fileUtilsService.base64ToFileWithName(resized, fileName) : file;
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
    if (!this.canUndo) {
      return;
    }
    this.editor?.chain().focus().undo().run();
  }

  redo(): void {
    if (!this.canRedo) {
      return;
    }
    this.editor?.chain().focus().redo().run();
  }

  private refreshHistoryState(): void {
    if (!this.editor) {
      this.canUndo = false;
      this.canRedo = false;
      return;
    }
    this.canUndo = undoDepth(this.editor.state) > 0;
    this.canRedo = redoDepth(this.editor.state) > 0;
  }

  private clearEditorHistory(): void {
    if (!this.editor) {
      return;
    }
    const {state, view} = this.editor;
    view.updateState(EditorState.create({
      doc: state.doc,
      plugins: state.plugins,
      selection: state.selection
    }));
    this.refreshHistoryState();
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
