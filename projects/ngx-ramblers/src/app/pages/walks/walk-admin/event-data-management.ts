import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit";
import { faUndo } from "@fortawesome/free-solid-svg-icons/faUndo";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { IconService } from "../../../services/icon-service/icon-service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { SystemConfig } from "../../../models/system.model";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { WalkGroupAdminService } from "../walk-import/walk-group-admin-service";
import { EditableEventStats, ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { Confirm, ConfirmType } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { Location, TitleCasePipe } from "@angular/common";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { sortBy } from "../../../functions/arrays";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { csvContentFrom, CsvOptions } from "../../../csv-export/csv-export";
import { LocalWalksAndEventsService } from "../../../services/walks-and-events/local-walks-and-events.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import {
  CsvZipFileWithCount,
  CsvZipRequest,
  WalkUploadColumnHeading,
  WalkUploadRow
} from "../../../models/ramblers-walks-manager";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

const EXPORT_EVENT_QUERY_LIMIT = 100000;
import { EventField, GroupEventField, WALK_IMAGE_CSV_COLUMN_HEADINGS, WalkImageRow } from "../../../models/walk.model";

@Component({
  selector: "app-event-data-management",
  template: `
    <app-page pageTitle="Event Data Management">
      <div class="row">
        <div class="col-sm-12 mb-3 mx-2">
          <app-markdown-editor standalone name="event-data-management-help-page" description="Event Data Management help page"/>
        </div>
      </div>
      <div class="row mb-2 align-items-center">
        <div class="col">
          @if (oneOrMoreEdited) {
            @if (confirm.noneOutstanding()) {
              <button type="button" class="btn btn-success me-2" (click)="bulkApply()">
                Apply Changes
              </button>
            } @else if (confirm.bulkActionOutstanding()) {
              <button type="submit" class="btn btn-danger me-2" (click)="bulkApplyConfirm()">
                Confirm Apply of Changes
              </button>
              <button type="submit" class="btn btn-success me-2" (click)="cancelConfirmAndAlert()">
                Cancel
              </button>
            }
          }
          @if (oneOrMoreSelectedForDelete) {
            @if (confirm.noneOutstanding()) {
              <button type="submit" class="btn btn-danger me-2" (click)="bulkDelete()">
                Delete Selected
              </button>
            } @else if (confirm.bulkDeleteOutstanding()) {
              <button type="submit" class="btn btn-danger me-2" (click)="bulkDeleteConfirm()">
                Confirm Delete
              </button>
            }
            <button type="submit" class="btn btn-success me-2" (click)="cancelConfirmAndAlert()">
              Cancel
            </button>
          }
          <input type="submit" value="Back To Walks Admin" (click)="navigateBackToAdmin()"
                 class="btn btn-primary me-2">
          @if (!oneOrMoreEdited) {
            <input type="submit" [value]="exportButtonLabel()" (click)="exportWalksManagerCsv()"
                   [disabled]="exporting || selectedEventStats.length === 0" class="btn btn-primary me-2">
            <input type="submit" [value]="rematching ? 'Re-matching Walk Leaders...' : 'Re-match Walk Leaders'"
                   (click)="rematchWalkLeaders()" [disabled]="rematching" class="btn btn-primary me-2">
            <div class="form-check form-check-inline">
              <input id="include-walk-ids" type="checkbox" class="form-check-input" [(ngModel)]="includeWalkIds">
              <label class="form-check-label" for="include-walk-ids">Include Walk IDs</label>
            </div>
            <div class="form-check form-check-inline">
              <input id="include-images" type="checkbox" class="form-check-input" [(ngModel)]="includeImages">
              <label class="form-check-label" for="include-images">Include Images</label>
            </div>
          }
        </div>
      </div>
      <div class="form-group">
        @if (alertTarget.showAlert) {
          <div class="alert {{alertTarget.alertClass}}">
            <fa-icon [icon]="alertTarget.alert.icon"/>
            @if (alertTarget.alertTitle) {
              <strong class="ms-1">{{ alertTarget.alertTitle }}: </strong>
            } {{ alertTarget.alertMessage }}
          </div>
        }
      </div>
      <div class="row">
        <div class="col-sm-12">
          <div class="ngx-data-table-card">
          <table class="ngx-data-table">
            <thead>
            <tr>
              <th>
                <div class="form-check m-1">
                  <input id="select-all" type="checkbox" class="form-check-input"
                         (change)="toggleSelectAllForDelete($event)"
                         [checked]="allSelected">
                  <label class="form-check-label" for="select-all"></label>
                </div>
              </th>
              <th class="sortable" (click)="sortBy('itemType')">
                Event Type
                @if (sortField === 'itemType') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th>Edit</th>
              <th class="sortable" (click)="sortBy('groupCode')">
                Group Code
                @if (sortField === 'groupCode') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th class="sortable" (click)="sortBy('groupName')">
                Group Name
                @if (sortField === 'groupName') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th class="sortable" (click)="sortBy('inputSource')">
                Input Source
                @if (sortField === 'inputSource') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th class="sortable" (click)="sortBy('eventCount')">
                Event Count
                @if (sortField === 'eventCount') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th class="sortable" (click)="sortBy('duplicateCount')">
                Duplicates
                @if (sortField === 'duplicateCount') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th class="sortable" (click)="sortBy('minDate')">
                From
                @if (sortField === 'minDate') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th class="sortable" (click)="sortBy('maxDate')">
                To
                @if (sortField === 'maxDate') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th class="sortable" (click)="sortBy('lastSyncedAt')">
                Last Updated
                @if (sortField === 'lastSyncedAt') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
            </tr>
            </thead>
            <tbody>
              @for (eventStat of editableEventStats; track eventStat) {
                <tr>
                  <td>
                    <div class="form-check m-1">
                      <input id="select-{{ $index }}" type="checkbox" class="form-check-input"
                             [(ngModel)]="eventStat.selected" [ngModelOptions]="{standalone: true}"><label
                      class="form-check-label"
                      for="select-{{ $index }}"></label>
                    </div>
                  </td>
                  <td>{{ eventStat.itemType | humanise }}</td>
                  <td>
                    @if (eventStat.edited) {
                      <fa-icon [icon]="faUndo" (click)="toggleEditMode(eventStat)"
                               class="me-2"
                               tooltip="Cancel this edit"/>
                    } @else {
                      <fa-icon [icon]="faEdit" (click)="toggleEditMode(eventStat)"
                               class="me-2"
                               tooltip="Edit this group code or name"/>
                    }</td>
                  @if (eventStat.edited) {
                    <td>
                      <input type="text" [(ngModel)]="eventStat.editedGroupCode"
                             class="form-control"
                             [ngModelOptions]="{standalone: true}"
                             (ngModelChange)="markAsEdited(eventStat)">
                    </td>
                    <td>
                      <input type="text" [(ngModel)]="eventStat.editedGroupName" class="form-control"
                             [ngModelOptions]="{standalone: true}" (ngModelChange)="markAsEdited(eventStat)">
                    </td>
                    <td>
                      <select class="form-control"
                              [(ngModel)]="eventStat.editedInputSource"
                              [ngModelOptions]="{standalone: true}"
                              (ngModelChange)="markAsEdited(eventStat)">
                        @for (source of inputSources; track source.value) {
                          <option
                            [ngValue]="source.value">{{ stringUtilsService.asTitle(source.value) }}
                          </option>
                        }
                      </select>
                    </td>
                  } @else {
                    <td>
                      {{ eventStat.groupCode }}
                    </td>
                    <td>{{ eventStat.groupName }}</td>
                    <td>{{ eventStat.inputSource | titlecase | humanise }}</td>
                  }
                  <td>{{ eventStat.eventCount }}</td>
                  <td [class.bg-danger]="eventStat.duplicateCount > 0" [class.text-white]="eventStat.duplicateCount > 0">{{ eventStat.duplicateCount }}</td>
                  <td>{{ eventStat.minDate | displayDate }}</td>
                  <td>{{ eventStat.maxDate | displayDate }}</td>
                  <td>{{ eventStat.lastSyncedAt | displayDate }}</td>
                </tr>
              }
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </app-page>
  `,
  imports: [PageComponent, FontAwesomeModule, FormsModule, DisplayDatePipe, MarkdownEditorComponent, TooltipDirective, HumanisePipe, TitleCasePipe]
})

