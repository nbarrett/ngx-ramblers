import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { faAdd, faPencil, faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { DEFAULT_GRID_OPTIONS, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { ContentMetadata } from "../../../models/content-metadata.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "[app-row-settings-carousel]",
  styleUrls: ["./dynamic-content.sass"],
  template: `
    <label class="mr-2"
           [for]="id">Album Name</label>
    <app-carousel-select [maxWidth]="250" *ngIf="!nameInput" [id]="id" showNewButton
                         [name]="row?.carousel?.name"
                         (metadataChange)="metadataChange(row, $event)"
                         (nameEditToggle)="toggleNameEdit($event)"/>
    <div class="d-flex" *ngIf="nameInput">
      <input autocomplete="new-password" [typeahead]="contentMetadataService?.carousels"
             [typeaheadMinLength]="0"
             [id]="id"
             [ngModel]="row.carousel.name"
             (ngModelChange)="carouselNameChange($event)"
             name="new-password"
             [ngModelOptions]="{standalone: true}"
             type="text" class="form-control mr-2 flex-grow-1">
      <app-badge-button [icon]="faSearch" [caption]="'existing'"
                        (click)="toggleNameEdit(false)"/>
    </div>`,
  standalone: false
})
export class RowSettingsCarouselComponent implements OnInit {

  constructor(
    public pageContentService: PageContentService,
    public memberResourcesReferenceData: MemberResourcesReferenceDataService,
    public contentMetadataService: ContentMetadataService,
    public stringUtils: StringUtilsService,
    private numberUtils: NumberUtilsService,
    private urlService: UrlService,
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("RowSettingsCarouselComponent", NgxLoggerLevel.ERROR);
  }

  @Input()
  public row: PageContentRow;
  @Output() nameInputChange: EventEmitter<boolean> = new EventEmitter();
  private logger: Logger;
  faPencil = faPencil;
  faAdd = faAdd;
  id: string;
  nameInput: boolean;
  private defaultAlbumName: string;
  protected readonly faSearch = faSearch;

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
    this.initialiseMissingAlbumData();
    this.defaultAlbumName = this.row?.carousel?.name;
    this.contentMetadataService.contentMetadataNotifications().subscribe(metadataResponses => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.row?.carousel?.name, metadataResponses);
      this.nameInput = !allAndSelectedContentMetaData.contentMetadata;
      this.logger.info("given name:", this.row?.carousel?.name, "allAndSelectedContentMetaData:", allAndSelectedContentMetaData);
      this.initialiseMissingAlbumData();
    });
  }

  carouselNameChange(contentPath: string) {
    const reformattedPath = this.urlService.reformatLocalHref(contentPath);
    this.logger.info("contentPathChange:", contentPath, "reformattedPath:", reformattedPath);
    this.row.carousel.name = reformattedPath;
  }

  private initialiseMissingAlbumData() {
    this.logger.info("initialiseMissingAlbumData:carousel name:", this.row?.carousel?.name);
    if (!this.row?.carousel?.name) {
      this.row.carousel.name = "";
    }
    if (!this.row?.carousel?.gridViewOptions) {
      this.row.carousel.gridViewOptions = DEFAULT_GRID_OPTIONS;
    }
  }

  metadataChange(row: PageContentRow, contentMetadata: ContentMetadata) {
    this.logger.info("metadataChange:carousel name:", row.carousel.name, "->", contentMetadata.name, "contentMetadata:", contentMetadata);
    row.carousel.name = contentMetadata.name;
  }

  toggleNameEdit(nameInput: boolean) {
    this.nameInput = nameInput;
    this.nameInputChange.emit(this.nameInput);
    if (this.nameInput) {
      this.row.carousel.name = this.defaultAlbumName;
    } else {
      this.row.carousel.name = null;
    }
  }

}
