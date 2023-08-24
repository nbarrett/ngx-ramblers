import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import isEqual from "lodash-es/isEqual";
import { NgxLoggerLevel } from "ngx-logger";
import { TagData, TagifySettings } from "ngx-tagify";
import { BehaviorSubject, Subscription } from "rxjs";
import { ImageTag } from "../../models/content-metadata.model";
import { ImageTagDataService } from "../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";

@Component({
  selector: "app-tag-editor",
  styleUrls: ["./tag-editor.component.sass"],
  template: `
    <label [for]="id">Image Tags</label>
    <tagify [ngModel]="editableTags"
            inputClass="round"
            [id]="id"
            [settings]="settings"
            [whitelist]="tagLookups"
            [readonly]="readonly"
            (add)="onAdd($event)"
            (remove)="onRemove($event)">
    </tagify>
  `
})

export class TagEditorComponent implements OnInit, OnDestroy {
  @Input() text: string;
  @Input() tags: number[];
  @Output() tagsChange: EventEmitter<ImageTag[]> = new EventEmitter();

  editableTags: TagData[] = [];
  settings: TagifySettings = {
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
  tagLookups: BehaviorSubject<TagData[]> = new BehaviorSubject<TagData[]>([]);
  readonly = false;
  private logger: Logger;
  public id: string;
  private subscriptions: Subscription[] = [];

  constructor(public stringUtils: StringUtilsService,
              private imageTagDataService: ImageTagDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(TagEditorComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    if (!this.tags) {
      this.tags = [];
    }
    this.id = this.stringUtils.kebabCase("image-tags", this.text);
    this.logger.info("ngOnInit:tags for:", this.text, "->", this.tags, "id ->", this.id);
    this.subscriptions.push(this.imageTagDataService.imageTags().subscribe(data => this.populateData(data)));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private populateData(imageTags: ImageTag[]) {
    const tagData: TagData[] = imageTags.map(item => ({key: item.key, value: item.subject}));
    this.logger.debug("refreshed tag lookups with:", imageTags, "transformed to tagData:", tagData);
    this.tagLookups.next(tagData);
    this.editableTags = this?.tags?.map(tag => ({value: this.imageTagDataService.findTag(tag)?.subject}));
  }

  onAdd(data) {
    this.logger.info("onAdd:data:", data);
    const tagData: TagData = data.added;
    const preAddTags: number[] = cloneDeep(this.tags);
    if (!tagData.key) {
      const newImage: ImageTag = this.imageTagDataService.addTag(tagData.value);
      this.tags.push(newImage.key);
      this.logger.debug("adding new Image tag", newImage);
    } else if (!this.tags.includes(tagData.key)) {
      this.tags.push(tagData.key);
      this.logger.debug("adding existing Image tag", tagData);
    }

    if (isEqual(preAddTags, this.tags)) {
      this.logger.debug("onAdd:", this.text, "no change to tags", tagData);
    } else {
      const emitValue = this.imageTagDataService.asImageTags(this.tags);
      this.logger.debug("onAdd:", this.text, "preAddTags:", preAddTags, "postAddTags:", this.tags, "emitting:", emitValue);
      this.tagsChange.emit(emitValue);
    }
  }

  onRemove(data: TagData[]) {
    const stories = this.imageTagDataService.asImageTags(data.map(item => item.key));
    this.logger.debug("onRemove tag data", data, "stories", stories);
    this.tagsChange.emit(stories);
  }

}
