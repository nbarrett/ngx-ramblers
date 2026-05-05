import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { isEqual } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { TagData, TagifyModule, TagifySettings } from "ngx-tagify";
import { BehaviorSubject, Subscription } from "rxjs";
import { Tag } from "../../models/tag.model";
import { findTag, tagsSorted } from "../../functions/tags";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-tag-editor",
    styleUrls: ["./tag-editor.component.sass"],
    template: `
      <label [for]="id">{{ label }}</label>
      <tagify [ngModel]="editableTags"
              inputClass="round w-100"
              [id]="id"
              [settings]="settings"
              [whitelist]="tagLookups"
              [readonly]="readonly"
              (add)="onAdd($event)"
              (remove)="onRemove($event)">
      </tagify>
  `,
    imports: [TagifyModule, FormsModule]
})

export class TagEditorComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("TagEditorComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);

  public tagsForItem: number[];

  @Input("tagsForItem") set tagsForItemValue(tagsForItem: number[]) {
    this.tagsForItem = tagsForItem;
    this.populateData(this.availableTags);
  }

  @Input() text: string;
  @Input() label = "Tags";
  @Input() addTag?: (subject: string) => Tag;

  @Input("availableTags") set acceptAvailableTagsChangesFrom(availableTags: Tag[]) {
    this.logger.info("availableTags change:", availableTags);
    this.availableTags = availableTags;
    this.populateData(this.availableTags);
  }

  @Output() tagsChange: EventEmitter<Tag[]> = new EventEmitter();

  public availableTags: Tag[];
  public editableTags: TagData[] = [];
  public settings: TagifySettings = {
    placeholder: "Click to select",
    blacklist: [],
    dropdown: {
      maxItems: 20,
      classname: "tags-look",
      enabled: 0,
      closeOnSelect: false
    },
    callbacks: {
      click: (event) => {
        this.logger.debug("clicked", event.detail);
      }
    }
  };
  public tagLookups: BehaviorSubject<TagData[]> = new BehaviorSubject<TagData[]>([]);
  public readonly = false;
  public id: string;
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    if (!this.tagsForItem) {
      this.tagsForItem = [];
    }
    this.id = this.stringUtils.kebabCase("tags", this.text);
    this.logger.info("ngOnInit:tags for:", this.text, "->", this.tagsForItem, "id ->", this.id);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private populateData(availableTags: Tag[]) {
    if (availableTags) {
      const tagData: TagData[] = availableTags.map(item => ({key: item.key, value: item.subject}));
      this.logger.debug("refreshed tag lookups with:", availableTags, "transformed to tagData:", tagData);
      this.tagLookups.next(tagData);
      this.editableTags = this?.tagsForItem?.map(key => ({value: findTag(availableTags, key)?.subject})).filter(item => item.value);
    }
  }

  private asTags(keys: number[]): Tag[] {
    return tagsSorted(this.availableTags).filter(tag => keys.includes(tag.key));
  }

  onAdd(data: TagData) {
    this.logger.info("onAdd:data:", data);
    const tagData: TagData = data.added;
    const preAddTags: number[] = cloneDeep(this.tagsForItem);
    if (!tagData.key) {
      if (!this.addTag) {
        this.logger.warn("onAdd: no addTag callback supplied; ignoring new tag", tagData.value);
        return;
      }
      const newTag: Tag = this.addTag(tagData.value);
      this.logger.debug("adding new tag", newTag);
      this.tagsForItem.push(newTag.key);
    } else if (!this.tagsForItem.includes(tagData.key)) {
      this.tagsForItem.push(tagData.key);
      this.logger.debug("adding existing tag", tagData);
    }
    if (isEqual(preAddTags, this.tagsForItem)) {
      this.logger.debug("onAdd:", this.text, "no change to tags", tagData);
    } else {
      const emittedTags = this.asTags(this.tagsForItem);
      this.logger.debug("onAdd:", this.text, "preAddTags:", preAddTags, "postAddTags:", this.tagsForItem, "emitting:", emittedTags);
      this.tagsChange.emit(emittedTags);
    }
  }

  onRemove(data: TagData[]) {
    const remaining = this.asTags(data.map(item => item.key));
    this.logger.debug("onRemove tag data", data, "remaining", remaining);
    this.tagsChange.emit(remaining);
  }

}
