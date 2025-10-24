import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import {
  faAngleDown,
  faAngleUp,
  faBold,
  faCircleCheck,
  faCode,
  faEraser,
  faHeading,
  faImage,
  faItalic,
  faLink,
  faListOl,
  faListUl,
  faMagnifyingGlass,
  faPencil,
  faQuoteRight,
  faRefresh,
  faRemove,
  faRotateLeft,
  faScissors,
  faSpinner,
  faUnlink
} from "@fortawesome/free-solid-svg-icons";
import { cloneDeep, isEmpty, isEqual, pick } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import {
  ContentText,
  ContentTextUsage,
  ContentTextUsageWithTracking,
  DataAction,
  EditorInstanceState,
  EditorState,
  HasStyles,
  ListStyle,
  ListStyleMappings,
  View
} from "../models/content-text.model";
import { BroadcastService } from "../services/broadcast-service";
import { ContentTextService } from "../services/content-text.service";
import { ContentConversionService } from "../services/content-conversion.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { MarkdownEditorFocusService } from "../services/markdown-editor-focus-service";
import { MigrationConfigService } from "../services/migration/migration-config.service";
import { SiteEditService } from "../site-edit/site-edit.service";
import { UiActionsService } from "../services/ui-actions.service";
import { StoredValue } from "../models/ui-actions";
import { StringUtilsService } from "../services/string-utils.service";
import { PasteDetectionService } from "../services/paste-detection.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { BadgeButtonComponent } from "../modules/common/badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FormsModule } from "@angular/forms";
import { MarkdownComponent } from "ngx-markdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { KebabCasePipe } from "../pipes/kebabcase.pipe";
import { DuplicateContentDetectionService } from "../services/duplicate-content-detection-service";
import { ALERT_WARNING } from "../models/alert-target.model";
import { UrlService } from "../services/url.service";
import { SystemConfig } from "../models/system.model";
import { Subscription } from "rxjs";
import { DataPopulationService } from "../pages/admin/data-population.service";
import { SystemConfigService } from "../services/system/system-config.service";
import { HtmlPastePreview, HtmlPasteResult } from "../models/html-paste.model";

