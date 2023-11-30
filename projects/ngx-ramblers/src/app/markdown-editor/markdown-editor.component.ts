import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import {
  faAngleDown,
  faAngleUp,
  faCircleCheck,
  faEraser,
  faMagnifyingGlass,
  faPencil,
  faRemove,
  faSpinner,
  faUnlink
} from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import isEmpty from "lodash-es/isEmpty";
import isEqual from "lodash-es/isEqual";
import pick from "lodash-es/pick";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { ContentText, DataAction, EditorInstanceState, EditorState, View } from "../models/content-text.model";
import { BroadcastService } from "../services/broadcast-service";
import { ContentTextService } from "../services/content-text.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { MarkdownEditorFocusService } from "../services/markdown-editor-focus-service";
import { MemberLoginService } from "../services/member/member-login.service";
import { SiteEditService } from "../site-edit/site-edit.service";
import { UiActionsService } from "../services/ui-actions.service";
import { StoredValue } from "../models/ui-actions";
import { StringUtilsService } from "../services/string-utils.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-markdown-editor",
  templateUrl: "./markdown-editor.component.html",
  styleUrls: ["./markdown-editor.component.sass"]
})
export class MarkdownEditorComponent implements OnInit {


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
    this.logger.info("acceptNameChangesFrom:name:", name);
    this.name = name;
    this.syncContent();
  }

  @Input("category") set acceptCategoryChangesFrom(category: string) {
    this.logger.info("category:", category);
    this.category = category;
    this.syncContent();
  }

  @Input("noSave") set noImageSaveValue(noSave: boolean) {
    this.noSave = coerceBooleanProperty(noSave);
  }


  @Input() data: ContentText;
  @Input() id: string;
  @Input() rows: number;
  @Input() actionCaptionSuffix: string;


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

  @Input("unlinkEnabled") set unlinkEnabledValue(unlinkEnabled: boolean) {
    this.unlinkEnabled = coerceBooleanProperty(unlinkEnabled);
  }

  @Input("queryOnlyById") set queryOnlyByIdValue(queryOnlyById: boolean) {
    this.queryOnlyById = coerceBooleanProperty(queryOnlyById);
  }


  @Input() initialView: View;
  @Input() description: string;
  @Output() changed: EventEmitter<ContentText> = new EventEmitter();
  @Output() saved: EventEmitter<ContentText> = new EventEmitter();
  @Output() focusChange: EventEmitter<EditorInstanceState> = new EventEmitter();
  public allowMaximise: boolean;
  public allowSave: boolean;
  public buttonsAvailableOnlyOnFocus: boolean;
  public allowHide: boolean;
  public deleteEnabled: boolean;
  public unlinkEnabled: boolean;
  public queryOnlyById: boolean;
  private show = true;
  public editNameEnabled: boolean;
  private initialised: boolean;
  faSpinner = faSpinner;
  faPencil = faPencil;
  faCircleCheck = faCircleCheck;
  faRemove = faRemove;
  faEraser = faEraser;
  faAngleUp = faAngleUp;
  faAngleDown = faAngleDown;

  protected readonly faUnlink = faUnlink;

  constructor(private memberLoginService: MemberLoginService,
              private uiActionsService: UiActionsService,
              private broadcastService: BroadcastService<ContentText>,
              private contentTextService: ContentTextService,
              private markdownEditorFocusService: MarkdownEditorFocusService,
              public stringUtilsService: StringUtilsService,
              public siteEditService: SiteEditService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MarkdownEditorComponent, NgxLoggerLevel.OFF);
  }

  private noSave: boolean;
  private logger: Logger;
  private originalContent: ContentText;
  public editorState: EditorState;
  public content: ContentText = {};
  private saveEnabled = false;
  public name: string;
  public text: string;
  public category: string;
  private hideParameterName: string;


  ngOnInit() {
    this.logger.info("ngOnInit:name", this.name, "data:", this.data, "description:", this.description);
    this.hideParameterName = this.stringUtilsService.kebabCase(StoredValue.MARKDOWN_FIELD_HIDDEN, this.name);
    this.editorState = {
      view: this.initialView || View.VIEW,
      dataAction: DataAction.NONE
    };
    if (this.data) {
      const existingData: boolean = !!this.data.id;
      this.content = this.data;
      if (!this.noSave) {
        this.saveEnabled = true;
      }
      this.logger.info("editing:", this.content, "existingData:", existingData, "editorState:", this.editorState, "rows:", this.rows);
      this.originalContent = cloneDeep(this.content);
      this.setDescription();
      this.calculateRowsIfNotSupplied();
    } else if (this.text) {
      this.content = {name: this.name, text: this.text, category: this.category};
      this.originalContent = cloneDeep(this.content);
      this.logger.debug("editing injected content", this.content, "editorState:", this.editorState);
    } else {
      this.queryContent().then(() => {
        this.setDescription();
      });
    }
    this.siteEditService.events.subscribe((item: NamedEvent<boolean>) => {
      this.logger.info("siteEditService.events.subscribe:", this.name, "this.editorState.view", this.editorState.view, "siteEditService:event", item);
      this.editorState.view = item.data ? View.EDIT : View.VIEW;
    });
    this.initialised = true;
    if (this.allowHide) {
      const currentlyHidden = this.uiActionsService.initialBooleanValueFor(this.hideParameterName, false);
      this.show = !currentlyHidden;
    }
  }

  private setDescription() {
    if (!this.description) {
      this.description = this.content.name;
    }
  }

  queryContent(): Promise<ContentText> {
    this.editorState.dataAction = DataAction.QUERY;
    if (this.id) {
      this.logger.info("querying content for id:", this.id, "name:", this.name, "category:", this.category, "editorState:", this.editorState, "id:",);
      return this.contentTextService.getById(this.id)
        .then((content) => {
          return this.apply(content);
        })
        .catch(response => {
          this.logger.error(response);
          return this.apply({});
        });
    } else if (this.queryOnlyById) {
      this.logger.info("queryOnlyById:true content:name", this.name, "and category:", this.category, "editorState:", this.editorState, "id:", this.id);
      return Promise.resolve(this.apply({}));
    } else if (this.name) {
      this.logger.info("querying content:name", this.name, "and category:", this.category, "editorState:", this.editorState, "id:", this.id);
      return this.contentTextService.findByNameAndCategory(this.name, this.category).then((content) => {
        return this.apply(content);
      });
    }
  }

  private apply(content: ContentText): ContentText {
    if (isEmpty(content)) {
      if (this.siteEditService.active()) {
        this.logger.info("content is empty for", this.description, "assumed to be new content so going into edit mode");
      }
      this.syncContent();
    } else {
      this.content = content;
    }
    this.saveEnabled = true;
    this.originalContent = cloneDeep(this.content);
    this.editorState.dataAction = DataAction.NONE;
    this.calculateRowsIfNotSupplied();
    this.logger.info("retrieved content:", this.content, "editor state:", this.editorState);
    return this.content;
  }

  private calculateRowsIfNotSupplied() {
    if (!this.rows) {
      this.rows = this.calculateRowsFrom(this.content);
    }
  }

  private syncContent() {
    this.content = {category: this.category, text: this.text, name: this.name};
    this.publishUnsavedChanges();
  }

  revert(): void {
    this.logger.debug("reverting " + this.name, "content");
    this.content = cloneDeep(this.originalContent);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_SYNCED, this));
    this.changed.emit(this.content)
  }

  dirty(): boolean {
    const fields = ["name", "category", "text"];
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
    const calculatedRows = Math.min(rows, 10);
    this.logger.info("number of rows in text ", text, "->", rows, "calculatedRows:", calculatedRows);
    return calculatedRows;
  }

  preview(): void {
    this.editorState.view = View.VIEW;
  }

  toggleEdit(): void {
    this.logger.debug("toggleEdit called");
    if (this.siteEditService.active() && this.editorState.dataAction !== DataAction.QUERY) {
      const priorState: View = this.editorState.view;
      if (priorState === View.VIEW) {
        this.toggleToEdit();
      } else if (this.editorState.view === View.EDIT) {
        this.toggleToView();
      }
      this.logger.debug("toggleEdit: changing state from ", priorState, "to", this.editorState.view);
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
      this.logger.info("setFocus:", this.description);
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
  }

  delete() {
    this.contentTextService.delete(this.content).then((removed) => {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_DELETED, removed));
    });
  }

  canDelete() {
    return this.deleteEnabled && this.content.id;
  }

  canUnlink() {
    return this.unlinkEnabled && this.content.id;
  }

  canSave() {
    return this.saveEnabled;
  }

  changeText($event: any) {
    this.logger.debug("name:", this.name, "content name:", this.content.name, "changeText:", $event);
    this.renameIfRequired();
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.content));
    this.changed.emit(this.content);
    this.publishUnsavedChanges();
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
}
