import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
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
import { FormsModule } from "@angular/forms";
import { NgStyle } from "@angular/common";
import { BadgeButtonComponent } from "../../../modules/common/badge-button/badge-button";
import first from "lodash-es/first";

@Component({
  selector: "app-image-list-select",
  styleUrls: ["./image-list-select.sass"],
  template: `
    <div class="d-inline-flex align-items-center flex-wrap">
      <select [(ngModel)]="selectedContentMetadata"
              [id]="id"
              [size]="multiple? allContentMetadata?.length || 1 : null"
              (ngModelChange)="emitAndPublishMetadata($event)"
              class="form-control me-2" [ngStyle]="{'max-width.px': maxWidth}" [multiple]="multiple">
        @for (contentMetadata of allContentMetadata; track contentMetadata) {
          <option
            [ngValue]="contentMetadata">
            {{ contentMetadataService.contentMetadataName(contentMetadata) }}
            ({{ stringUtils.pluraliseWithCount(contentMetadata.files.length, "image") }})
          </option>
        }
      </select>
      @if (showNewButton) {
        <app-badge-button [icon]="faPlus" [caption]="'new'"
                          (click)="nameEditToggle.emit(true)"/>
      }
    </div>`,
  imports: [FormsModule, NgStyle, BadgeButtonComponent]
})
export class ImageListSelect implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("ImageListSelect", NgxLoggerLevel.ERROR);
  contentMetadataService = inject(ContentMetadataService);
  pageContentService = inject(PageContentService);
  stringUtils = inject(StringUtilsService);
  private broadcastService = inject<BroadcastService<ContentMetadata[] | ContentMetadata>>(BroadcastService);

  @Input() public multiple: boolean;
  @Input() public name: string;
  @Input() public id: string;
  @Input() public maxWidth: number;

  @Input("showNewButton") set showNewButtonValue(showNewButton: boolean) {
    this.showNewButton = coerceBooleanProperty(showNewButton);
  }

  public showNewButton: boolean;

  @Output() metadataChange: EventEmitter<ContentMetadata | ContentMetadata[]> = new EventEmitter();
  @Output() nameEditToggle: EventEmitter<boolean> = new EventEmitter();

  protected readonly faPencil = faPencil;
  protected readonly faPlus = faPlus;
  public selectedContentMetadata: ContentMetadata | ContentMetadata[];
  public allContentMetadata: ContentMetadata[];

  ngOnInit() {
    this.logger.debug("ngOnInit:name", this.name);
    this.contentMetadataService.refreshLookups();
    this.contentMetadataService.contentMetadataNotifications().subscribe(item => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.name, item);
      this.allContentMetadata = allAndSelectedContentMetaData.contentMetadataItems;
      this.selectedContentMetadata = allAndSelectedContentMetaData.contentMetadata ? [allAndSelectedContentMetaData.contentMetadata] : [];
      this.logger.info("contentMetadataNotifications().subscribe.allContentMetadata", this.allContentMetadata, "selectedContentMetadata:", this.selectedContentMetadata);
    });
  }

  emitAndPublishMetadata(contentMetadata: ContentMetadata[]) {
    const emittedData = !this.multiple ? first(contentMetadata) : contentMetadata;
    this.logger.info("emitAndPublishMetadata:", contentMetadata, "multiple:", this.multiple, "emittedData:", emittedData);
    this.metadataChange.emit(emittedData);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.CONTENT_METADATA_CHANGED, emittedData));
  }
}
