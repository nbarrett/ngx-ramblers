import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from "@angular/core";
import {
  faAngleDown,
  faAngleUp,
  faCircleCheck,
  faEraser,
  faHashtag,
  faImage,
  faPaintBrush,
  faRefresh,
  faScissors,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { cloneDeep, isEmpty, isEqual, pick } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  ContentText,
  ContentTextStyles,
  DataAction,
  EditorState,
  HasStyles,
  InsertableField,
  ListStyle,
  ListStyleMappings,
  SplitEvent,
  View
} from "../../../models/content-text.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { ContentTextService } from "../../../services/content-text.service";
import { ContentConversionService } from "../../../services/content-conversion.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MigrationConfigService } from "../../../services/migration/migration-config.service";
import { ConfigService } from "../../../services/config.service";
import { ConfigKey } from "../../../models/config.model";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PasteDetectionService } from "../../../services/paste-detection.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FormsModule } from "@angular/forms";
import { MarkdownComponent } from "ngx-markdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { KebabCasePipe } from "../../../pipes/kebabcase.pipe";
import {
  ContentFormattingSelectorComponent
} from "../content-formatting-selector/content-formatting-selector";
import { UrlService } from "../../../services/url.service";
import { SystemConfig, TextStyle } from "../../../models/system.model";
import { Subscription } from "rxjs";
import { DataPopulationService } from "../../../pages/admin/data-population.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { HtmlPastePreview, HtmlPasteResult } from "../../../models/html-paste.model";
import { TiptapMarkdownEditor } from "./tiptap-markdown-editor";
import { ContentTextUnsavedChangesService } from "../../../services/content-text-unsaved-changes.service";

