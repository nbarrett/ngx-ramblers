import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import isEqual from "lodash-es/isEqual";
import { NgxLoggerLevel } from "ngx-logger";
import { TagData, TagifyModule, TagifySettings } from "ngx-tagify";
import { BehaviorSubject, Subscription } from "rxjs";
import { ImageTag } from "../../models/content-metadata.model";
import { ImageTagDataService } from "../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-tag-editor",
    styleUrls: ["./tag-editor.component.sass"],
    template: `
      <label [for]="id">Image Tags</label>
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
  private imageTagDataService = inject(ImageTagDataService);

  public tagsForImage: number[];

  @Input("tagsForImage") set tagsForImageValue(tagsForImage: number[]) {
    this.tagsForImage = tagsForImage;
    this.populateData(this.contentMetadataImageTags);
  }

  @Input() text: string;

  @Input("contentMetadataImageTags") set acceptContentMetadataChangesFrom(contentMetadataImageTags: ImageTag[]) {
    this.logger.info("contentMetadataImageTags change:", contentMetadataImageTags);
    this.contentMetadataImageTags = contentMetadataImageTags;
    this.populateData(this.contentMetadataImageTags);
  }

  @Output() tagsChange: EventEmitter<ImageTag[]> = new EventEmitter();

  public contentMetadataImageTags: ImageTag[];
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
    if (!this.tagsForImage) {
      this.tagsForImage = [];
    }
    this.id = this.stringUtils.kebabCase("image-tags", this.text);
    this.logger.info("ngOnInit:tags for:", this.text, "->", this.tagsForImage, "id ->", this.id);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private populateData(imageTags: ImageTag[]) {
    if (imageTags) {
      const tagData: TagData[] = imageTags.map(item => ({key: item.key, value: item.subject}));
      this.logger.debug("refreshed tag lookups with:", imageTags, "transformed to tagData:", tagData);
      this.tagLookups.next(tagData);
      this.editableTags = this?.tagsForImage?.map(tag => ({value: this.imageTagDataService.findTag(imageTags, tag)?.subject}));
    }
  }

  onAdd(data: TagData) {
    this.logger.info("onAdd:data:", data);
    const tagData: TagData = data.added;
    const preAddTags: number[] = cloneDeep(this.tagsForImage);
    if (!tagData.key) {
      const newImage: ImageTag = this.imageTagDataService.addTag(this.contentMetadataImageTags, tagData.value);
      this.logger.debug("adding new Image tag", newImage);
      this.tagsForImage.push(newImage.key);
    } else if (!this.tagsForImage.includes(tagData.key)) {
      this.tagsForImage.push(tagData.key);
      this.logger.debug("adding existing Image tag", tagData);
    }
    if (isEqual(preAddTags, this.tagsForImage)) {
      this.logger.debug("onAdd:", this.text, "no change to tags", tagData);
    } else {
      const emittedImageTags = this.imageTagDataService.asImageTags(this.contentMetadataImageTags, this.tagsForImage);
      this.logger.debug("onAdd:", this.text, "preAddTags:", preAddTags, "postAddTags:", this.tagsForImage, "emitting:", emittedImageTags);
      this.tagsChange.emit(emittedImageTags);
    }
  }

  onRemove(data: TagData[]) {
    const stories = this.imageTagDataService.asImageTags(this.contentMetadataImageTags, data.map(item => item.key));
    this.logger.debug("onRemove tag data", data, "stories", stories);
    this.tagsChange.emit(stories);
  }

}
