import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { ContentMetadata } from "../../../models/content-metadata.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageContentService } from "../../../services/page-content.service";
import { faPencil, faPlus } from "@fortawesome/free-solid-svg-icons";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";

@Component({
  selector: "app-carousel-select",
  styleUrls: ["./carousel-select.sass"],
  template: `
    <div class="form-inline">
      <select [(ngModel)]="selectedContentMetadata"
              [id]="id"
              (ngModelChange)="emitAndPublishMetadata(($event))"
              class="form-control mr-2" [ngStyle]="{'max-width.px': maxWidth}">
        <option *ngFor="let contentMetadata of allContentMetadata"
                [ngValue]="contentMetadata">
          {{contentMetadataService.contentMetadataName(contentMetadata)}}
          ({{stringUtils.pluraliseWithCount(contentMetadata.files.length, "image")}})
        </option>
      </select>
      <app-badge-button *ngIf="showNewButton" [icon]="faPlus" [caption]="'new'"
                        (click)="nameEditToggle.emit(true)"/>
    </div>`
})
export class CarouselSelectComponent implements OnInit {

  @Input()
  public name: string;

  @Input()
  public id: string;

  @Input()
  public maxWidth: number;

  @Input("showNewButton") set showNewButtonValue(showNewButton: boolean) {
    this.showNewButton = coerceBooleanProperty(showNewButton);
  }

  public showNewButton: boolean;

  @Output() metadataChange: EventEmitter<ContentMetadata> = new EventEmitter();
  @Output() nameEditToggle: EventEmitter<boolean> = new EventEmitter();

  protected readonly faPencil = faPencil;
  protected readonly faPlus = faPlus;

  constructor(
    public contentMetadataService: ContentMetadataService,
    public pageContentService: PageContentService,
    public stringUtils: StringUtilsService,
    private broadcastService: BroadcastService<ContentMetadata>,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CarouselSelectComponent", NgxLoggerLevel.ERROR);
  }

  private logger: Logger;
  public selectedContentMetadata: ContentMetadata;
  public allContentMetadata: ContentMetadata[];

  ngOnInit() {
    this.logger.debug("ngOnInit:name", this.name);
    this.contentMetadataService.refreshLookups();
    this.contentMetadataService.contentMetadataNotifications().subscribe(item => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.name, item);
      this.allContentMetadata = allAndSelectedContentMetaData.contentMetadataItems;
      this.selectedContentMetadata = allAndSelectedContentMetaData.contentMetadata;
      this.logger.info("contentMetadataNotifications().subscribe.allContentMetadata", this.allContentMetadata, "selectedContentMetadata:", this.selectedContentMetadata);
    });
  }

  emitAndPublishMetadata(contentMetadata: ContentMetadata) {
    this.metadataChange.emit((contentMetadata));
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.CONTENT_METADATA_CHANGED, contentMetadata));
  }
}