@Component({
  selector: "app-markdown-editor",
  styles: [`
    .markdown-textarea
      margin-top: 6px
      margin-bottom: 12px
      min-width: 100%

    .background-panel
      border-radius: 6px
      padding: 16px

    .markdown-context-menu
      position: fixed
      background: white
      border: 1px solid #ccc
      border-radius: 4px
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15)
      z-index: 10000
      min-width: 200px

    .context-menu-item
      padding: 8px 12px
      cursor: pointer
      display: flex
      align-items: center

      &:hover
        background-color: #f0f0f0

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
    @if (siteEditActive()) {
      <div class="row">
        <div class="col-12">
          @if (buttonsAvailableOnlyOnFocus && !hideEditToggle) {
            <app-badge-button
              (click)="componentHasFocus() ? toggleToView() : toggleToEdit()" delay=500
              [tooltip]="(componentHasFocus()? 'Exit edit' : 'Edit') + ' content for ' + description"
              [icon]="faPencil" [caption]="componentHasFocus() ? 'Exit edit' : 'Edit'">
            </app-badge-button>
          }
          @if (!buttonsAvailableOnlyOnFocus || componentHasFocus()) {
            <ng-content select="[prepend]"/>
            @if (editorState.view && !hideEditToggle) {
              <app-badge-button (click)="toggleEdit()" delay=500 [tooltip]="tooltip()"
                                [icon]="icon()"
                                [caption]="nextActionCaption()"/>
            }
            @if (dirty() && canSave()) {
              <app-badge-button (click)="save()" [tooltip]="'Save content for ' + description"
                                delay=500 [icon]="saving() ? faSpinner: faCircleCheck"
                                [caption]="'save'"/>
            }
            @if (hasDefaultContent()) {
              <app-badge-button (click)="loadDefault()"
                                delay=500 [tooltip]="'Load default content for ' + description"
                                [icon]="faRefresh" caption="default"/>
            }
            @if (dirty() && !saving() && editorState.view !== 'edit') {
              <app-badge-button (click)="revert()"
                                delay=500 [tooltip]="'Revert content for ' + description"
                                [icon]="reverting() ? faSpinner: faRemove" caption="revert"/>
            }
            @if (canDelete() && !saving()) {
              <app-badge-button (click)="delete()" delay=500
                                [tooltip]="'Delete content for ' + description"
                                [icon]="reverting() ? faSpinner: faEraser"
                                caption="delete"/>
            }
            <ng-content select=":not([prepend])"/>
          }
        </div>
        @if (editNameEnabled) {
          <div class="col-12">
            <label class="mt-2 mt-3" [for]="'input-'+ content.name | kebabCase">Content name</label>
            <input [(ngModel)]="content.name"
                   [id]="'input-'+ content.name | kebabCase"
                   type="text" class="form-control input-sm"
                   placeholder="Enter name of content">
            <label class="mt-2 mt-3" [for]="content.name">Content for {{ content.name }}</label>
          </div>
        }
      </div>
    }
    @if (showing() && editorState.view === 'view') {
      @if (renderInline()) {
        <span [class]="content?.styles?.class"
              (click)="toggleEdit()" markdown ngPreserveWhitespaces [data]="content.text">
              </span>
      }
      @if (!renderInline()) {
        <div [class]="contentStyleClasses()"
             (click)="toggleEdit()" markdown ngPreserveWhitespaces [data]="content.text">
        </div>
      }
    }
    @if (allowHide && editorState.view === 'view') {
      <div class="badge-button"
           (click)="toggleShowHide()" [tooltip]="showHideCaption()">
        <fa-icon [icon]="showing() ? faAngleUp:faAngleDown"/>
        <span>{{ showHideCaption() }}</span>
      </div>
    }
    @if (editorState.view === 'edit') {
      <div class="d-flex align-items-center flex-wrap mt-2">
        <div class="btn-group btn-group-sm flex-wrap" role="group">
          @if (dirty() && !saving()) {
            <button class="btn btn-outline-secondary btn-sm" type="button" (click)="revert()"
                    [tooltip]="'Revert content for ' + description" container="body">
              <fa-icon [icon]="reverting() ? faSpinner : faRotateLeft" [spin]="reverting()"/>
            </button>
          }
          <div class="btn-group btn-group-sm" dropdown>
            <button class="btn btn-outline-secondary btn-sm dropdown-toggle" dropdownToggle type="button"
                    tooltip="Make selection a Heading" container="body">
              <fa-icon [icon]="faHeading"/>
            </button>
            <ul *dropdownMenu class="dropdown-menu">
              <li><a class="dropdown-item" (click)="formatHeadingLevel(1)">Heading 1</a></li>
              <li><a class="dropdown-item" (click)="formatHeadingLevel(2)">Heading 2</a></li>
              <li><a class="dropdown-item" (click)="formatHeadingLevel(3)">Heading 3</a></li>
              <li><a class="dropdown-item" (click)="formatHeadingLevel(4)">Heading 4</a></li>
              <li><a class="dropdown-item" (click)="formatHeadingLevel(5)">Heading 5</a></li>
              <li><a class="dropdown-item" (click)="formatHeadingLevel(6)">Heading 6</a></li>
            </ul>
          </div>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatBold()"
                  tooltip="Make selection Bold" container="body">
            <fa-icon [icon]="faBold"/>
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatItalic()"
                  tooltip="Make selection Italic" container="body">
            <fa-icon [icon]="faItalic"/>
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatCode()"
                  tooltip="Make selection Code" container="body">
            <fa-icon [icon]="faCode"/>
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatQuote()"
                  tooltip="Make selection a Quotation" container="body">
            <fa-icon [icon]="faQuoteRight"/>
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatList('ul')"
                  tooltip="Make selection a Bulleted List" container="body">
            <fa-icon [icon]="faListUl"/>
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatList('ol')"
                  tooltip="Make selection a Numbered List" container="body">
            <fa-icon [icon]="faListOl"/>
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatLink()"
                  tooltip="Make selection a Link" container="body">
            <fa-icon [icon]="faLink"/>
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="formatSplit()"
                  tooltip="Split text into new row below" container="body">
            <fa-icon [icon]="faScissors"/>
          </button>
          @if (hasImagesInCurrentContent()) {
            <button class="btn btn-outline-secondary btn-sm" type="button" (click)="showConvertToRowsPreview()"
                    [tooltip]="convertToRowsTooltip()" container="body">
              <fa-icon [icon]="faImage"/>
            </button>
          }
        </div>
      </div>
      <textarea #textArea [wrap]="'hard'"
                [(ngModel)]="content.text"
                (ngModelChange)="changeText($event)"
                (input)="autoResize(textArea)"
                (contextmenu)="onContextMenu($event)"
                (paste)="onPaste($event)"
                class="form-control markdown-textarea"
                [style.overflow]="'hidden'" [rows]="1"
                placeholder="Enter {{description}} text here">
          </textarea>
      @if (contextMenuVisible) {
        <div class="markdown-context-menu"
             [style.left.px]="contextMenuX"
             [style.top.px]="contextMenuY"
             (click)="$event.stopPropagation()"
             (mouseleave)="hideContextMenu()">
          <div class="context-menu-item" (click)="formatSplitFromContextMenu()">
            <fa-icon [icon]="faScissors"/>
            <span class="ms-2">Split text into new row below</span>
          </div>
        </div>
      }
      @if (pasteProcessing && !pastePromptVisible) {
        <div class="paste-processing-indicator">
          <fa-icon [icon]="faSpinner" [spin]="true"/>
          <span>Processing paste...</span>
        </div>
      }
      @if (pastePromptVisible) {
        <div class="paste-prompt-overlay" (click)="hidePastePrompt()">
          <div class="paste-prompt" (click)="$event.stopPropagation()">
            <div class="paste-prompt-header">
              @if (pastePromptHtmlDetected) {
                <strong>HTML content detected</strong>
              }
              @if (!pastePromptHtmlDetected) {
                <strong>Markdown with images detected</strong>
              }
            </div>
            <div class="paste-prompt-body">
              @if (pastePromptHtmlDetected) {
                <p>Select a base URL for resolving relative image paths:</p>
                <div class="mb-3">
                  <input
                    type="text"
                    class="form-control"
                    [attr.list]="pastePromptBaseUrls.length > 0 ? 'pastePromptBaseUrlOptions' : null"
                    [ngModel]="displayBaseUrl()"
                    (ngModelChange)="pastePromptBaseUrlChanged($event)"
                    placeholder="https://example.com/path">
                  @if (pastePromptBaseUrls.length > 0) {
                    <datalist id="pastePromptBaseUrlOptions">
                      @for (baseUrl of pastePromptBaseUrls; track baseUrl) {
                        <option [value]="baseUrl"></option>
                      }
                    </datalist>
                  }
                  @if (pastePromptErrorMessage) {
                    <div class="text-danger small mt-2">{{ pastePromptErrorMessage }}</div>
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
    }
    @if (siteEditActive() && duplicateContentDetectionService.isDuplicate(content?.id)) {
      <div class="alert alert-warning">
        <fa-icon [icon]="ALERT_WARNING.icon"/>
        <b class="ms-2">Content duplicated in</b>
        <ul>
          @for (usage of contentTextUsageTrackerMapper(duplicateContentDetectionService.contentTextUsages(content?.id)); track usage.tracking) {
            <li>
              @if (isOnThisPage(usage.contentPath)) {
                <div>Row {{ usage.row }}, Column {{ usage.column }} on {{ clarifyPage(usage.contentPath) }}</div>
              } @else {
                Row {{ usage.row }}, Column {{ usage.column }} on
                <a (click)="navigateToUsage(usage)" [href]="usage.contentPath">{{ clarifyPage(usage.contentPath) }}</a>
              }
            </li>
          }
        </ul>
        <app-badge-button class="ms-2" (click)="unlink()" delay=500
                          [tooltip]="'Unlink and save as new content for ' + description"
                          [icon]="reverting() ? faSpinner: faUnlink" caption="unlink"/>
      </div>
    }
  `,
  imports: [BadgeButtonComponent, TooltipDirective, FormsModule, MarkdownComponent, FontAwesomeModule, KebabCasePipe, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective]
})
export class MarkdownEditorComponent implements OnInit, OnDestroy {
  @ViewChild("textArea") textArea?: ElementRef<HTMLTextAreaElement>;

  @Input("presentationMode") set presentationModeValue(presentationMode: boolean) {
    this.presentationMode = coerceBooleanProperty(presentationMode);
  }

  @Input("editNameEnabled") set acceptEditNameEnabledChangesFrom(editNameEnabled: boolean) {
    this.logger.debug("editNameEnabled:", editNameEnabled);
    this.editNameEnabled = editNameEnabled;
  }

  @Input("text") set acceptTextChangesFrom(text: string) {
    this.logger.debug("text:", text);
    this.text = text;
    this.syncContent();
  }

  @Input("name") set acceptNameChangesFrom(name: string) {
    this.logger.debug("acceptNameChangesFrom:name:", name);
    this.name = name;
    this.syncContent();
  }

  @Input("category") set acceptCategoryChangesFrom(category: string) {
    this.logger.debug("category:", category);
    this.category = category;
    this.syncContent();
  }

  @Input("noSave") set noImageSaveValue(noSave: boolean) {
    this.noSave = coerceBooleanProperty(noSave);
  }

  @Input("data") set dataValue(data: ContentText) {
    this.data = data;
    this.setDataAttributes();
  }

  @Input("allowMaximise") set allowMaximiseValue(allowMaximise: boolean) {
    this.allowMaximise = coerceBooleanProperty(allowMaximise);
  }

  @Input("allowSave") set allowSaveValue(allowSave: boolean) {
    this.allowSave = coerceBooleanProperty(allowSave);
  }

  @Input("allowHide") set allowHideValue(allowHide: boolean) {
    this.allowHide = coerceBooleanProperty(allowHide);
  }

  @Input("buttonsAvailableOnlyOnFocus") set buttonsAvailableOnlyOnFocusValue(buttonsAvailableOnlyOnFocus: boolean) {
    this.buttonsAvailableOnlyOnFocus = coerceBooleanProperty(buttonsAvailableOnlyOnFocus);
  }

  @Input("hideEditToggle") set hideEditToggleValue(hideEditToggle: boolean) {
    this.hideEditToggle = coerceBooleanProperty(hideEditToggle);
  }

  @Input("deleteEnabled") set deleteEnabledValue(deleteEnabled: boolean) {
    this.deleteEnabled = coerceBooleanProperty(deleteEnabled);
  }

  @Input("queryOnlyById") set queryOnlyByIdValue(queryOnlyById: boolean) {
    this.queryOnlyById = coerceBooleanProperty(queryOnlyById);
  }

  private logger: Logger = inject(LoggerFactory).createLogger("MarkdownEditorComponent", NgxLoggerLevel.ERROR);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private uiActionsService = inject(UiActionsService);
  private broadcastService = inject<BroadcastService<ContentText>>(BroadcastService);
  private contentTextService = inject(ContentTextService);
  private contentConversionService = inject(ContentConversionService);
  private markdownEditorFocusService = inject(MarkdownEditorFocusService);
  private migrationConfigService = inject(MigrationConfigService);
  protected duplicateContentDetectionService = inject(DuplicateContentDetectionService);
  protected stringUtilsService = inject(StringUtilsService);
  protected siteEditService = inject(SiteEditService);
  private urlService = inject(UrlService);
  private dataPopulationService = inject(DataPopulationService);
  private pasteDetectionService = inject(PasteDetectionService);
  private systemConfig: SystemConfig;
  @Input() id: string;
  @Input() rows: number;
  @Input() actionCaptionSuffix: string;
  @Input() initialView: View;
  @Input() description: string;
  @Input() parentRowColumnCount: number;
  @Output() changed: EventEmitter<ContentText> = new EventEmitter();
  @Output() saved: EventEmitter<ContentText> = new EventEmitter();
  @Output() focusChange: EventEmitter<EditorInstanceState> = new EventEmitter();
  @Output() split: EventEmitter<{
    textBefore: string;
    textAfter: string;
    additionalRows?: string[];
    createNested?: boolean
  }> = new EventEmitter();
  @Output() htmlPaste: EventEmitter<HtmlPasteResult> = new EventEmitter();
  faBold = faBold;
  faItalic = faItalic;
  faLink = faLink;
  faListUl = faListUl;
  faListOl = faListOl;
  faCode = faCode;
  faQuoteRight = faQuoteRight;
  faHeading = faHeading;
  faScissors = faScissors;
  faImage = faImage;
  private presentationMode: boolean;
  public minimumRows = 10;
  public data: ContentText;
  public allowMaximise: boolean;
  public allowSave: boolean;
  public buttonsAvailableOnlyOnFocus: boolean;
  public allowHide: boolean;
  public hideEditToggle: boolean;
  public deleteEnabled: boolean;
  public queryOnlyById: boolean;
  private show = true;
  public editNameEnabled: boolean;
  faSpinner = faSpinner;
  faPencil = faPencil;
  faCircleCheck = faCircleCheck;
  faRemove = faRemove;
  faEraser = faEraser;
  faAngleUp = faAngleUp;
  faAngleDown = faAngleDown;
  protected readonly faUnlink = faUnlink;
  protected readonly faRefresh = faRefresh;
  protected readonly faRotateLeft = faRotateLeft;
  private noSave: boolean;
  private originalContent: ContentText;
  public editorState: EditorState;
  public content: ContentText = {};
  private saveEnabled = false;
  public name: string;
  public text: string;
  public category: string;
  private hideParameterName: StoredValue;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  private subscriptions: Subscription[] = [];
  public contextMenuVisible = false;
  public contextMenuX = 0;
  public contextMenuY = 0;
  private savedSelection: { start: number; end: number; value: string } | null = null;
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

  async ngOnInit() {
    this.logger.debug("ngOnInit:name", this.name, "data:", this.data, "description:", this.description);
    this.hideParameterName = this.stringUtilsService.kebabCase(StoredValue.MARKDOWN_FIELD_HIDDEN, this.name) as StoredValue;
    this.editorState = {
      view: this.initialView || View.VIEW,
      dataAction: DataAction.NONE
    };
    if (this.data) {
      this.setDataAttributes();
    } else if (this.text) {
      this.content = {name: this.name, text: this.text, category: this.category};
      this.originalContent = cloneDeep(this.content);
      this.logger.debug("editing injected content", this.content, "editorState:", this.editorState);
    } else {
      await this.queryContent();
      this.setDescription();
    }
    this.subscriptions.push(this.siteEditService.events.subscribe((item: NamedEvent<boolean>) => {
      this.logger.debug("siteEditService.events.subscribe:", this.name, "this.editorState.view", this.editorState.view, "siteEditService:event", item);
      this.editorState.view = item.data ? View.EDIT : View.VIEW;
    }));
    if (this.allowHide) {
      const currentlyHidden = this.uiActionsService.initialBooleanValueFor(this.hideParameterName, false);
      this.show = !currentlyHidden;
    }
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => this.systemConfig = systemConfig));
    this.subscriptions.push(this.migrationConfigService.migrationConfigEvents().subscribe(config => {
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
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_EDITOR_CREATED, this));

    const clickListener = () => {
      if (this.contextMenuVisible) {
        this.hideContextMenu();
      }
    };
    document.addEventListener("click", clickListener);
    this.subscriptions.push({
      unsubscribe: () => document.removeEventListener("click", clickListener)
    } as Subscription);

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
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_EDITOR_DESTROYED, this));
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public assignListStyleTo(listStyle: ListStyle) {
    this.logger.debug("assignListStyleTo:listStyle:", listStyle, "this.content:", this.content);
    this.initialiseStyles();
    this.content.styles.list = listStyle;
  }

  private initialiseStyles() {
    if (this.content && !this.content?.styles) {
      const styles = {list: null, class: null};
      this.logger.debug("initialiseStyles:for:", this.content, "to:", styles);
      this.content.styles = styles;
    }
  }

  listStyleIs(listStyle: ListStyle): boolean {
    return this.content?.styles?.list === listStyle || (!this.content?.styles && listStyle === ListStyle.ARROW);
  }

  private setDataAttributes() {
    this.logger.debug("setDataAttributes:data:", this.data);
    const existingData: boolean = !!this.data.id;
    this.content = this.data;
    if (!this.noSave) {
      this.saveEnabled = true;
    }
    this.logger.debug("editing:", this.content, "existingData:", existingData, "editorState:", this.editorState, "rows:", this.rows);
    this.originalContent = cloneDeep(this.content);
    this.setDescription();
    this.calculateRows();
    this.updateMarkdownPreviewForTooltip();
  }

  private setDescription() {
    if (!this.description) {
      this.description = this.content.name;
    }
  }

  queryContent(): Promise<ContentText> {
    this.editorState.dataAction = DataAction.QUERY;
    if (this.id) {
      this.logger.debug("querying content for id:", this.id, "name:", this.name, "category:", this.category, "editorState:", this.editorState, "id:",);
      return this.contentTextService.getById(this.id)
        .then((content) => {
          return this.apply(content);
        })
        .catch(response => {
          this.logger.error(response);
          return this.apply({});
        });
    } else if (this.queryOnlyById) {
      this.logger.debug("queryOnlyById:true content:name", this.name, "and category:", this.category, "editorState:", this.editorState, "id:", this.id);
      return Promise.resolve(this.apply({}));
    } else if (this.name) {
      this.logger.debug("querying content:name", this.name, "and category:", this.category, "editorState:", this.editorState, "id:", this.id);
      return this.contentTextService.findByNameAndCategory(this.name, this.category).then((content) => {
        return this.apply(content);
      });
    }
  }

  private apply(content: ContentText): ContentText {
    if (isEmpty(content)) {
      if (this.siteEditService.active()) {
        this.logger.debug("content is empty for", this.description, "assumed to be new content so going into edit mode");
      }
      this.syncContent();
    } else {
      this.content = content;
      this.initialiseStyles();
    }
    this.saveEnabled = true;
    this.originalContent = cloneDeep(this.content);
    this.editorState.dataAction = DataAction.NONE;
    this.calculateRows();
    this.deferAutoResize();
    this.updateMarkdownPreviewForTooltip();
    this.logger.debug("retrieved content:", this.content, "editor state:", this.editorState);
    return this.content;
  }

  private calculateRows() {
    this.rows = this.calculateRowsFrom(this.content);
  }

  private syncContent() {
    this.content = {category: this.category, text: this.text, name: this.name};
    this.publishUnsavedChanges();
    this.updateMarkdownPreviewForTooltip();
  }

  revert(): void {
    this.logger.debug("reverting " + this.name, "content");
    this.content = cloneDeep(this.originalContent);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_SYNCED, this));
    this.changed.emit(this.content);
    this.updateMarkdownPreviewForTooltip();
  }

  dirty(): boolean {
    const fields = ["id", "name", "category", "text", "styles"];
    const isDirty = !isEqual(pick(this.content, fields), pick(this.originalContent, fields));
    this.logger.debug("dirty:content", this.content, "originalContent", this.originalContent, "isDirty ->", isDirty);
    return isDirty;
  }

  save(): Promise<ContentText> {
    if (this.saveEnabled && this.editorState.dataAction === DataAction.NONE) {
      this.editorState.dataAction = DataAction.SAVE;
      this.logger.debug("saving", this.name, "content", "this.editorState", this.editorState);
      return this.contentTextService.createOrUpdate(this.content).then((data) => {
          this.content = data;
          this.originalContent = cloneDeep(this.content);
          this.logger.debug(this.name, "content retrieved:", this.content);
          this.editorState.dataAction = DataAction.NONE;
          this.logger.debug("saved", this.content, "content", "this.editorState", this.editorState);
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_SYNCED, this));
          this.saved.emit(data);
          return this.content;
        }
      );
    }
  }

  calculateRowsFrom(data: ContentText): number {
    const text = data?.text;
    const rows = text ? text?.split(/\r*\n/).length + 1 : 1;
    const calculatedRows = Math.max(rows, this.minimumRows);
    this.logger.debug("number of rows in text ", text, "->", rows, "calculatedRows:", calculatedRows);
    return calculatedRows;
  }

  preview(): void {
    this.editorState.view = View.VIEW;
  }

  toggleEdit(): void {
    this.logger.info("toggleEdit called");
    if (this.siteEditService.active() && this.editorState.dataAction !== DataAction.QUERY) {
      const priorState: View = this.editorState.view;
      if (priorState === View.VIEW) {
        this.toggleToEdit();
      } else if (this.editorState.view === View.EDIT) {
        this.toggleToView();
      }
      this.logger.info("toggleEdit: changing state from ", priorState, "to", this.editorState.view);
    }
  }

  toggleToView() {
    this.editorState.view = View.VIEW;
    this.focusChange.emit({view: this.editorState.view, instance: this});
    this.clearFocus();
  }

  toggleToEdit() {
    this.editorState.view = View.EDIT;
    this.focusChange.emit({view: this.editorState.view, instance: this});
    this.setFocus();
    this.deferAutoResize();
  }

  private setFocus() {
    if (this.buttonsAvailableOnlyOnFocus) {
      this.logger.debug("setFocus:", this.description);
      this.markdownEditorFocusService.setFocusTo(this);
    }
  }

  private clearFocus() {
    if (this.buttonsAvailableOnlyOnFocus) {
      this.markdownEditorFocusService.clearFocus(this);
    }
  }

  autoResize(elOrRef?: any) {
    const el: HTMLTextAreaElement | undefined = elOrRef?.nativeElement ? elOrRef.nativeElement : elOrRef;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  private deferAutoResize() {
    setTimeout(() => this.autoResize(this.textArea), 0);
  }

  nextActionCaption(): string {
    return this.editorState.dataAction === DataAction.QUERY ? "Querying" : this.editorState.view === View.VIEW ? this.captionFor(View.EDIT) : this.captionFor(View.VIEW);
  }

  private captionFor(view: View) {
    return view + (this.actionCaptionSuffix ? (" " + this.actionCaptionSuffix) : "");
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

  icon(): IconDefinition {
    return this.editorState.dataAction === DataAction.QUERY ? faSpinner : this.editorState.view === View.VIEW ? faPencil : faMagnifyingGlass;
  }

  tooltip(): string {
    const prefix = this.editorState.dataAction === DataAction.QUERY ? "Querying" : this.editorState.view === View.VIEW ? "Edit" : "Preview";
    return prefix + " content for " + this.description;
  }

  reverting(): boolean {
    return this.editorState.dataAction === DataAction.REVERT;
  }

  unlink() {
    delete this.content.id;
    this.publishUnsavedChanges();
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
    return this.saveEnabled && !this.noSave && this.allowSave !== false;
  }

  changeText($event: any) {
    this.logger.debug("name:", this.name, "content name:", this.content.name, "changeText:", $event);
    this.renameIfRequired();
    this.broadcastChange();
    this.publishUnsavedChanges();
    this.updateMarkdownPreviewForTooltip();
  }

  private selection(): { start: number; end: number; value: string } {
    const el = this.textArea?.nativeElement;
    const start = el?.selectionStart || 0;
    const end = el?.selectionEnd || 0;
    const value = el?.value || "";
    return {start, end, value};
  }

  private replaceSelection(before: string, after: string, transform?: (s: string) => string) {
    const el = this.textArea?.nativeElement;
    const {start, end, value} = this.selection();
    const sel = value.substring(start, end) || "";
    const body = transform ? transform(sel) : sel;
    const updated = value.substring(0, start) + before + body + after + value.substring(end);
    this.content.text = updated;
    this.changeText(updated);
    this.deferAutoResize();
    setTimeout(() => {
      const pos = start + before.length + body.length + after.length;
      el?.setSelectionRange(pos, pos);
      el?.focus();
    }, 0);
  }

  formatHeadingLevel(level: number) {
    const lvl = Math.min(Math.max(level, 1), 6);
    this.transformSelectionLines((line) => {
      const info = this.stripKnownPrefix(line);
      if (info.type === "heading" && info.level === lvl) {
        return info.stripped;
      }
      return "#".repeat(lvl) + " " + info.stripped;
    });
  }

  formatBold() {
    this.replaceSelection("**", "**", s => s || "bold");
  }

  formatItalic() {
    this.replaceSelection("_", "_", s => s || "italic");
  }

  formatCode() {
    this.replaceSelection("`", "`", s => s || "code");
  }

  formatQuote() {
    this.transformSelectionLines((line) => {
      const info = this.stripKnownPrefix(line);
      if (info.type === "quote") {
        return info.stripped;
      }
      return "> " + info.stripped;
    });
  }

  formatList(type: "ul" | "ol") {
    this.transformSelectionLines((line, idx) => {
      const info = this.stripKnownPrefix(line);
      if (type === "ul") {
        if (info.type === "ul") {
          return info.stripped;
        }
        return "- " + info.stripped;
      } else {
        if (info.type === "ol") {
          return info.stripped;
        }
        return `${idx + 1}. ` + info.stripped;
      }
    });
  }

  async formatLink() {
    let url = "url";
    try {
      const clip = await (navigator as any)?.clipboard?.readText?.();
      const text = (clip || "").trim();
      if (/^https?:\/\/\S+$/i.test(text)) {
        url = text;
      }
    } catch {
    }
    this.replaceSelection("[", `](${url})`, s => s || "title");
  }

  formatSplit() {
    const {start, end, value} = this.selection();
    const hasSelection = end > start;

    if (hasSelection) {
      this.splitSelectedTextIntoNewRow(start, end, value);
    } else {
      this.splitAtCursorPosition(start, value);
    }

    this.deferAutoResize();
  }

  private splitSelectedTextIntoNewRow(start: number, end: number, value: string) {
    const textBefore = value.substring(0, start);
    const textAfter = value.substring(end);

    this.content.text = textBefore + textAfter;
    this.changeText(this.content.text);

    const selectedText = value.substring(start, end);
    this.split.emit({textBefore: "", textAfter: selectedText});
  }

  private splitAtCursorPosition(start: number, value: string) {
    const textBefore = value.substring(0, start);
    const textAfter = value.substring(start);

    this.content.text = textBefore;
    this.changeText(this.content.text);

    this.split.emit({textBefore: "", textAfter});
  }

  private applyPrefixToSelectionOrLine(prefix: string, placeholder?: string) {
    const el = this.textArea?.nativeElement;
    const {start, end, value} = this.selection();
    const hasSelection = end > start;
    if (hasSelection) {
      const sel = value.substring(start, end);
      const lines = (sel || placeholder || "").split(/\r?\n/).map(line => prefix + line).join("\n");
      const updated = value.substring(0, start) + lines + value.substring(end);
      this.content.text = updated;
      this.changeText(updated);
      this.deferAutoResize();
      setTimeout(() => {
        const pos = start + lines.length;
        el?.setSelectionRange(pos, pos);
        el?.focus();
      }, 0);
    } else {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEndIdx = value.indexOf("\n", start);
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const current = value.substring(lineStart, lineEnd);
      const content = current || placeholder || "";
      const updatedLine = prefix + content;
      const updated = value.substring(0, lineStart) + updatedLine + value.substring(lineEnd);
      this.content.text = updated;
      this.changeText(updated);
      this.deferAutoResize();
      setTimeout(() => {
        const pos = lineStart + updatedLine.length;
        el?.setSelectionRange(pos, pos);
        el?.focus();
      }, 0);
    }
  }

  private transformSelectionLines(mapper: (line: string, index: number) => string) {
    const el = this.textArea?.nativeElement;
    const {start, end, value} = this.selection();
    const hasSelection = end > start;
    const blockStart = value.lastIndexOf("\n", start - 1) + 1;
    const blockEnd = (value.indexOf("\n", hasSelection ? end : start) === -1 ? value.length : value.indexOf("\n", hasSelection ? end : start));
    const target = value.substring(blockStart, blockEnd);
    const lines = target.split(/\r?\n/);
    const newText = lines.map((line, i) => mapper(line, i)).join("\n");
    const updated = value.substring(0, blockStart) + newText + value.substring(blockEnd);
    this.content.text = updated;
    this.changeText(updated);
    this.deferAutoResize();
    setTimeout(() => {
      const pos = blockStart + newText.length;
      el?.setSelectionRange(pos, pos);
      el?.focus();
    }, 0);
  }

  private stripKnownPrefix(line: string): {
    stripped: string;
    type: "heading" | "quote" | "ul" | "ol" | null;
    level?: number
  } {
    const heading = line.match(/^\s{0,3}(#{1,6})\s+/);
    if (heading) {
      return {stripped: line.replace(/^\s{0,3}#{1,6}\s+/, ""), type: "heading", level: heading[1].length};
    }
    if (/^\s{0,3}>\s+/.test(line)) {
      return {stripped: line.replace(/^\s{0,3}>\s+/, ""), type: "quote"};
    }
    if (/^\s{0,3}[-*+]\s+/.test(line)) {
      return {stripped: line.replace(/^\s{0,3}[-*+]\s+/, ""), type: "ul"};
    }
    if (/^\s{0,3}\d+\.\s+/.test(line)) {
      return {stripped: line.replace(/^\s{0,3}\d+\.\s+/, ""), type: "ol"};
    }
    return {stripped: line, type: null};
  }

  private broadcastChange() {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.content));
    this.changed.emit(this.content);
  }

  private publishUnsavedChanges() {
    const conditionsForSave = this.content.text && this.dirty() && this.siteEditService.active();
    if (conditionsForSave) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_UNSAVED, this));
    } else {
      this.logger.debug("publishUnsavedChanges:conditionsForSave not met:content:", this.content);
    }
  }

  componentHasFocus(): boolean {
    return this.markdownEditorFocusService.hasFocus(this);
  }

  private renameIfRequired() {
    if (this.name !== this.content.name) {
      this.logger.debug("changing name from ", this.content.name, "->", this.name);
      this.content.name = this.name;
    }
    if (this.category !== this.content.category) {
      this.logger.debug("changing category from ", this.content.category, "->", this.category);
      this.content.category = this.category;
    }
  }

  siteEditActive(): boolean {
    if (this.presentationMode) {
      return false;
    } else {
      return this.siteEditService.active();
    }
  }

  renderInline(): boolean {
    return this.content?.styles?.class === "as-button";
  }

  contentStyleClasses() {
    const defaultStyles: HasStyles = this.systemConfigService.defaultHasStyles();
    const listStyle = ListStyleMappings[this.content?.styles?.list || this.systemConfig?.globalStyles?.list || defaultStyles.list];
    const contentStyle = this.content?.styles?.class ? `${this.content?.styles?.class} background-panel` : null;
    const linkStyle = this.systemConfig?.globalStyles?.link || defaultStyles.link;
    const classes = [listStyle, contentStyle, linkStyle].filter(Boolean).join(" ");
    this.logger.off("contentStyleClasses:listStyle:", listStyle, "contentStyle:", contentStyle, "linkStyle:", linkStyle, "classes:", classes);
    return classes;
  }

  navigateToUsage(usage: ContentTextUsage) {
    if (usage.contentPath) {
      this.markdownEditorFocusService.setFocusTo(usage?.editorInstance);
    } else {
      this.markdownEditorFocusService.setFocusTo(usage?.editorInstance);
    }
  }

  contentTextUsageTrackerMapper(usages: ContentTextUsage[]): ContentTextUsageWithTracking[] {
    return usages.map(usage => this.contentTextUsageTracker(usage));
  }

  contentTextUsageTracker(usage: ContentTextUsage): ContentTextUsageWithTracking {
    const tracking = this.stringUtilsService.kebabCase("column", usage.column, "row", usage.row, "path", usage.contentPath);
    return {...usage, tracking};
  }

  clarifyPage(contentPath: string) {
    return this.urlService.pathContains(contentPath) ? "this page" : contentPath;
  }

  isOnThisPage(contentPath: string): boolean {
    return this.urlService.pathContains(contentPath);
  }

  hasDefaultContent(): boolean {
    return this.category && this.name && this.dataPopulationService.hasDefaultContent(this.category, this.name);
  }

  loadDefault(): void {
    const defaultText = this.dataPopulationService.defaultContent(this.category, this.name);
    if (defaultText) {
      this.content.text = defaultText;
      this.changeText(defaultText);
    }
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.saveCurrentSelectionAndShowContextMenu(event.clientX, event.clientY);
  }

  private saveCurrentSelectionAndShowContextMenu(x: number, y: number): void {
    this.savedSelection = this.selection();
    this.contextMenuX = x;
    this.contextMenuY = y;
    this.contextMenuVisible = true;
  }

  hideContextMenu(): void {
    this.contextMenuVisible = false;
    this.savedSelection = null;
  }

  formatSplitFromContextMenu(): void {
    this.restoreSavedSelection();
    this.hideContextMenu();
    setTimeout(() => this.formatSplit(), 0);
  }

  private restoreSavedSelection(): void {
    if (this.savedSelection) {
      const el = this.textArea?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange(this.savedSelection.start, this.savedSelection.end);
      }
    }
  }

  async onPaste(event: ClipboardEvent): Promise<void> {
    const pastedHtml = event.clipboardData?.getData("text/html");
    const pastedText = event.clipboardData?.getData("text/plain");

    if (!pastedHtml && !pastedText) {
      return;
    }

    const rawText = (pastedText || "").trim();
    const plain = rawText.replace(/\\([#\-*_[\](){}])/g, "$1");

    if (this.pasteDetectionService.isLocalPath(plain)) {
      return;
    }

    if (this.pasteDetectionService.isViewSourceOrHttpUrl(plain) && !pastedHtml) {
      event.preventDefault();
      this.pasteProcessing = true;
      const cleanedUrl = plain.replace(/^view-source:/i, "");
      try {
        const response = await this.contentConversionService.htmlFromUrl(cleanedUrl);
        const resolvedBase = response?.baseUrl ? this.ensureTrailingSlash(response.baseUrl) : this.ensureTrailingSlash(cleanedUrl);
        const {start, end} = this.selection();
        this.pastePromptPosition = {start, end};
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
        return;
      } catch (e) {
        this.logger.error("Failed to fetch HTML for pasted URL", cleanedUrl, e);
        this.pasteProcessing = false;
      }
    }

    const hasSignificantHtml = this.pasteDetectionService.isSignificantHtml(pastedHtml || "", plain);
    this.logger.info("onPaste: hasSignificantHtml =", hasSignificantHtml);

    if (hasSignificantHtml) {
      this.logger.info("Significant HTML paste detected, showing prompt for base URL");
      this.logger.info("pastedHtml (first 500 chars):", pastedHtml?.substring(0, 500));
      this.logger.info("pastedText (first 500 chars):", plain.substring(0, 500));
      event.preventDefault();
      this.pasteProcessing = true;

      const {start, end} = this.selection();
      this.pastePromptPosition = {start, end};
      this.pastePromptHtmlDetected = true;
      this.pastePromptHtml = pastedHtml;
      this.pastePromptMarkdown = "";
      this.pastePromptErrorMessage = "";
      this.pastePromptHtmlPreview = null;
      this.preparePastePromptBaseUrl();
      this.pastePromptCreateNested = (this.parentRowColumnCount || 1) > 1;
      this.pasteProcessing = false;
      this.pastePromptVisible = true;
      return;
    }

    const hasImages = this.pasteDetectionService.hasMarkdownImages(plain);
    this.logger.info("onPaste: hasMarkdownImages =", hasImages);

    if (hasImages) {
      this.logger.info("Markdown images detected, showing split prompt");
      event.preventDefault();
      this.pasteProcessing = true;

      const {start, end} = this.selection();
      this.pastePromptPosition = {start, end};
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
      return;
    }
  }

  private preparePastePromptBaseUrl(): void {
    if (!this.pastePromptBaseUrl && this.pastePromptBaseUrls.length > 0) {
      this.pastePromptBaseUrl = this.pastePromptBaseUrls[0];
    }
  }

  pastePromptBaseUrlChanged(baseUrl: string): void {
    this.pastePromptBaseUrl = this.ensureTrailingSlash(baseUrl || "");
    this.pastePromptErrorMessage = "";
    this.pastePromptHtmlPreview = null;
    this.pastePromptPreviewBaseUrl = this.pastePromptBaseUrl;
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
      this.pastePromptErrorMessage = "Unable to convert HTML to markdown. Please check the base URL or try again.";
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
      this.pastePromptErrorMessage = "Unable to process markdown. Please try again.";
      return null;
    }
  }

  pastePromptRowCount(): number {
    if (this.pastePromptHtmlPreview?.rows) {
      return this.pastePromptHtmlPreview.rows.length;
    }
    if (this.pastePromptMarkdownPreview?.rows) {
      return this.pastePromptMarkdownPreview.rows.length;
    }
    return 0;
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
    this.changeText(this.content.text);

    this.deferAutoResize();

    setTimeout(() => {
      const el = this.textArea?.nativeElement;
      if (el) {
        const newPos = beforeCursor.length + firstText.length;
        el.setSelectionRange(newPos, newPos);
        el.focus();
      }
    }, 0);

    this.htmlPaste.emit({
      firstRow: firstRow || null,
      additionalRows,
      createNested: this.pastePromptCreateNested ?? undefined
    });

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
    this.changeText(this.content.text);

    this.deferAutoResize();

    setTimeout(() => {
      const el = this.textArea?.nativeElement;
      if (el) {
        const newPos = beforeCursor.length + textToPaste.length;
        el.setSelectionRange(newPos, newPos);
        el.focus();
      }
    }, 0);

    this.hidePastePrompt();
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
          this.logger.debug("Failed to build preview for tooltip", error);
        });
    } else {
      this.pastePromptMarkdownPreview = null;
    }
  }

  convertToRowsTooltip(): string {
    if (this.pastePromptMarkdownPreview?.rows && this.pastePromptMarkdownPreview.rows.length > 0) {
      return `Convert this content into ${this.stringUtilsService.pluraliseWithCount(this.pastePromptMarkdownPreview.rows.length, "row")}`;
    } else {
      return "Convert markdown with images into rows";
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
