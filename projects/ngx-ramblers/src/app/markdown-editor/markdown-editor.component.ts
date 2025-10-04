import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import {
  faAngleDown,
  faAngleUp,
  faCircleCheck,
  faEraser,
  faMagnifyingGlass,
  faPencil,
  faRefresh,
  faRemove,
  faSpinner,
  faUnlink
} from "@fortawesome/free-solid-svg-icons";
import { cloneDeep } from "es-toolkit/compat";
import { isEmpty } from "es-toolkit/compat";
import { isEqual } from "es-toolkit/compat";
import { pick } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import {
  ContentText,
  ContentTextUsage,
  ContentTextUsageWithTracking,
  DataAction,
  EditorInstanceState,
  EditorState, HasStyles,
  ListStyle,
  ListStyleMappings,
  View
} from "../models/content-text.model";
import { BroadcastService } from "../services/broadcast-service";
import { ContentTextService } from "../services/content-text.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { MarkdownEditorFocusService } from "../services/markdown-editor-focus-service";
import { SiteEditService } from "../site-edit/site-edit.service";
import { UiActionsService } from "../services/ui-actions.service";
import { StoredValue } from "../models/ui-actions";
import { StringUtilsService } from "../services/string-utils.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { BadgeButtonComponent } from "../modules/common/badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
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
  `],
  template: `
    @if (siteEditActive()) {
      <div class="row">
        <div class="col-12">
          @if (buttonsAvailableOnlyOnFocus) {
            <app-badge-button
              (click)="componentHasFocus() ? toggleToView() : toggleToEdit()" delay=500
              [tooltip]="(componentHasFocus()? 'Exit edit' : 'Edit') + ' content for ' + description"
              [icon]="faPencil" [caption]="componentHasFocus() ? 'Exit edit' : 'Edit'">
            </app-badge-button>
          }
          @if (!buttonsAvailableOnlyOnFocus || componentHasFocus()) {
            <ng-content select="[prepend]"/>
            @if (editorState.view) {
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
            @if (dirty() && !saving()) {
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
        <fa-icon [icon]="showing() ? faAngleUp:faAngleDown"></fa-icon>
        <span>{{ showHideCaption() }}</span>
      </div>
    }
    @if (editorState.view === 'edit') {
      <textarea [wrap]="'hard'"
                [(ngModel)]="content.text"
                (ngModelChange)="changeText($event)"
                class="form-control markdown-textarea" [rows]="rows"
                placeholder="Enter {{description}} text here">
        </textarea>
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
  imports: [BadgeButtonComponent, TooltipDirective, FormsModule, MarkdownComponent, FontAwesomeModule, KebabCasePipe]
})
export class MarkdownEditorComponent implements OnInit, OnDestroy {

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
  private markdownEditorFocusService = inject(MarkdownEditorFocusService);
  protected duplicateContentDetectionService = inject(DuplicateContentDetectionService);
  protected stringUtilsService = inject(StringUtilsService);
  protected siteEditService = inject(SiteEditService);
  private urlService = inject(UrlService);
  private dataPopulationService = inject(DataPopulationService);
  private systemConfig: SystemConfig;
  @Input() id: string;
  @Input() rows: number;
  @Input() actionCaptionSuffix: string;
  @Input() initialView: View;
  @Input() description: string;
  @Output() changed: EventEmitter<ContentText> = new EventEmitter();
  @Output() saved: EventEmitter<ContentText> = new EventEmitter();
  @Output() focusChange: EventEmitter<EditorInstanceState> = new EventEmitter();
  private presentationMode: boolean;
  public minimumRows = 10;
  public data: ContentText;
  public allowMaximise: boolean;
  public allowSave: boolean;
  public buttonsAvailableOnlyOnFocus: boolean;
  public allowHide: boolean;
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
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_EDITOR_CREATED, this));
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
    this.logger.debug("retrieved content:", this.content, "editor state:", this.editorState);
    return this.content;
  }

  private calculateRows() {
    this.rows = this.calculateRowsFrom(this.content);
  }

  private syncContent() {
    this.content = {category: this.category, text: this.text, name: this.name};
    this.publishUnsavedChanges();
  }

  revert(): void {
    this.logger.debug("reverting " + this.name, "content");
    this.content = cloneDeep(this.originalContent);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_SYNCED, this));
    this.changed.emit(this.content);
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
    return this.saveEnabled;
  }

  changeText($event: any) {
    this.logger.debug("name:", this.name, "content name:", this.content.name, "changeText:", $event);
    this.renameIfRequired();
    this.broadcastChange();
    this.publishUnsavedChanges();
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
}