@Component({
  selector: "app-content-text-editor",
  styles: [`
    :host
      display: block

    .background-panel
      border-radius: 6px
      padding: 16px
      box-sizing: border-box

    .content-text-editor-tiptap
      margin-top: 0
      margin-bottom: 0

    .paste-prompt-overlay
      position: fixed
      top: 0
      left: 0
      right: 0
      bottom: 0
      background: rgba(0, 0, 0, 0.5)
      display: flex
      align-items: center
      justify-content: center
      z-index: 10001

    .paste-prompt
      background: white
      border-radius: 8px
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)
      max-width: 500px
      width: 90%

    .paste-prompt-header
      padding: 16px
      border-bottom: 1px solid #e0e0e0

    .paste-prompt-body
      padding: 16px

      p
        margin: 0

    .paste-prompt-actions
      padding: 16px
      display: flex
      justify-content: flex-end
      gap: 8px

    .paste-processing-backdrop
      position: fixed
      top: 0
      left: 0
      right: 0
      bottom: 0
      background: rgba(0, 0, 0, 0.5)
      z-index: 10001

    .paste-processing-indicator
      position: fixed
      top: 50%
      left: 50%
      transform: translate(-50%, -50%)
      background: rgba(0, 0, 0, 0.8)
      color: white
      padding: 20px 30px
      border-radius: 8px
      z-index: 10002
      display: flex
      align-items: center
      gap: 12px
      font-size: 16px

      fa-icon
        animation: spin 1s linear infinite

    @keyframes spin
      from
        transform: rotate(0deg)
      to
        transform: rotate(360deg)
  `],
  template: `
    @if (editingContent()) {
      <ng-content select="[prepend]"/>
      @if (editNameEnabled) {
        <div class="row">
          <div class="col-12">
            <label class="mt-2 mt-3" [for]="'input-'+ content.name | kebabCase">Content name</label>
            <input [(ngModel)]="content.name"
                   [id]="'input-'+ content.name | kebabCase"
                   type="text" class="form-control input-sm"
                   placeholder="Enter name of content">
            <label class="mt-2 mt-3" [for]="content.name">Content for {{ content.name }}</label>
          </div>
        </div>
      }
      <div class="content-text-editor-tiptap">
        <app-tiptap-markdown-editor
          [value]="content.text || ''"
          [editable]="canEditContent()"
          [contentClass]="contentStyleClasses()"
          [placeholder]="'Enter ' + (description || 'content') + ' text here'"
          [undoTooltip]="undoTooltip()"
          [redoTooltip]="redoTooltip()"
          (valueChange)="onTiptapValueChange($event)"
          (rawPaste)="onTiptapRawPaste($event)"
          (contactButtonApplied)="onContactButtonApplied()">
          @if (canEditContent()) {
            <span toolbarExtras class="toolbar-extras">
              <span class="toolbar-divider"></span>
              @if (!standalone) {
                <button type="button" tooltip="Split text into new row below" container="body" delay=500
                        (click)="formatSplit()">
                  <fa-icon [icon]="faScissors"/>
                </button>
              }
              @if (!standalone && hasImagesInCurrentContent()) {
                <button type="button" [tooltip]="convertToRowsTooltip()" container="body" delay=500
                        (click)="showConvertToRowsPreview()">
                  <fa-icon [icon]="faImage"/>
                </button>
              }
              <div dropdown [container]="'body'" placement="bottom right" class="toolbar-dropdown" #formattingDropdown="bs-dropdown">
                <button type="button" class="dropdown-toggle" dropdownToggle
                        tooltip="Formatting styles" container="body" delay=500>
                  <fa-icon [icon]="faPaintBrush"/>
                </button>
                <ul *dropdownMenu class="dropdown-menu dropdown-menu-end"
                    (click)="$event.stopPropagation()"
                    (mousedown)="$event.stopPropagation()">
                  <app-content-formatting-selector
                    [standaloneMenu]="false"
                    [styles]="content?.styles"
                    (listStyleChange)="onFormattingListStyleChange($event, formattingDropdown)"
                    (textStyleChange)="onFormattingTextStyleChange($event, formattingDropdown)">
                  </app-content-formatting-selector>
                </ul>
              </div>
              @if (insertableFields.length > 0) {
                <div dropdown [container]="'body'" class="toolbar-dropdown">
                  <button type="button" class="dropdown-toggle" dropdownToggle
                          tooltip="Insert placeholder field" container="body" delay=500>
                    <fa-icon [icon]="faHashtag"/>
                  </button>
                  <ul *dropdownMenu class="dropdown-menu">
                    @for (field of insertableFields; track field.value) {
                      <li><a class="dropdown-item" (click)="insertField(field)">{{ field.label }}</a></li>
                    }
                  </ul>
                </div>
              }
              @if (dirty() && canSave()) {
                <button type="button" class="toolbar-text-toggle"
                        [tooltip]="'Save content for ' + description" container="body" delay=500
                        (click)="save()">
                  <fa-icon [icon]="saving() ? faSpinner : faCircleCheck" class="me-1"
                           [animation]="saving() ? 'spin' : undefined"/>
                  save
                </button>
              }
              @if (hasDefaultContent()) {
                <button type="button" class="toolbar-text-toggle"
                        [tooltip]="'Load default content for ' + description" container="body" delay=500
                        (click)="loadDefault()">
                  <fa-icon [icon]="faRefresh" class="me-1"/>
                  default
                </button>
              }
              @if (canDelete() && !saving()) {
                <button type="button" class="toolbar-text-toggle"
                        [tooltip]="'Delete content for ' + description" container="body" delay=500
                        (click)="delete()">
                  <fa-icon [icon]="faEraser" class="me-1"/>
                  delete
                </button>
              }
            </span>
          }
        </app-tiptap-markdown-editor>
      </div>
      <ng-content select=":not([prepend])"/>
      @if (pasteProcessing && !pastePromptVisible) {
        <div class="paste-processing-backdrop"></div>
        <div class="paste-processing-indicator">
          <fa-icon [icon]="faSpinner" animation="spin"/>
          <span>Processing paste...</span>
        </div>
      }
      @if (pastePromptVisible) {
        <div class="paste-prompt-overlay">
          <div class="paste-prompt" (click)="$event.stopPropagation()">
            <div class="paste-prompt-header">
              @if (pastePromptHtmlDetected) {
                <strong>HTML content detected</strong>
              }
              @if (!pastePromptHtmlDetected) {
                <strong>Pasted text with images detected</strong>
              }
            </div>
            <div class="paste-prompt-body">
              @if (pastePromptHtmlDetected) {
                <p>Select a base URL for resolving relative image paths:</p>
                <div class="mb-3">
                  @if (pastePromptBaseUrls.length > 0) {
                    <select
                      class="form-select mb-2"
                      [ngModel]="pastePromptBaseUrl"
                      (ngModelChange)="pastePromptBaseUrlChanged($event)">
                      @for (baseUrl of pastePromptBaseUrls; track baseUrl) {
                        <option [value]="baseUrl">{{ baseUrl }}</option>
                      }
                      <option value="__custom__">Custom URL...</option>
                    </select>
                  }
                  @if (pastePromptShowCustomUrlInput || pastePromptBaseUrls.length === 0) {
                    <input
                      type="text"
                      class="form-control"
                      [ngModel]="pastePromptCustomUrl"
                      (ngModelChange)="pastePromptCustomUrlChanged($event)"
                      placeholder="https://example.com/path">
                  }
                  @if (pastePromptErrorMessage) {
                    <div class="text-danger small mt-2">{{ pastePromptErrorMessage }}</div>
                  }
                  @if (pastePromptShowSaveToConfigPrompt) {
                    <div class="alert alert-warning small mt-2">
                      <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="saveToConfig"
                               [(ngModel)]="pastePromptSaveToConfig">
                        <label class="form-check-label" for="saveToConfig">
                          Save this URL to migration config for future use
                        </label>
                      </div>
                    </div>
                  }
                </div>

                @if (pastePromptHtmlPreview?.rows && pastePromptHtmlPreview.rows.length > 1) {
                  <div class="mt-3">
                    <p class="mb-2 fw-bold">Row placement:</p>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="rowPlacementHtml" id="rowPlacementHtmlNested"
                             [value]="true" [(ngModel)]="pastePromptCreateNested">
                      <label class="form-check-label" for="rowPlacementHtmlNested">
                        Create nested rows within this column
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="rowPlacementHtml" id="rowPlacementHtmlSibling"
                             [value]="false" [(ngModel)]="pastePromptCreateNested">
                      <label class="form-check-label" for="rowPlacementHtmlSibling">
                        Create new rows below (at page level)
                      </label>
                    </div>
                  </div>
                }
              }
              @if (!pastePromptHtmlDetected) {
                @if (pastePromptIsConversion) {
                  @if (pastePromptMarkdownPreview?.rows && pastePromptMarkdownPreview.rows.length > 0) {
                    <p>Convert this content
                      into {{ stringUtilsService.pluraliseWithCount(pastePromptMarkdownPreview.rows.length, "row") }}
                      ?</p>
                  } @else {
                    <p>Convert this content into multiple rows?</p>
                  }
                } @else {
                  <p>How would you like to paste this content?</p>
                  @if (pastePromptMarkdownPreview?.rows && pastePromptMarkdownPreview.rows.length > 0) {
                    <p class="text-muted small">This will
                      create {{ stringUtilsService.pluraliseWithCount(pastePromptMarkdownPreview.rows.length, "row") }}</p>
                  }
                }

                @if (pastePromptMarkdownPreview?.rows && pastePromptMarkdownPreview.rows.length > 1) {
                  <div class="mt-3">
                    <p class="mb-2 fw-bold">Row placement:</p>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="rowPlacement" id="rowPlacementNested"
                             [value]="true" [(ngModel)]="pastePromptCreateNested">
                      <label class="form-check-label" for="rowPlacementNested">
                        Create nested rows within this column
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="rowPlacement" id="rowPlacementSibling"
                             [value]="false" [(ngModel)]="pastePromptCreateNested">
                      <label class="form-check-label" for="rowPlacementSibling">
                        Create new rows below (at page level)
                      </label>
                    </div>
                  </div>
                }
              }
            </div>
            <div class="paste-prompt-actions">
              @if (pastePromptHtmlDetected) {
                <button class="btn btn-primary me-2" (click)="pasteAsRows()">
                  <span>Convert and split into rows</span>
                </button>
                <button class="btn btn-secondary me-2" (click)="pasteAsIs()">
                  <span>Convert without splitting</span>
                </button>
                <button class="btn btn-outline-secondary" (click)="hidePastePrompt()">
                  <span>Cancel</span>
                </button>
              }
              @if (!pastePromptHtmlDetected) {
                <button class="btn btn-primary me-2" (click)="pasteAsRows()">
                  <fa-icon [icon]="faScissors"/>
                  <span class="ms-2">{{ pastePromptIsConversion ? 'Convert to rows' : 'Split into rows' }}</span>
                </button>
                @if (!pastePromptIsConversion) {
                  <button class="btn btn-secondary" (click)="pasteAsIs()">
                    <span>Paste as-is</span>
                  </button>
                }
                <button class="btn btn-outline-secondary ms-2" (click)="hidePastePrompt()">
                  <span>Cancel</span>
                </button>
              }
            </div>
          </div>
        </div>
      }
    } @else {
      @if (showing()) {
        @if (renderInline()) {
          <span markdown mermaid ngPreserveWhitespaces [data]="content.text" [class]="content?.styles?.class">
          </span>
        } @else {
          <div [class]="contentStyleClasses()"
               markdown mermaid ngPreserveWhitespaces [data]="content.text">
          </div>
        }
      }
      @if (allowHide) {
        <div class="badge-button"
             (click)="toggleShowHide()" [tooltip]="showHideCaption()">
          <fa-icon [icon]="showing() ? faAngleUp:faAngleDown"/>
          <span>{{ showHideCaption() }}</span>
        </div>
      }
    }
  `,
  imports: [TooltipDirective, FormsModule, MarkdownComponent, FontAwesomeModule, KebabCasePipe, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, ContentFormattingSelectorComponent, TiptapMarkdownEditor]
})
export class ContentTextEditor implements OnInit, AfterViewInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ContentTextEditor", NgxLoggerLevel.ERROR);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private config = inject(ConfigService);
  private contentTextUnsavedChanges = inject(ContentTextUnsavedChangesService);
  private static nextUnsavedTrackerId = 0;
  private readonly unsavedTrackerId = `content-text-editor-${ContentTextEditor.nextUnsavedTrackerId += 1}`;
  @ViewChild(TiptapMarkdownEditor) tiptapEditor?: TiptapMarkdownEditor;

  @Input("presentationMode") set presentationModeValue(presentationMode: boolean) {
    this.presentationMode = coerceBooleanProperty(presentationMode);
  }

  @Input("editNameEnabled") set acceptEditNameEnabledChangesFrom(editNameEnabled: boolean) {
    this.logger.info("editNameEnabled:", editNameEnabled);
    this.editNameEnabled = editNameEnabled;
  }

  @Input("text") set acceptTextChangesFrom(text: string) {
    this.logger.info("text:", text);
    if (text != null) {
      this.textInputProvided = true;
    }
    if (!this.content) { this.content = {}; }
    this.content.text = text;
    this.updateMarkdownPreviewForTooltip();
  }

  @Input("name") set acceptNameChangesFrom(name: string) {
    this.logger.info("acceptNameChangesFrom:name:", name);
    if (!this.content) { this.content = {}; }
    this.content.name = name;
  }

  @Input("category") set acceptCategoryChangesFrom(category: string) {
    this.logger.info("category:", category);
    if (!this.content) { this.content = {}; }
    this.content.category = category;
  }

  @Input("styles") set acceptStylesChangesFrom(styles: ContentTextStyles) {
    this.logger.info("styles:", styles);
    if (!this.content) { this.content = {}; }
    if (styles) {
      this.content.styles = styles;
    }
  }

  @Input("data") set dataValue(data: ContentText) {
    this.data = data;
    this.setDataAttributes();
  }

  @Input("allowHide") set allowHideValue(allowHide: boolean) {
    this.allowHide = coerceBooleanProperty(allowHide);
  }

  @Input("deleteEnabled") set deleteEnabledValue(deleteEnabled: boolean) {
    this.deleteEnabled = coerceBooleanProperty(deleteEnabled);
  }

  @Input("standalone") set standaloneValue(value: boolean) {
    this.standalone = coerceBooleanProperty(value);
  }

  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private uiActionsService = inject(UiActionsService);
  private broadcastService = inject<BroadcastService<ContentText>>(BroadcastService);
  private contentTextService = inject(ContentTextService);
  private contentConversionService = inject(ContentConversionService);
  protected stringUtilsService = inject(StringUtilsService);
  protected siteEditService = inject(SiteEditService);
  private urlService = inject(UrlService);
  private dataPopulationService = inject(DataPopulationService);
  private pasteDetectionService = inject(PasteDetectionService);
  private injector = inject(Injector);
  private systemConfig: SystemConfig;
  @Input() initialView: View;
  @Input({transform: booleanAttribute}) autoFocus = false;
  @Input() description: string;
  @Input() parentRowColumnCount: number;
  @Input() insertableFields: InsertableField[] = [];
  @Output() changed: EventEmitter<ContentText> = new EventEmitter();
  @Output() saved: EventEmitter<ContentText> = new EventEmitter();
  @Output() split: EventEmitter<SplitEvent> = new EventEmitter();
  @Output() htmlPaste: EventEmitter<HtmlPasteResult> = new EventEmitter();
  faScissors = faScissors;
  faImage = faImage;
  faPaintBrush = faPaintBrush;
  faHashtag = faHashtag;
  private presentationMode: boolean;
  public data: ContentText;
  public allowHide: boolean;
  public deleteEnabled: boolean;
  private show = true;
  public editNameEnabled: boolean;
  faSpinner = faSpinner;
  faCircleCheck = faCircleCheck;
  faEraser = faEraser;
  faAngleUp = faAngleUp;
  faAngleDown = faAngleDown;
  protected readonly faRefresh = faRefresh;
  private originalContent: ContentText;
  public editorState: EditorState;
  public content: ContentText = {};
  private saveEnabled = false;
  public standalone = false;
  private hideParameterName: StoredValue;
  private subscriptions: Subscription[] = [];
  public pastePromptVisible = false;
  public pasteProcessing = false;
  private pastePromptMarkdown = "";
  private pastePromptPosition: { start: number; end: number } | null = null;
  public pastePromptBaseUrl = "";
  public pastePromptBaseUrls: string[] = [];
  public pastePromptHtmlDetected = false;
  private pastePromptHtml: string | null = null;
  public pastePromptErrorMessage = "";
  protected pastePromptHtmlPreview: HtmlPastePreview | null = null;
  private pastePromptPreviewBaseUrl = "";
  protected pastePromptMarkdownPreview: HtmlPastePreview | null = null;
  public pastePromptIsConversion = false;
  public pastePromptCreateNested: boolean | null = null;
  private textInputProvided = false;
  private migrationConfigSubscriptionAdded = false;
  public pastePromptShowCustomUrlInput = false;
  public pastePromptCustomUrl = "";
  public pastePromptShowSaveToConfigPrompt = false;
  public pastePromptSaveToConfig = false;

  ngAfterViewInit(): void {
    if (this.autoFocus && this.canEditContent()) {
      this.tiptapEditor?.focusAtEnd();
    }
  }

  async ngOnInit() {
    this.logger.info("ngOnInit:name", this.content?.name, "data:", this.data, "description:", this.description);
    this.hideParameterName = this.stringUtilsService.kebabCase(StoredValue.MARKDOWN_FIELD_HIDDEN, this.content?.name) as StoredValue;
    this.editorState = {
      view: this.siteEditService.active() ? View.EDIT : (this.initialView || View.VIEW),
      dataAction: DataAction.NONE
    };
    if (this.data) {
      this.setDataAttributes();
    } else if (this.textInputProvided || this.content?.text) {
      this.originalContent = cloneDeep(this.content);
      this.logger.info("editing injected content", this.content, "editorState:", this.editorState);
    } else if (this.standalone && (this.content?.name || this.content?.category)) {
      await this.queryContent();
      this.setDescription();
    } else {
      this.originalContent = cloneDeep(this.content);
    }
    this.subscriptions.push(this.siteEditService.events.subscribe((item: NamedEvent<boolean>) => {
      this.logger.info("siteEditService.events.subscribe:", this.content?.name, "this.editorState.view", this.editorState.view, "siteEditService:event", item);
      this.editorState.view = item.data ? View.EDIT : (this.initialView || View.VIEW);
      if (item.data) {
        this.subscribeToMigrationConfigIfNeeded();
      }
    }));
    if (this.siteEditService.active()) {
      this.subscribeToMigrationConfigIfNeeded();
    }
    if (this.allowHide) {
      const currentlyHidden = this.uiActionsService.initialBooleanValueFor(this.hideParameterName, false);
      this.show = !currentlyHidden;
    }
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => this.systemConfig = systemConfig));
    const keyListener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && this.pastePromptVisible) {
        this.hidePastePrompt();
      }
    };
    document.addEventListener("keydown", keyListener);
    this.subscriptions.push({
      unsubscribe: () => document.removeEventListener("keydown", keyListener)
    } as Subscription);
  }

  ngOnDestroy(): void {
    this.contentTextUnsavedChanges.clear(this.unsavedTrackerId);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private subscribeToMigrationConfigIfNeeded() {
    if (this.migrationConfigSubscriptionAdded || this.presentationMode) {
      return;
    }
    const migrationConfigService = this.injector.get(MigrationConfigService);
    this.migrationConfigSubscriptionAdded = true;
    this.subscriptions.push(migrationConfigService.migrationConfigEvents().subscribe(config => {
      const baseUrls = (config.sites || [])
        .map(site => site.baseUrl)
        .filter(baseUrl => !!baseUrl)
        .map(baseUrl => this.ensureTrailingSlash(baseUrl.trim()));
      this.pastePromptBaseUrls = Array.from(new Set(baseUrls));
      if (!this.pastePromptBaseUrl && this.pastePromptBaseUrls.length > 0) {
        this.pastePromptBaseUrl = this.pastePromptBaseUrls[0];
      } else if (this.pastePromptBaseUrl) {
        this.pastePromptBaseUrl = this.ensureTrailingSlash(this.pastePromptBaseUrl);
      }
    }));
  }

  onFormattingTextStyleChange(className: string, dropdown?: { hide: () => void }) {
    this.assignTextStyleTo(className);
    dropdown?.hide();
  }

  onFormattingListStyleChange(listStyle: ListStyle, dropdown?: { hide: () => void }) {
    this.assignListStyleTo(listStyle);
    dropdown?.hide();
  }

  public assignListStyleTo(listStyle: ListStyle) {
    this.logger.info("assignListStyleTo:listStyle:", listStyle, "this.content:", this.content);
    this.initialiseStyles();
    this.content.styles.list = listStyle;
    this.broadcastChange();
    this.syncUnsavedTracker();
    this.changeDetectorRef.markForCheck();
  }

  assignTextStyleTo(className: string) {
    this.initialiseStyles();
    this.content.styles.class = className || null;
    this.logger.info("assignTextStyleTo:className:", className, "content.styles:", this.content.styles);
    this.broadcastChange();
    this.syncUnsavedTracker();
    this.changeDetectorRef.detectChanges();
  }

  onContactButtonApplied(): void {
    this.initialiseStyles();
    if (this.content.styles?.class !== TextStyle.AS_BUTTON && this.content.styles?.class !== TextStyle.AS_BUTTON_WARNING) {
      this.assignTextStyleTo(TextStyle.AS_BUTTON);
    }
  }

  private initialiseStyles() {
    if (!this.content) {
      this.content = {};
    }
    if (!this.content.styles) {
      this.content.styles = {list: null, class: null};
      this.logger.info("initialiseStyles:created styles for:", this.content.name || this.description);
    }
  }

  private setDataAttributes() {
    this.logger.info("setDataAttributes:data:", this.data);
    const existingData: boolean = !!this.data.id;
    this.content = this.data;
    this.saveEnabled = true;
    this.logger.info("editing:", this.content, "existingData:", existingData, "editorState:", this.editorState);
    this.originalContent = cloneDeep(this.content);
    this.setDescription();
    this.updateMarkdownPreviewForTooltip();
  }

  private setDescription() {
    if (!this.description) {
      this.description = this.content.name;
    }
  }

  async queryContent(): Promise<ContentText> {
    this.editorState.dataAction = DataAction.QUERY;
      this.logger.info("querying content:name", this.content?.name, "and category:", this.content?.category, "editorState:", this.editorState);
    const content = await this.contentTextService.findByNameAndCategory(this.content?.name, this.content?.category);
    if (content) {
      return this.apply(content);
    } else {
      const content = await this.contentTextService.findByNameAndCategory(this.content?.name, null);
      return this.apply(content);
    }
  }

  private apply(content: ContentText): ContentText {
    if (isEmpty(content)) {
      if (this.siteEditService.active()) {
        this.logger.info("content is empty for", this.description, "assumed to be new content so going into edit mode");
      }
      if (!this.content) { this.content = {}; }
      this.autoLoadDefaultContentIfAvailable();
    } else {
      this.content = content;
      this.initialiseStyles();
    }
    this.saveEnabled = true;
    this.originalContent = cloneDeep(this.content);
    this.editorState.dataAction = DataAction.NONE;
    this.updateMarkdownPreviewForTooltip();
    this.logger.info("retrieved content:", this.content, "editor state:", this.editorState);
    return this.content;
  }

  private autoLoadDefaultContentIfAvailable(): void {
    const defaultText = this.dataPopulationService.defaultContent(this.content?.category, this.content?.name);
    if (defaultText && !this.content.text) {
      this.logger.info("Auto-loading default content for", this.content?.name);
      this.content.text = defaultText;
    }
  }

  revert(): void {
    this.logger.info("reverting ", this.content?.name, "content");
    this.content = cloneDeep(this.originalContent);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_SYNCED, this.content));
    this.changed.emit(this.content);
    this.updateMarkdownPreviewForTooltip();
    this.syncUnsavedTracker();
  }

  dirty(): boolean {
    const fields = ["id", "name", "category", "text", "styles"];
    const isDirty = !isEqual(pick(this.content, fields), pick(this.originalContent, fields));
    this.logger.off("dirty:content", this.content, "originalContent", this.originalContent, "isDirty ->", isDirty);
    return isDirty;
  }

  save(): Promise<ContentText> {
    if (this.saveEnabled && this.editorState.dataAction === DataAction.NONE) {
      this.editorState.dataAction = DataAction.SAVE;
      this.logger.info("saving", this.content?.name, "content", "this.editorState", this.editorState);
      return this.contentTextService.createOrUpdate(this.content).then((data) => {
          this.content = data;
          this.originalContent = cloneDeep(this.content);
          this.logger.info(this.content?.name, "content retrieved:", this.content);
          this.editorState.dataAction = DataAction.NONE;
          this.logger.info("saved", this.content, "content", "this.editorState", this.editorState);
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_SYNCED, this.content));
          this.saved.emit(data);
          this.syncUnsavedTracker();
          return this.content;
        }
      );
    }
  }

  private tracksIndependentSaves(): boolean {
    return this.canSave() && !this.presentationMode;
  }

  private unsavedDescription(): string {
    return this.description || this.content?.name || "content";
  }

  private syncUnsavedTracker(): void {
    if (!this.tracksIndependentSaves()) {
      this.contentTextUnsavedChanges.clear(this.unsavedTrackerId);
      return;
    }
    if (this.dirty()) {
      this.contentTextUnsavedChanges.setUnsaved({
        id: this.unsavedTrackerId,
        description: this.unsavedDescription(),
        discard: () => this.revert()
      });
    } else {
      this.contentTextUnsavedChanges.clear(this.unsavedTrackerId);
    }
  }

  saving(): boolean {
    return this.editorState.dataAction === DataAction.SAVE;
  }

  showing(): boolean {
    return this.show;
  }

  toggleShowHide(): void {
    this.show = !this.show;
    this.uiActionsService.saveValueFor(this.hideParameterName, !this.show);
  }

  showHideCaption(): string {
    return `${this.show ? "Hide " : "Show "}${this.description}`;
  }

  querying(): boolean {
    return this.editorState.dataAction === DataAction.QUERY;
  }

  delete() {
    this.contentTextService.delete(this.content).then((removed) => {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_DELETED, removed));
    });
  }

  canDelete() {
    return this.deleteEnabled && this.content.id;
  }

  canSave() {
    return this.saveEnabled;
  }

  onTiptapValueChange(markdown: string) {
    this.content.text = markdown;
    this.changeText();
  }

  changeText() {
    this.logger.debug("changeText for:", this.content?.name);
    this.broadcastChange();
    this.updateMarkdownPreviewForTooltip();
    this.syncUnsavedTracker();
  }

  insertField(field: InsertableField) {
    const current = this.content.text || "";
    const spacer = current && !current.endsWith("\n") && !current.endsWith(" ") ? " " : "";
    this.content.text = `${current}${spacer}${field.value}`;
    this.changeText();
  }

  formatSplit() {
    const parts = this.tiptapEditor?.splitMarkdownAtSelection() || {
      before: this.content.text || "",
      selected: "",
      after: ""
    };
    if (parts.selected) {
      this.content.text = `${parts.before}${parts.after}`.trim();
      this.changeText();
      this.split.emit({textBefore: "", textAfter: parts.selected});
      return;
    }
    this.content.text = parts.before;
    this.changeText();
    this.split.emit({textBefore: "", textAfter: parts.after});
  }

  private broadcastChange() {
    if (this.editorState?.view === View.VIEW) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.content));
    }
    this.changed.emit(this.content);
  }

  siteEditActive(): boolean {
    return this.siteEditService.active();
  }

  canEditContent(): boolean {
    if (this.presentationMode) {
      return false;
    }
    return this.siteEditService.active() || this.editorState?.view === View.EDIT;
  }

  editingContent(): boolean {
    return this.siteEditService.active() || this.editorState?.view === View.EDIT;
  }

  undoTooltip(): string {
    return this.description ? `Undo changes to ${this.description}` : "Undo";
  }

  redoTooltip(): string {
    return this.description ? `Redo changes to ${this.description}` : "Redo";
  }

  renderInline(): boolean {
    const currentClass = this.content?.styles?.class;
    return currentClass === TextStyle.AS_BUTTON || currentClass === TextStyle.AS_BUTTON_WARNING;
  }

  contentStyleClasses() {
    const defaultStyles: HasStyles = this.systemConfigService.defaultHasStyles();
    const effectiveStyles: ContentTextStyles = (this.content?.styles ?? {}) as ContentTextStyles;
    const listKey = effectiveStyles?.list || this.systemConfig?.globalStyles?.list || defaultStyles.list;
    const listStyle = ListStyleMappings[listKey];
    const styleClass = effectiveStyles?.class || null;
    const panelClass = styleClass && !this.renderInline() ? "background-panel" : null;
    const contentStyle = [styleClass, panelClass].filter(Boolean).join(" ") || null;
    const linkStyle = this.systemConfig?.globalStyles?.link || defaultStyles.link;
    const classes = [listStyle, contentStyle, linkStyle].filter(Boolean).join(" ");
    return classes;
  }

  isOnThisPage(contentPath: string): boolean {
    return this.urlService.pathContains(contentPath);
  }

  hasDefaultContent(): boolean {
    return this.content?.name && this.dataPopulationService.hasDefaultContent(this.content?.category, this.content?.name);
  }

  loadDefault(): void {
    const defaultText = this.dataPopulationService.defaultContent(this.content?.category, this.content?.name);
    if (defaultText) {
      this.content.text = defaultText;
      this.changeText();
    }
  }

  private pasteCursorPosition(): { start: number; end: number } {
    const parts = this.tiptapEditor?.splitMarkdownAtSelection();
    if (parts) {
      return {
        start: parts.before.length,
        end: parts.before.length + parts.selected.length
      };
    }
    const length = (this.content.text || "").length;
    return {start: length, end: length};
  }

  async onTiptapRawPaste(event: { text: string; html?: string; consume: () => void }): Promise<void> {
    const pastedHtml = event.html || "";
    const pastedText = event.text || "";
    if (pastedHtml || pastedText) {
      const rawText = pastedText.trim();
      const plain = rawText.replace(/\\([#\-*_[\](){}])/g, "$1");
      const looksLikeMarkdown = this.pasteDetectionService.looksLikeMarkdown(plain);
      const hasImages = this.pasteDetectionService.hasMarkdownImages(plain);
      const isLocalPath = this.pasteDetectionService.isLocalPath(plain);
      const isViewSource = this.pasteDetectionService.isViewSourceUrl(plain) && !pastedHtml;
      const leaveForMarkdownInsert = looksLikeMarkdown && !hasImages;

      if (!isLocalPath && !leaveForMarkdownInsert) {
        if (isViewSource) {
          event.consume();
          this.pasteProcessing = true;
          const cleanedUrl = plain.replace(/^view-source:/i, "");
          try {
            const response = await this.contentConversionService.htmlFromUrl(cleanedUrl);
            const resolvedBase = response?.baseUrl ? this.ensureTrailingSlash(response.baseUrl) : this.ensureTrailingSlash(cleanedUrl);
            this.pastePromptPosition = this.pasteCursorPosition();
            this.pastePromptHtmlDetected = true;
            this.pastePromptHtml = response.html;
            this.pastePromptMarkdown = "";
            const baseUrls = new Set([resolvedBase, ...this.pastePromptBaseUrls]);
            this.pastePromptBaseUrls = Array.from(baseUrls);
            this.pastePromptBaseUrl = resolvedBase;
            this.pastePromptErrorMessage = "";
            this.pastePromptHtmlPreview = null;
            this.pastePromptPreviewBaseUrl = this.pastePromptBaseUrl;
            this.pasteProcessing = false;
            this.pastePromptVisible = true;
          } catch (e) {
            this.logger.error("Failed to fetch HTML for pasted URL", cleanedUrl, e);
            this.pasteProcessing = false;
          }
        } else {
          const hasSignificantHtml = this.pasteDetectionService.isSignificantHtml(pastedHtml || "", plain);
          this.logger.info("onTiptapRawPaste: hasSignificantHtml =", hasSignificantHtml, "looksLikeMarkdown =", looksLikeMarkdown);

          if (hasSignificantHtml && !looksLikeMarkdown) {
            this.logger.info("Significant HTML paste detected, showing prompt for base URL");
            event.consume();
            this.pasteProcessing = true;
            this.pastePromptPosition = this.pasteCursorPosition();
            this.pastePromptHtmlDetected = true;
            this.pastePromptHtml = pastedHtml;
            this.pastePromptMarkdown = "";
            this.pastePromptErrorMessage = "";
            this.pastePromptHtmlPreview = null;
            this.preparePastePromptBaseUrl();
            this.pastePromptCreateNested = (this.parentRowColumnCount || 1) > 1;
            this.pasteProcessing = false;
            this.pastePromptVisible = true;
          } else if (hasImages) {
            this.logger.info("Markdown images detected, showing split prompt");
            event.consume();
            this.pasteProcessing = true;
            this.pastePromptPosition = this.pasteCursorPosition();
            this.pastePromptHtmlDetected = false;
            this.pastePromptHtml = null;
            this.pastePromptMarkdown = plain;
            this.pastePromptErrorMessage = "";
            this.pastePromptHtmlPreview = null;
            this.pastePromptMarkdownPreview = null;

            try {
              const preview = await this.contentConversionService.markdownPastePreview(plain);
              this.pastePromptMarkdownPreview = preview;
              this.logger.info("Markdown paste preview:", this.stringUtilsService.pluraliseWithCount(preview.rows?.length, "row"));
            } catch (error) {
              this.logger.error("Failed to build markdown paste preview", error);
            }

            this.pastePromptCreateNested = (this.parentRowColumnCount || 1) > 1;
            this.pasteProcessing = false;
            this.pastePromptVisible = true;
          }
        }
      } else if (leaveForMarkdownInsert) {
        this.logger.info("onTiptapRawPaste: plain text looks like markdown — leave paste for TipTap markdown insert");
      }
    }
  }

  private preparePastePromptBaseUrl(): void {
    if (!this.pastePromptBaseUrl && this.pastePromptBaseUrls.length > 0) {
      this.pastePromptBaseUrl = this.pastePromptBaseUrls[0];
    }
  }

  pastePromptBaseUrlChanged(baseUrl: string): void {
    if (baseUrl === "__custom__") {
      this.pastePromptShowCustomUrlInput = true;
      this.pastePromptCustomUrl = this.pastePromptCustomUrl || "";
      this.pastePromptBaseUrl = this.ensureTrailingSlash(this.pastePromptCustomUrl);
    } else {
      this.pastePromptShowCustomUrlInput = false;
      this.pastePromptBaseUrl = this.ensureTrailingSlash(baseUrl || "");
    }
    this.pastePromptErrorMessage = "";
    this.pastePromptHtmlPreview = null;
    this.pastePromptPreviewBaseUrl = this.pastePromptBaseUrl;
    this.updateSaveToConfigPrompt();
  }

  pastePromptCustomUrlChanged(customUrl: string): void {
    this.pastePromptCustomUrl = customUrl;
    this.pastePromptBaseUrl = this.ensureTrailingSlash(customUrl || "");
    this.pastePromptErrorMessage = "";
    this.pastePromptHtmlPreview = null;
    this.pastePromptPreviewBaseUrl = this.pastePromptBaseUrl;
    this.updateSaveToConfigPrompt();
  }

  private updateSaveToConfigPrompt(): void {
    const trimmedUrl = this.pastePromptBaseUrl.trim();
    const isCustom = trimmedUrl && !this.pastePromptBaseUrls.includes(this.ensureTrailingSlash(trimmedUrl));
    this.pastePromptShowSaveToConfigPrompt = isCustom;
    if (!isCustom) {
      this.pastePromptSaveToConfig = false;
    }
  }

  private ensureTrailingSlash(baseUrl: string): string {
    if (!baseUrl) {
      return "";
    }
    const trimmed = baseUrl.trim();
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }

  displayBaseUrl(): string {
    if (!this.pastePromptBaseUrl) {
      return "";
    }
    return this.pastePromptBaseUrl.endsWith("/") ? this.pastePromptBaseUrl.slice(0, -1) : this.pastePromptBaseUrl;
  }

  private async loadHtmlPreview(): Promise<HtmlPastePreview | null> {
    if (!this.pastePromptHtml) {
      return null;
    }

    if (this.pastePromptHtmlPreview && this.pastePromptPreviewBaseUrl === this.pastePromptBaseUrl) {
      return this.pastePromptHtmlPreview;
    }

    try {
      const preview = await this.contentConversionService.htmlPastePreview(this.pastePromptHtml, this.pastePromptBaseUrl);
      this.logger.info("HTML paste preview:", this.stringUtilsService.pluraliseWithCount(preview.rows?.length, "row"));
      this.pastePromptHtmlPreview = preview;
      this.pastePromptPreviewBaseUrl = this.pastePromptBaseUrl;
      this.pastePromptErrorMessage = "";
      return preview;
    } catch (error) {
      this.logger.error("Failed to build HTML paste preview", error);
      this.pastePromptErrorMessage = "Unable to convert the HTML. Please check the base URL or try again.";
      return null;
    }
  }

  private async loadMarkdownPreview(): Promise<HtmlPastePreview | null> {
    if (!this.pastePromptMarkdown) {
      return null;
    }

    if (this.pastePromptMarkdownPreview) {
      return this.pastePromptMarkdownPreview;
    }

    try {
      const preview = await this.contentConversionService.markdownPastePreview(this.pastePromptMarkdown);
      this.logger.info("Markdown paste preview:", this.stringUtilsService.pluraliseWithCount(preview.rows?.length, "row"));
      this.pastePromptMarkdownPreview = preview;
      this.pastePromptErrorMessage = "";
      return preview;
    } catch (error) {
      this.logger.error("Failed to build markdown paste preview", error);
      this.pastePromptErrorMessage = "Unable to process the paste. Please try again.";
      return null;
    }
  }

  async pasteAsRows(): Promise<void> {
    if (!this.pastePromptPosition) {
      return;
    }

    this.pastePromptErrorMessage = "";

    const preview = this.pastePromptHtmlDetected
      ? await this.loadHtmlPreview()
      : await this.loadMarkdownPreview();

    if (!preview || !preview.rows || preview.rows.length === 0) {
      this.hidePastePrompt();
      return;
    }

    const [firstRow, ...additionalRows] = preview.rows;
    const {start, end} = this.pastePromptPosition;
    const value = this.content.text || "";
    const beforeCursor = value.substring(0, start);
    const afterCursor = value.substring(end);
    const firstText = firstRow?.text || "";

    this.content.text = beforeCursor + firstText + afterCursor;
    this.changeText();

    this.htmlPaste.emit({
      firstRow: firstRow || null,
      additionalRows,
      createNested: this.pastePromptCreateNested ?? undefined
    });

    await this.saveCustomUrlToConfigIfNeeded();
    this.hidePastePrompt();
  }

  async pasteAsIs(): Promise<void> {
    if (!this.pastePromptPosition) {
      return;
    }

    this.pastePromptErrorMessage = "";

    const preview = this.pastePromptHtmlDetected
      ? await this.loadHtmlPreview()
      : await this.loadMarkdownPreview();

    if (!preview || !preview.markdown) {
      if (!this.pastePromptErrorMessage) {
        this.pastePromptErrorMessage = "Unable to convert content. Please try again.";
      }
      return;
    }

    const {start, end} = this.pastePromptPosition;
    const value = this.content.text || "";
    const beforeCursor = value.substring(0, start);
    const afterCursor = value.substring(end);
    const textToPaste = preview.markdown;

    this.content.text = beforeCursor + textToPaste + afterCursor;
    this.changeText();

    await this.saveCustomUrlToConfigIfNeeded();
    this.hidePastePrompt();
  }

  private async saveCustomUrlToConfigIfNeeded(): Promise<void> {
    if (!this.pastePromptSaveToConfig || !this.pastePromptBaseUrl) {
      return;
    }

    try {
      const migrationConfigService = this.injector.get(MigrationConfigService);
      const currentConfig = await this.config.queryConfig(ConfigKey.MIGRATION, { sites: [] });

      const newSite = migrationConfigService.emptySiteMigrationConfig();
      newSite.name = new URL(this.pastePromptBaseUrl).hostname;
      newSite.baseUrl = this.pastePromptBaseUrl;
      newSite.siteIdentifier = new URL(this.pastePromptBaseUrl).hostname.replace(/\./g, "-");

      currentConfig.sites = currentConfig.sites || [];
      currentConfig.sites.push(newSite);

      await migrationConfigService.saveConfig(currentConfig);
      this.logger.info("Saved new migration config for:", this.pastePromptBaseUrl);
      migrationConfigService.refreshConfig();
    } catch (error) {
      this.logger.error("Failed to save migration config:", error);
    }
  }

  hidePastePrompt(): void {
    this.pastePromptVisible = false;
    this.pasteProcessing = false;
    this.pastePromptMarkdown = "";
    this.pastePromptPosition = null;
    this.pastePromptHtmlDetected = false;
    this.pastePromptHtml = null;
    this.pastePromptErrorMessage = "";
    this.pastePromptHtmlPreview = null;
    this.pastePromptMarkdownPreview = null;
    this.pastePromptPreviewBaseUrl = "";
    this.pastePromptIsConversion = false;
    this.pastePromptShowCustomUrlInput = false;
    this.pastePromptCustomUrl = "";
    this.pastePromptShowSaveToConfigPrompt = false;
    this.pastePromptSaveToConfig = false;
  }

  hasImagesInCurrentContent(): boolean {
    const text = this.content?.text || "";
    return this.pasteDetectionService.hasMarkdownImages(text);
  }

  private updateMarkdownPreviewForTooltip(): void {
    const text = this.content?.text || "";
    const hasImages = this.pasteDetectionService.hasMarkdownImages(text);

    if (hasImages) {
      this.contentConversionService.markdownPastePreview(text)
        .then(preview => {
          this.pastePromptMarkdownPreview = preview;
        })
        .catch(error => {
          this.logger.info("Failed to build preview for tooltip", error);
        });
    } else {
      this.pastePromptMarkdownPreview = null;
    }
  }

  convertToRowsTooltip(): string {
    if (this.pastePromptMarkdownPreview?.rows && this.pastePromptMarkdownPreview.rows.length > 0) {
      return `Convert this content into ${this.stringUtilsService.pluraliseWithCount(this.pastePromptMarkdownPreview.rows.length, "row")}`;
    } else {
      return "Convert text with images into rows";
    }
  }

  async showConvertToRowsPreview(): Promise<void> {
    const text = this.content?.text || "";
    if (!text || !this.hasImagesInCurrentContent()) {
      return;
    }

    this.pastePromptPosition = {start: 0, end: text.length};
    this.pastePromptHtmlDetected = false;
    this.pastePromptHtml = null;
    this.pastePromptMarkdown = text;
    this.pastePromptErrorMessage = "";
    this.pastePromptHtmlPreview = null;
    this.pastePromptMarkdownPreview = null;
    this.pastePromptIsConversion = true;

    try {
      const preview = await this.contentConversionService.markdownPastePreview(text);
      this.pastePromptMarkdownPreview = preview;
      this.logger.info("Convert to rows preview:", this.stringUtilsService.pluraliseWithCount(preview.rows?.length, "row"));
    } catch (error) {
      this.logger.error("Failed to build conversion preview", error);
      this.pastePromptErrorMessage = "Unable to preview conversion. Please try again.";
    }

    this.pastePromptCreateNested = (this.parentRowColumnCount || 1) > 1;
    this.pastePromptVisible = true;
  }
}
