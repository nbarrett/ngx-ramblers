import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faCircleCheck,
  faCircleExclamation,
  faRotate,
  faSpinner,
  faUpload
} from "@fortawesome/free-solid-svg-icons";
import { faFacebook } from "@fortawesome/free-brands-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute } from "@angular/router";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { PageComponent } from "../../../page/page.component";
import { AlertTarget } from "../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SocialPublishService } from "../../../services/social/social-publish.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UrlService } from "../../../services/url.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { RootFolder, SystemConfig } from "../../../models/system.model";
import { UIDateFormat } from "../../../models/date-format.model";
import { AwsFileUploadResponseData } from "../../../models/aws-object.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { StoredValue } from "../../../models/ui-actions";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { SortDirection } from "../../../models/sort.model";
import {
  EventPublishOutcome,
  EventPublishResult,
  FacebookPostStyle,
  PublishableEvent,
  PublishableEventRow,
  PublishedState,
  SocialNetwork
} from "../../../models/social-publish.model";
import { FacebookButton } from "../../../modules/common/third-parties/facebook-button";
import { DateRangeSlider, DateRange } from "../../../components/date-range-slider/date-range-slider";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import {
  SortableTableCellDirective,
  SortableTableExpandedRowDirective
} from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import {
  SortableTableColumn,
  SortableTableSortState
} from "../../../modules/common/sortable-table/sortable-table.model";