export class EventDataManagement implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EventDataManagement", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  protected icons = inject(IconService);
  private systemConfigService = inject(SystemConfigService);
  private location = inject(Location);
  private urlService = inject(UrlService);
  protected stringUtilsService = inject(StringUtilsService);
  private walkGroupAdminService = inject(WalkGroupAdminService);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private http = inject(HttpClient);
  protected alertTarget: AlertTarget = {};
  protected notify: AlertInstance;
  public confirm: Confirm = new Confirm();
  private subscriptions: Subscription[] = [];
  protected systemConfig: SystemConfig;
  protected editableEventStats: EditableEventStats[] = [];
  protected allSelected = false;
  protected includeWalkIds = false;
  protected includeImages = false;
  protected exporting = false;
  protected rematching = false;
  faEdit = faEdit;
  faUndo = faUndo;
  inputSources: KeyValue<string>[] = enumKeyValues(InputSource);
  sortField: string = "itemType";
  sortDirection: string = ASCENDING;
  protected readonly ASCENDING = ASCENDING;
  protected readonly DESCENDING = DESCENDING;

  get oneOrMoreSelectedForDelete(): boolean {
    return this.selectedEventStats.length > 0;
  }

  get oneOrMoreEdited(): boolean {
    return this.editedEventStats.length > 0;
  }

  get editedEventStats() {
    return this.editableEventStats.filter(eventStatus => eventStatus.edited);
  }

  get selectedEventStats() {
    return this.editableEventStats.filter(eventStatus => eventStatus.selected);
  }

  get totalEventCount() {
    return this.editableEventStats.reduce((sum, stat) => sum + stat.eventCount, 0);
  }

  async ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.alertTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(async systemConfig => {
      this.systemConfig = systemConfig;
    }));
    await this.loadWalkGroups();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async loadWalkGroups() {
    try {
      this.refreshStats();
    } catch (error) {
      this.notify.error({title: "Event Data Management", message: error});
    }
  }

  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === ASCENDING ? DESCENDING : ASCENDING;
    } else {
      this.sortField = field;
      this.sortDirection = ASCENDING;
    }
    this.applySorting();
  }

  applySorting() {
    const direction = this.sortDirection === ASCENDING ? "" : "-";
    this.editableEventStats = this.editableEventStats.sort(sortBy(`${direction}${this.sortField}`));
  }

  private refreshStats() {
    this.walkGroupAdminService.eventStats().subscribe(data => {
      this.editableEventStats = data.map(stat => ({
        ...stat,
        editedGroupCode: stat.groupCode,
        editedGroupName: stat.groupName,
        editedInputSource: stat.inputSource,
        edited: false
      }));
      this.applySorting();
      this.logger.info("Event stats loaded:", this.editableEventStats);
      if (this.editableEventStats.length === 0) {
        this.notify.warning({
          title: "Event Data Management",
          message: "No events currently exist in your database. Visit the Walks -> Admin -> Ramblers Walks Admin Import page to create some"
        });
      } else {
        this.notify.success({title: "Event Data Management", message: `${this.stringUtilsService.pluraliseWithCount(this.totalEventCount, "Event")} loaded successfully`});
      }
    });
  }

  toggleSelectAllForDelete(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.allSelected = checked;
    this.editableEventStats.forEach(group => group.selected = checked);
  }

  async bulkDeleteConfirm() {
    try {
      this.walkGroupAdminService.bulkDeleteEvents(this.selectedEventStats.map(eventStats => ({
        itemType: eventStats.itemType,
        groupCode: eventStats.groupCode,
        inputSource: eventStats.inputSource
      }))).subscribe(done => {
        this.refreshStats();
      });
      this.allSelected = false;
      this.notify.success({title: "Delete Successful", message: "Selected walk groups deleted"});
      this.confirm.clear();
    } catch (error) {
      this.notify.error({title: "Delete Failed", message: error.message});
    }
  }

  async bulkDelete() {
    this.confirm.as(ConfirmType.BULK_DELETE);
    this.notify.warning(`Delete ${this.stringUtilsService.pluraliseWithCount(this.selectedEventStats.length, "group selection")}? This action cannot be undone.`);
  }

  async bulkApply() {
    this.confirm.as(ConfirmType.BULK_ACTION);
    this.notify.warning(`Apply ${this.stringUtilsService.pluraliseWithCount(this.editedEventStats.length, "group code / name selection")}? This action cannot be undone.`);
  }

  navigateBackToAdmin() {
    this.location.back();
  }

  async rematchWalkLeaders() {
    this.rematching = true;
    try {
      const summary = await firstValueFrom(this.walkGroupAdminService.rematchWalkLeaders());
      const outcome = [
        `${this.stringUtilsService.pluraliseWithCount(summary.matched, "event")} newly matched to a member`,
        `${summary.unmatchedWithName} with leader details but no confident member match`,
        `${summary.noNameToMatchOn} with no leader details to match on`,
        `${summary.alreadyLinked} already linked`
      ].join(", ");
      this.notify.success({title: "Walk Leader Re-match", message: outcome});
    } catch (error) {
      this.notify.error({title: "Walk Leader Re-match", message: error?.error?.message || error});
    } finally {
      this.rematching = false;
    }
  }

  exportButtonLabel(): string {
    if (this.exporting) {
      return "Exporting...";
    }
    return this.selectedEventStats.length > 0
      ? `Export ${this.stringUtilsService.pluraliseWithCount(this.selectedEventStats.length, "Selected Group")} To CSV`
      : "Export Selected Groups To CSV";
  }

  async exportWalksManagerCsv() {
    this.exporting = true;
    try {
      const files = await this.selectedEventStats.reduce(async (previous: Promise<CsvZipFileWithCount[]>, stat) => {
        const collected = await previous;
        return [...collected, ...await this.csvFilesFor(stat)];
      }, Promise.resolve([] as CsvZipFileWithCount[]));
      const totalEvents = files.reduce((sum, file) => sum + file.eventCount, 0);
      if (files.length === 1) {
        this.downloadBlob(new Blob([files[0].content], {type: "text/csv;charset=utf8;"}), files[0].name);
      } else {
        const zipFileName = `${this.ramblersWalksAndEventsService.exportWalksFileName(true)}.zip`;
        const zip = await firstValueFrom(this.http.post(`api/database/walks/csv-zip`, {
          fileName: zipFileName,
          files: files.map(file => ({name: file.name, content: file.content}))
        } as CsvZipRequest, {responseType: "blob"}));
        this.downloadBlob(zip, zipFileName);
      }
      this.notify.success({
        title: "Export To CSV",
        message: `${this.stringUtilsService.pluraliseWithCount(totalEvents, "event")} exported to ${this.stringUtilsService.pluraliseWithCount(files.length, "file")} in a single download`
      });
    } catch (error) {
      this.notify.error({title: "Export To CSV", message: error});
    } finally {
      this.exporting = false;
    }
  }

  private async csvFilesFor(stat: EditableEventStats): Promise<CsvZipFileWithCount[]> {
    const events = (await this.localWalksAndEventsService.all({
      inputSource: stat.inputSource,
      suppressEventLinking: true,
      groupCode: stat.groupCode,
      types: [stat.itemType],
      dataQueryOptions: {
        criteria: {[EventField.INPUT_SOURCE]: stat.inputSource},
        sort: {[GroupEventField.START_DATE]: 1},
        limit: EXPORT_EVENT_QUERY_LIMIT
      }
    })).sort(sortBy(GroupEventField.START_DATE));
    const rows: WalkUploadRow[] = await Promise.all(events.map(async event => {
      const row = await this.ramblersWalksAndEventsService.walkToWalkUploadRow(event);
      return this.includeWalkIds ? {...row, [WalkUploadColumnHeading.WALK_ID]: this.walkIdFor(event)} : row;
    }));
    const walksFile: CsvZipFileWithCount = {
      name: `${this.exportFileNameFor(stat)}.csv`,
      content: csvContentFrom(rows, this.csvOptionsFor(this.ramblersWalksAndEventsService.walkUploadHeadings(this.includeWalkIds))),
      eventCount: rows.length
    };
    const imageRows: WalkImageRow[] = this.includeImages ? events.flatMap(event => this.walkImageRowsFor(event)) : [];
    return imageRows.length > 0
      ? [walksFile, {
        name: `${this.exportFileNameFor(stat)}-images.csv`,
        content: csvContentFrom(imageRows, this.csvOptionsFor(WALK_IMAGE_CSV_COLUMN_HEADINGS)),
        eventCount: 0
      }]
      : [walksFile];
  }

  private walkImageRowsFor(event: ExtendedGroupEvent): WalkImageRow[] {
    return (event.groupEvent?.media || [])
      .map(media => media.styles?.find(style => style.style === "medium")?.url || media.styles?.[0]?.url)
      .filter(url => !!url)
      .map(url => this.urlService.imageSource(url, true))
      .map((absoluteUrl, index) => ({
        "Walk ID": this.walkIdFor(event),
        "Image GUID": absoluteUrl,
        "Local Filename": this.fileNameFromUrl(absoluteUrl),
        "Image Order": `${index + 1}`
      }));
  }

  private walkIdFor(event: ExtendedGroupEvent): string {
    return event.groupEvent?.id || event.id;
  }

  private fileNameFromUrl(url: string): string {
    try {
      return decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    } catch {
      return url.split("?")[0].split("/").pop() || "";
    }
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private exportFileNameFor(stat: EditableEventStats): string {
    return [
      this.ramblersWalksAndEventsService.exportWalksFileName(true),
      stat.groupCode,
      this.stringUtilsService.kebabCase(stat.groupName),
      this.stringUtilsService.kebabCase(stat.itemType),
      this.stringUtilsService.kebabCase(stat.inputSource)
    ].filter(part => !!part).join("-");
  }

  private csvOptionsFor(headings: string[]): CsvOptions {
    return {
      decimalSeparator: "",
      filename: "",
      showLabels: false,
      title: "",
      fieldSeparator: ",",
      quoteStrings: "\"",
      headers: headings,
      keys: headings,
      showTitle: false,
      useBom: false,
      removeNewLines: true
    };
  }

  cancelConfirmAndAlert() {
    this.editableEventStats.forEach(eventStatus => {
      eventStatus.edited = false;
      eventStatus.selected = false;
    });
    this.allSelected = false;
    this.confirm.clear();
    this.notify.hide();
  }

  toggleEditMode(eventStat: EditableEventStats) {
    eventStat.edited = !eventStat.edited;
    if (eventStat.edited) {
      eventStat.editedGroupCode = eventStat.groupCode;
      eventStat.editedGroupName = eventStat.groupName;
      eventStat.editedInputSource = eventStat.inputSource;
    }
  }

  markAsEdited(stat: EditableEventStats) {
    stat.edited = stat.editedGroupCode !== stat.groupCode || stat.editedGroupName !== stat.groupName || stat.editedInputSource !== stat.inputSource;
    this.logger.info("markAsEdited called for stat:", stat);
  }

  async bulkApplyConfirm() {
    try {
      await this.walkGroupAdminService.bulkUpdateEvents(this.editedEventStats).toPromise();
      this.refreshStats();
      this.notify.success({title: "Update Successful", message: "Group codes, names, and input sources updated"});
    } catch (error) {
      this.notify.error({title: "Update Failed", message: error.message});
    }
  }
}
