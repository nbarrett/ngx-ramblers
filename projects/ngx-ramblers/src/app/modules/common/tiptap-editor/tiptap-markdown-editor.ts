import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation, inject } from "@angular/core";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Marked } from "marked";
import { TiptapEditorDirective } from "ngx-tiptap";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faBold, faItalic, faLink, faListOl, faListUl, faQuoteRight, faUndo, faRedo, faHeading, faRemoveFormat } from "@fortawesome/free-solid-svg-icons";
import { MERGE_FIELD_HINTS, MemberMergeFieldHint } from "../../../models/email-composer.model";
import { TiptapMark } from "../../../models/tiptap-editor.model";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { AwsFileData } from "../../../models/aws-object.model";
import { RootFolder } from "../../../models/system.model";
import { UrlService } from "../../../services/url.service";
import { ImageActionsDropdownComponent } from "../dynamic-content/image-actions-dropdown";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
  selector: "app-tiptap-markdown-editor",
  encapsulation: ViewEncapsulation.None,
  imports: [TiptapEditorDirective, FontAwesomeModule, ImageCropperAndResizerComponent, ImageActionsDropdownComponent],
  styles: [`
    .tiptap-editor-shell
      border: 1px solid #ced4da
      border-radius: 4px
      background-color: #ffffff
      display: flex
      flex-direction: column
      max-width: 100%
      min-width: 0
      overflow-x: hidden

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

    .tiptap-toolbar button:hover
      border-color: #adb5bd
      background-color: #ffffff

    .tiptap-toolbar button.is-active
      background-color: #ffffff
      border-color: #6c757d
      color: #c05711

    .tiptap-toolbar select
      padding: 4px 8px
      border-radius: 3px
      border: 1px solid #ced4da
      background-color: #ffffff

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

    .tiptap-content img,
    .tiptap-content table,
    .tiptap-content video,
    .tiptap-content iframe
      max-width: 100%
      height: auto

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
    <div class="tiptap-editor-shell">
      <div class="tiptap-toolbar" role="toolbar">
        <button type="button" title="Bold" (click)="toggle(TiptapMark.Bold)" [class.is-active]="isActive('bold')">
          <fa-icon [icon]="faBold"/>
        </button>
        <button type="button" title="Italic" (click)="toggle(TiptapMark.Italic)" [class.is-active]="isActive('italic')">
          <fa-icon [icon]="faItalic"/>
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" title="Heading 2" (click)="toggleHeading(2)" [class.is-active]="isActive('heading', { level: 2 })">
          <fa-icon [icon]="faHeading"/> 2
        </button>
        <button type="button" title="Heading 3" (click)="toggleHeading(3)" [class.is-active]="isActive('heading', { level: 3 })">
          <fa-icon [icon]="faHeading"/> 3
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" title="Bulleted list" (click)="toggle(TiptapMark.BulletList)" [class.is-active]="isActive('bulletList')">
          <fa-icon [icon]="faListUl"/>
        </button>
        <button type="button" title="Numbered list" (click)="toggle(TiptapMark.OrderedList)" [class.is-active]="isActive('orderedList')">
          <fa-icon [icon]="faListOl"/>
        </button>
        <button type="button" title="Quote" (click)="toggle(TiptapMark.Blockquote)" [class.is-active]="isActive('blockquote')">
          <fa-icon [icon]="faQuoteRight"/>
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" title="Insert link" (click)="openLinkBar()">
          <fa-icon [icon]="faLink"/>
        </button>
        <app-image-actions-dropdown [hasImage]="imageSelected"
                                    [fullWidth]="false"
                                    (edit)="onImageActionEdit()"
                                    (replace)="onImageActionReplace()"
                                    (remove)="onImageActionRemove()"/>
        <span class="toolbar-divider"></span>
        @if (showMergeFields) {
          <select title="Insert merge field" (change)="onMergeFieldSelected($event)">
            <option value="">Insert merge field…</option>
            @for (hint of mergeFieldHints; track hint.token) {
              <option [value]="hint.token">{{ hint.label }}</option>
            }
          </select>
          <span class="toolbar-divider"></span>
        }
        <button type="button" title="Clear formatting" (click)="clearFormatting()">
          <fa-icon [icon]="faRemoveFormat"/>
        </button>
        <span class="toolbar-divider"></span>
        <button type="button" title="Undo" (click)="undo()">
          <fa-icon [icon]="faUndo"/>
        </button>
        <button type="button" title="Redo" (click)="redo()">
          <fa-icon [icon]="faRedo"/>
        </button>
      </div>
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
          <app-image-cropper-and-resizer wrapButtons
                                         [rootFolder]="rootFolder"
                                         [preloadImage]="cropperPreloadSrc"
                                         (quit)="cancelImageCropper()"
                                         (save)="onImageCropperSave($event)"/>
        </div>
      }
      <div class="tiptap-content">
        @if (editor) {
          <tiptap-editor [editor]="editor"></tiptap-editor>
        }
      </div>
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

  public focusAtStart(): void {
    this.editor?.commands.focus("start");
  }

  @Input() placeholder: string = "Start writing…";
  @Input() showMergeFields: boolean = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() rawPaste = new EventEmitter<{ text: string; consume: () => void }>();

  protected editor: Editor | null = null;
  private pendingValue: string = "";
  private urlService = inject(UrlService);
  private pasteMarked = new Marked();
  protected mergeFieldHints: MemberMergeFieldHint[] = MERGE_FIELD_HINTS;
  protected linkBarOpen: boolean = false;
  protected imageCropperOpen: boolean = false;
  protected imageSelected: boolean = false;
  protected cropperPreloadSrc: string | null = null;
  private replaceSelectedImageOnSave: boolean = false;
  protected linkUrl: string = "";
  protected readonly rootFolder = RootFolder.siteContent;

  private logger: Logger = inject(LoggerFactory).createLogger("TiptapMarkdownEditor", NgxLoggerLevel.ERROR);

  protected readonly TiptapMark = TiptapMark;
  protected readonly faBold = faBold;
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
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      Image.configure({ inline: false, allowBase64: false }),
      Markdown,
      Table.configure({ resizable: false, HTMLAttributes: { class: "tiptap-table" } }),
      TableRow,
      TableHeader,
      TableCell
    ];
    this.editor = new Editor({
      extensions,
      editorProps: {
        attributes: {
          "data-placeholder": this.placeholder ?? ""
        },
        handlePaste: (_view, event) => {
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (text) {
            let consumed = false;
            this.rawPaste.emit({ text, consume: () => { consumed = true; } });
            if (consumed) {
              event.preventDefault();
              return true;
            }
          }
          if (text && this.looksLikeMarkdown(text)) {
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
        transformPastedHTML: (html: string) => this.sanitiseHtmlForPaste(html)
      },
      content: this.pendingValue,
      contentType: "markdown"
    });
    this.editor.on("update", () => {
      const markdown = this.currentMarkdown();
      this.valueChange.emit(markdown);
    });
    this.editor.on("selectionUpdate", () => {
      this.imageSelected = this.editor?.isActive("image") ?? false;
    });
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
    this.editor?.destroy();
    this.editor = null;
  }

  private currentMarkdown(): string {
    return this.editor?.getMarkdown?.() ?? this.editor?.getHTML() ?? "";
  }

  isActive(name: string, attrs?: Record<string, any>): boolean {
    if (!this.editor) return false;
    return attrs ? this.editor.isActive(name, attrs) : this.editor.isActive(name);
  }

  toggle(name: TiptapMark): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (name === TiptapMark.Bold) chain.toggleBold().run();
    else if (name === TiptapMark.Italic) chain.toggleItalic().run();
    else if (name === TiptapMark.BulletList) chain.toggleBulletList().run();
    else if (name === TiptapMark.OrderedList) chain.toggleOrderedList().run();
    else if (name === TiptapMark.Blockquote) chain.toggleBlockquote().run();
  }

  toggleHeading(level: 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
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

  onImageActionEdit(): void {
    if (!this.editor) return;
    if (this.imageSelected) {
      const currentSrc = (this.editor.getAttributes("image")["src"] as string) ?? null;
      this.cropperPreloadSrc = currentSrc;
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

  onMergeFieldSelected(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const token = target.value;
    if (token && this.editor) {
      this.editor.chain().focus().insertContent(token).run();
    }
    target.value = "";
  }
}
