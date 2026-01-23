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
import { EditableEventStats, InputSource } from "../../../models/group-event.model";
import { Confirm, ConfirmType } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { TitleCasePipe } from "@angular/common";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { sortBy } from "../../../functions/arrays";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";

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
          @if (!oneOrMoreEdited && !oneOrMoreSelectedForDelete) {
            <input type="submit" value="Recreate Group Event Index" (click)="recreateGroupEventsIndex()"
                   [disabled]="oneOrMoreEdited || oneOrMoreSelectedForDelete" class="btn btn-danger">
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
          <table class="styled-table table-striped table-hover table-sm table-pointer">
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
              <th (click)="sortBy('itemType')" class="pointer">
                Event Type
                @if (sortField === 'itemType') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th>Edit</th>
              <th (click)="sortBy('groupCode')" class="pointer">
                Group Code
                @if (sortField === 'groupCode') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th (click)="sortBy('groupName')" class="pointer">
                Group Name
                @if (sortField === 'groupName') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th (click)="sortBy('inputSource')" class="pointer">
                Input Source
                @if (sortField === 'inputSource') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th (click)="sortBy('eventCount')" class="pointer">
                Event Count
                @if (sortField === 'eventCount') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th (click)="sortBy('duplicateCount')" class="pointer">
                Duplicates
                @if (sortField === 'duplicateCount') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th (click)="sortBy('minDate')" class="pointer">
                From
                @if (sortField === 'minDate') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th (click)="sortBy('maxDate')" class="pointer">
                To
                @if (sortField === 'maxDate') {
                  <span class="sorting-header">{{ sortDirection }}</span>
                }
              </th>
              <th (click)="sortBy('lastSyncedAt')" class="pointer">
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
    </app-page>
  `,
  imports: [PageComponent, FontAwesomeModule, FormsModule, DisplayDatePipe, MarkdownEditorComponent, TooltipDirective, HumanisePipe, TitleCasePipe]
})

export class EventDataManagement implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EventDataManagement", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  protected icons = inject(IconService);
  private systemConfigService = inject(SystemConfigService);
  private urlService = inject(UrlService);
  protected stringUtilsService = inject(StringUtilsService);
  private walkGroupAdminService = inject(WalkGroupAdminService);
  protected alertTarget: AlertTarget = {};
  protected notify: AlertInstance;
  public confirm: Confirm = new Confirm();
  private subscriptions: Subscription[] = [];
  protected systemConfig: SystemConfig;
  protected editableEventStats: EditableEventStats[] = [];
  protected allSelected = false;
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
    this.urlService.navigateTo(["walks", "admin"]);
  }

  recreateGroupEventsIndex() {
    this.walkGroupAdminService.recreateGroupEventsIndex()
      .subscribe(response => this.notify.warning({title: "Recreate Index", message: response}));
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
