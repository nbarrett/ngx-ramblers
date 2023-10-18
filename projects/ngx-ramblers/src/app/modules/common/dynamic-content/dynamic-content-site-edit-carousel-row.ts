import { Component, Input, OnInit } from "@angular/core";
import { faAdd, faPencil, faPlus, faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { ContentMetadata } from "../../../models/content-metadata.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentService } from "../../../services/page-content.service";
import isEmpty from "lodash-es/isEmpty";
import { ContentMetadataService } from "../../../services/content-metadata.service";

@Component({
  selector: "[app-row-settings-carousel]",
  template: `
    <form>
      <label class="mr-2"
             [for]="id">Carousel Name</label>
      <app-carousel-select *ngIf="!nameInput" [id]="id" [showNewButton]="true" [name]="row.carousel.name"
                           (metadataChange)="metadataChange(row, $event)"
                           (nameEditToggle)="toggleNameEdit($event)"></app-carousel-select>
      <div class="form-inline" *ngIf="nameInput">
        <input autocomplete="new-password" [typeahead]="contentMetadataService.carousels"
               [typeaheadMinLength]="0"
               [id]="id"
               [(ngModel)]="row.carousel.name"
               name="new-password"
               [ngModelOptions]="{standalone: true}"
               type="text" class="form-control flex-grow-1 mr-2">
        <app-badge-button [icon]="faSearch" [caption]="'existing'"
                          (click)="toggleNameEdit(false)"></app-badge-button>
      </div>
    </form>`,
})
export class RowSettingsCarouselComponent implements OnInit {

  constructor(
    public pageContentService: PageContentService,
    public memberResourcesReferenceData: MemberResourcesReferenceDataService,
    public contentMetadataService: ContentMetadataService,
    public stringUtils: StringUtilsService,
    private numberUtils: NumberUtilsService,
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("RowSettingsCarouselComponent", NgxLoggerLevel.OFF);
  }

  @Input()
  public row: PageContentRow;
  private logger: Logger;
  faPencil = faPencil;
  faAdd = faAdd;
  id: string;
  nameInput: boolean;

  protected readonly faPlus = faPlus;
  protected readonly faSearch = faSearch;

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
    this.contentMetadataService.contentMetadataNotifications().subscribe(item => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.row?.carousel?.name, item);
      const allContentMetadata: ContentMetadata[] = allAndSelectedContentMetaData.contentMetadataItems;
      this.nameInput = isEmpty(this.row?.carousel?.name) || !allContentMetadata.find(item => item.name === this.row?.carousel?.name);
    });
  }

  metadataChange(row: PageContentRow, contentMetadata: ContentMetadata) {
    row.carousel.name = contentMetadata.name;
  }

  toggleNameEdit(nameInput: boolean) {
    this.nameInput = nameInput;
  }

}