@Component({
  selector: "app-event-social-publishing",
  template: `
    <app-page pageTitle="Publish walks and social events to Facebook">
      <div class="row">
        <div class="col-sm-12">
          <div class="alert alert-warning d-flex align-items-start">
            <fa-icon class="me-2 mt-1" [icon]="faCircleExclamation"/>
            <div>
              <strong>These are Page posts, not Facebook Events</strong>
              <div>Meta's API does not allow any app to create a Facebook Event. Each walk or social event below is
                published as a post on the group's Facebook Page, linking back to the event on this site.
              </div>
            </div>
          </div>
          @if (!eventPublishingEnabled) {
            <div class="alert alert-warning d-flex align-items-start">
              <fa-icon class="me-2 mt-1" [icon]="faCircleExclamation"/>
              <div>
                <strong>Publishing is switched off</strong>
                <div>Switch on "Allow walks and social events to be published to Facebook" in System Settings before
                  publishing.
                </div>
              </div>
            </div>
          }
          <div class="row align-items-end mb-3">
            <div class="col-md-8">
              <app-date-range-slider class="w-100" showPresets [range]="dateRange"
                                     (rangeChange)="onDateRangeChange($event)"/>
            </div>
            <div class="col-md-4 d-flex align-items-center gap-2 justify-content-md-end">
              <app-facebook-button button title="Publish selected"
                                   [disabled]="!eventPublishingEnabled || selectedEventIds.length === 0 || publishing"
                                   (click)="publishSelected()"/>
              <button type="button" class="btn btn-quiet btn-icon" (click)="refresh()" [disabled]="loading"
                      tooltip="Refresh the list" placement="left" container="body" aria-label="Refresh the list">
                <fa-icon [icon]="faRotate"/>
              </button>
            </div>
          </div>
          <app-sortable-table [columns]="columns" [rows]="rows"
                              [defaultSortKey]="sortKey" [defaultSortDirection]="sortDirection"
                              [expandedWhen]="isPreviewShown"
                              [trackBy]="trackRow"
                              emptyMessage="No walks or social events fall in the chosen dates"
                              (sortChange)="onSortChange($event)">
            <ng-template appSortableTableCell="select" let-row>
              <input type="checkbox" [checked]="isSelected(row)" (change)="toggleSelection(row)"
                     [attr.aria-label]="'Select ' + row.title">
            </ng-template>
            <ng-template appSortableTableCell="startDateTime" let-row>
              <button type="button" class="btn btn-quiet btn-icon me-2"
                      [attr.aria-expanded]="isPreviewShown(row)"
                      [tooltip]="isPreviewShown(row) ? 'Hide the preview' : 'Preview what will be posted'"
                      placement="left" container="body"
                      [attr.aria-label]="'Preview post for ' + row.title"
                      (click)="togglePreview(row)">
                <fa-icon [icon]="isPreviewShown(row) ? faChevronDown : faChevronRight"/>
              </button>
              {{ displayDate(row.startDateTime) }}
            </ng-template>
            <ng-template appSortableTableCell="title" let-row>
              @if (row.url) {
                <a [href]="row.url" target="_blank" rel="noopener noreferrer">{{ row.title }}</a>
              } @else {
                {{ row.title }}
              }
              @if (row.cancelled) {
                <span class="badge bg-danger ms-2">Cancelled</span>
              }
            </ng-template>
            <ng-template appSortableTableCell="image" let-row>
              @if (row.imageUrl) {
                <img class="publishing-thumbnail" [src]="row.imageUrl" [alt]="row.title">
                @if (row.imageCount > 1) {
                  <span class="ms-2">+{{ row.imageCount - 1 }}</span>
                }
              } @else {
                <button type="button" class="btn btn-quiet btn-icon"
                        [disabled]="uploadingEventId === row.eventId"
                        [tooltip]="uploadingEventId === row.eventId ? 'Uploading' : 'Add an image to this event'"
                        placement="left" container="body"
                        [attr.aria-label]="'Add an image to ' + row.title"
                        (click)="chooseImageFor(row)">
                  <fa-icon [icon]="uploadingEventId === row.eventId ? faSpinner : faUpload"/>
                </button>
              }
            </ng-template>
            <ng-template appSortableTableCell="publishedState" let-row>
              @if (row.publication?.permalink) {
                <fa-icon [icon]="faCircleCheck"/>
                <a class="ms-1" [href]="row.publication.permalink" target="_blank"
                   rel="noopener noreferrer">{{ row.publishedState }}</a>
              } @else {
                {{ row.publishedState }}
              }
            </ng-template>
            <ng-template appSortableTableExpandedRow let-row>
              <div class="post-preview">
                <div class="post-preview-heading">
                  <fa-icon [icon]="faFacebook" class="me-2 icon-facebook"/>
                  <strong>This is exactly what will be posted</strong>
                </div>
                <div class="post-preview-body">
                  <pre class="post-preview-caption">{{ row.caption }}</pre>
                  @if (row.postStyle === FacebookPostStyle.PHOTO_WITH_LINK) {
                    <div class="post-preview-images">
                      @for (imageUrl of row.imageUrls; track imageUrl) {
                        <img class="post-preview-image" [src]="imageUrl" [alt]="row.title">
                      }
                    </div>
                    <div class="post-preview-note">Posted as
                      {{ row.imageUrls.length === 1 ? "a photo" : row.imageUrls.length + " photos" }} with the link in
                      the text above.
                    </div>
                  } @else {
                    <div class="post-preview-note">Posted as a link with a preview card built from the event page.</div>
                  }
                </div>
              </div>
            </ng-template>
          </app-sortable-table>
          <input #imageFileInput class="d-none" type="file" accept="image/*"
                 ng2FileSelect (onFileSelected)="onImageSelected($event)" [uploader]="uploader"/>
          @if (results.length > 0) {
            <h4 class="mt-3">Results</h4>
            <ul>
              @for (result of results; track result.eventId) {
                <li>
                  <strong>{{ result.eventTitle || result.eventId }}</strong>: {{ outcomeDescription(result) }}
                </li>
              }
            </ul>
          }
          @if (notifyTarget.showAlert) {
            <div class="alert mt-3 {{ notifyTarget.alertClass }} d-flex align-items-start">
              <fa-icon class="me-2 mt-1" [icon]="notifyTarget.alert.icon"/>
              <div>
                @if (notifyTarget.alertTitle) {
                  <strong>{{ notifyTarget.alertTitle }}</strong>
                }
                <div>{{ notifyTarget.alertMessage }}</div>
              </div>
            </div>
          }
        </div>
      </div>
    </app-page>`,
  imports: [PageComponent, FormsModule, FontAwesomeModule, FacebookButton, FileUploadModule, TooltipDirective,
    DateRangeSlider, SortableTableComponent, SortableTableCellDirective, SortableTableExpandedRowDirective],
  styles: `
    :host ::ng-deep app-facebook-button .image
      width: 15px

    .alert
      padding: 0.5rem 0.75rem
      margin-bottom: 0.75rem

    .publishing-thumbnail
      width: 64px
      height: 48px
      object-fit: cover
      border-radius: var(--ngx-radius-sm, 4px)

    .post-preview
      border: 1px solid #dee2e6
      border-radius: var(--ngx-radius-sm, 4px)
      background: #fff
      max-width: 560px

    .post-preview-heading
      padding: 8px 12px
      border-bottom: 1px solid #dee2e6

    .post-preview-body
      padding: 12px

    .post-preview-caption
      white-space: pre-wrap
      word-break: break-word
      font-family: inherit
      font-size: 0.95rem
      margin: 0 0 10px 0

    .post-preview-images
      display: flex
      flex-wrap: wrap
      gap: 6px

    .post-preview-image
      width: 120px
      height: 90px
      object-fit: cover
      border-radius: var(--ngx-radius-sm, 4px)

    .post-preview-note
      margin-top: 8px
      font-size: 0.85rem
      color: #65676b
  `
})
export class EventSocialPublishingComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("EventSocialPublishingComponent", NgxLoggerLevel.ERROR);
  private socialPublishService = inject(SocialPublishService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private dateUtils = inject(DateUtilsService);
  private fileUploadService = inject(FileUploadService);
  private urlService = inject(UrlService);
  private activatedRoute = inject(ActivatedRoute);

  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private subscriptions: Subscription[] = [];
  private uploadSubscription: Subscription;
  private config: SystemConfig;

  protected rows: PublishableEventRow[] = [];
  protected results: EventPublishResult[] = [];
  protected selectedEventIds: string[] = [];
  protected previewEventIds: string[] = [];
  protected loading = false;
  protected publishing = false;
  protected dateRange: DateRange;
  protected sortKey = "startDateTime";
  protected sortDirection = ASCENDING;
  protected uploadingEventId: string;
  private uploadTargetEventId: string;
  protected uploader: FileUploader;
  @ViewChild("imageFileInput") private imageFileInput: ElementRef<HTMLInputElement>;

  protected readonly faFacebook = faFacebook;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faUpload = faUpload;
  protected readonly faRotate = faRotate;
  protected readonly faSpinner = faSpinner;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faChevronDown = faChevronDown;
  protected readonly FacebookPostStyle = FacebookPostStyle;

  protected readonly columns: SortableTableColumn<PublishableEventRow>[] = [
    {key: "select", label: ""},
    {key: "startDateTime", label: "Date", sortKey: "startDateTime"},
    {key: "title", label: "Title", sortKey: "title"},
    {key: "image", label: "Image"},
    {key: "publishedState", label: "Status", sortKey: "publishedState"}
  ];

  ngOnInit(): void {
    const params = this.activatedRoute.snapshot.queryParams;
    this.sortKey = params[StoredValue.SORT] || this.sortKey;
    this.sortDirection = params[StoredValue.SORT_ORDER] === SortDirection.DESC ? DESCENDING : ASCENDING;
    this.dateRange = {
      from: Number(params[StoredValue.DATE_FROM]) || this.dateUtils.dateTimeNowNoTime().toMillis(),
      to: Number(params[StoredValue.DATE_TO]) || this.dateUtils.dateTimeNowNoTime().plus({months: 3}).toMillis()
    };
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => this.config = config));
    this.refresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.uploadSubscription?.unsubscribe();
  }

  get eventPublishingEnabled(): boolean {
    return !!this.config?.externalSystems?.facebook?.eventPublishingEnabled;
  }

  protected readonly trackRow = (index: number, row: PublishableEventRow): string => row.eventId;

  protected readonly isPreviewShown = (row: PublishableEventRow): boolean =>
    this.previewEventIds.includes(row.eventId);

  protected displayDate(startDateTime: string): string {
    return this.dateUtils.asString(startDateTime, undefined, UIDateFormat.WEEKDAY_DAY_MONTH_YEAR_ABBREVIATED);
  }

  protected isSelected(row: PublishableEventRow): boolean {
    return this.selectedEventIds.includes(row.eventId);
  }

  protected toggleSelection(row: PublishableEventRow): void {
    this.selectedEventIds = this.isSelected(row)
      ? this.selectedEventIds.filter(eventId => eventId !== row.eventId)
      : this.selectedEventIds.concat(row.eventId);
  }

  protected togglePreview(row: PublishableEventRow): void {
    this.previewEventIds = this.isPreviewShown(row)
      ? this.previewEventIds.filter(eventId => eventId !== row.eventId)
      : this.previewEventIds.concat(row.eventId);
  }

  protected onSortChange(sortState: SortableTableSortState): void {
    this.sortKey = sortState.key;
    this.sortDirection = sortState.direction;
    this.storeViewState();
  }

  protected onDateRangeChange(dateRange: DateRange): void {
    this.dateRange = dateRange;
    this.storeViewState();
    this.refresh();
  }

  private storeViewState(): void {
    this.urlService.navigateTo([], {
      [StoredValue.SORT]: this.sortKey,
      [StoredValue.SORT_ORDER]: this.sortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC,
      [StoredValue.DATE_FROM]: this.dateRange?.from,
      [StoredValue.DATE_TO]: this.dateRange?.to
    }, "merge");
  }

  private publishedStateFor(event: PublishableEvent): PublishedState {
    if (!event.publication?.permalink) {
      return PublishedState.NOT_PUBLISHED;
    } else if (event.captionChanged) {
      return PublishedState.CHANGED_SINCE_PUBLISHING;
    } else {
      return PublishedState.PUBLISHED;
    }
  }

  protected outcomeDescription(result: EventPublishResult): string {
    if (result.outcome === EventPublishOutcome.FAILED) {
      return `could not be published - ${result.error}`;
    } else if (result.outcome === EventPublishOutcome.UNCHANGED) {
      return "already published and unchanged, so left alone";
    } else if (result.outcome === EventPublishOutcome.ALREADY_PUBLISHED) {
      return "already published - switch on republishing to post the change";
    } else if (result.outcome === EventPublishOutcome.REPUBLISHED) {
      return `posted again as ${result.permalink}`;
    } else {
      return `published as ${result.permalink}`;
    }
  }

  protected chooseImageFor(row: PublishableEventRow): void {
    this.uploadTargetEventId = row.eventId;
    const rootFolder = row.itemType === RamblersEventType.GROUP_EVENT
      ? RootFolder.socialEventsImages
      : RootFolder.walkImages;
    this.uploader = this.fileUploadService.createUploaderFor(rootFolder);
    this.uploadSubscription?.unsubscribe();
    this.uploadSubscription = this.uploader.response.subscribe((response: string | HttpErrorResponse) =>
      this.onImageUploaded(response));
    this.imageFileInput.nativeElement.value = null;
    this.imageFileInput.nativeElement.click();
  }

  protected onImageSelected(files: File[]): void {
    this.uploadingEventId = this.uploadTargetEventId;
    this.notify.progress({title: "Image upload", message: `Uploading ${files?.[0]?.name} - please wait`});
  }

  private async onImageUploaded(response: string | HttpErrorResponse): Promise<void> {
    const eventId = this.uploadTargetEventId;
    try {
      const uploaded: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      const awsFileName = uploaded?.fileNameData?.awsFileName;
      if (awsFileName && eventId) {
        const updated = await this.socialPublishService.attachEventImage(eventId, awsFileName);
        this.rows = this.rows.map(row => row.eventId === eventId
          ? {...row, ...updated, publishedState: this.publishedStateFor(updated)}
          : row);
        this.notify.success({title: "Image added", message: "The image is now on the event and will be used in the post"});
      } else {
        this.notify.warning({title: "Image not added", message: "The upload did not return a file name"});
      }
    } catch (error) {
      this.notify.error({title: "Could not add the image", message: error?.error?.error || error?.message || error});
    } finally {
      this.uploadingEventId = null;
      this.uploadTargetEventId = null;
    }
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const events = await this.socialPublishService.publishableEvents(this.dateRange.from, this.dateRange.to);
      this.rows = events.map(event => ({...event, publishedState: this.publishedStateFor(event)}));
      this.selectedEventIds = this.selectedEventIds.filter(eventId => this.rows.some(row => row.eventId === eventId));
      this.logger.info("refresh: returned", this.rows.length, "events");
    } catch (error) {
      this.notify.error({title: "Could not list events", message: error?.error?.error || error?.message || error});
    } finally {
      this.loading = false;
    }
  }

  async publishSelected(): Promise<void> {
    this.publishing = true;
    this.results = [];
    this.notify.progress({title: "Facebook", message: `Publishing ${this.selectedEventIds.length} events`});
    try {
      const republishChanged = !!this.config?.externalSystems?.facebook?.eventRepublishOnChange;
      this.results = await this.socialPublishService.publishEvents(this.selectedEventIds, [SocialNetwork.FACEBOOK], republishChanged);
      const failures = this.results.filter(result => result.outcome === EventPublishOutcome.FAILED);
      if (failures.length > 0) {
        this.notify.warning({title: "Some events could not be published", message: `${failures.length} of ${this.results.length} failed`});
      } else {
        this.notify.success({title: "Published", message: `${this.results.length} events posted to Facebook`});
      }
      await this.refresh();
    } catch (error) {
      this.notify.error({title: "Publishing failed", message: error?.error?.error || error?.message || error});
    } finally {
      this.publishing = false;
    }
  }
}
