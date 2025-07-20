import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faEdit, faUndo } from "@fortawesome/free-solid-svg-icons";
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
import { EditableEventStats } from "../../../models/group-event.model";
import { Confirm, ConfirmType } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-event-data-management",
  template: `
    <app-page pageTitle="Event Data Management">
      <div class="row">
        <div class="col-sm-12 mb-3 mx-2">
          <app-markdown-editor name="event-data-management-help-page" description="Event Data Management help page"/>
        </div>
      </div>
      @if (editableEventStats?.length > 0) {
        <div class="row mb-2 align-items-center">
          <div class="col">
            @if (oneOrMoreEdited) {
              @if (confirm.noneOutstanding()) {
                <button type="button" class="btn btn-success mr-2" (click)="bulkApply()">
                  Apply Changes
                </button>
              } @else if (confirm.bulkActionOutstanding()) {
                <button type="submit" class="btn btn-danger mr-2" (click)="bulkApplyConfirm()">
                  Confirm Apply of Changes
                </button>
                <button type="submit" class="btn btn-success mr-2" (click)="cancelConfirmAndAlert()">
                  Cancel
                </button>
              }
            }
            @if (oneOrMoreSelectedForDelete) {
              @if (confirm.noneOutstanding()) {
                <button type="submit" class="btn btn-danger mr-2" (click)="bulkDelete()">
                  Delete Selected
                </button>
              } @else if (confirm.bulkDeleteOutstanding()) {
                <button type="submit" class="btn btn-danger mr-2" (click)="bulkDeleteConfirm()">
                  Confirm Delete
                </button>
              }
              <button type="submit" class="btn btn-success mr-2" (click)="cancelConfirmAndAlert()">
                Cancel
              </button>
            }
            <input type="submit" value="Back To Walks Admin" (click)="navigateBackToAdmin()" class="btn btn-primary mr-2">
            <input type="submit" value="Recreate Group Event Index" (click)="recreateGroupEventsIndex()"
                   class="btn btn-danger">
          </div>
        </div>
        <div class="form-group">
          @if (alertTarget.showAlert) {
            <div class="alert {{alertTarget.alertClass}}">
              <fa-icon [icon]="alertTarget.alert.icon"/>
              @if (alertTarget.alertTitle) {
                <strong class="ml-1">{{ alertTarget.alertTitle }}: </strong>
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
                  <div class="custom-control custom-checkbox m-1">
                    <input id="select-all" type="checkbox" class="custom-control-input"
                           (change)="toggleSelectAllForDelete($event)"
                           [checked]="allSelected">
                    <label class="custom-control-label" for="select-all"></label>
                  </div>
                </th>
                <th>Event Type</th>
                <th>Group Code</th>
                <th>Group Name</th>
                <th>Events</th>
                <th>From</th>
                <th>To</th>
              </tr>
              </thead>
              <tbody>
                @for (eventStat of editableEventStats; track eventStat) {
                  <tr>
                    <td>
                      <div class="custom-control custom-checkbox m-1">
                        <input id="select-{{ $index }}" type="checkbox" class="custom-control-input"
                               [(ngModel)]="eventStat.selected" [ngModelOptions]="{standalone: true}"><label
                        class="custom-control-label"
                        for="select-{{ $index }}"></label>
                      </div>
                    </td>
                    <td>{{ eventStat.itemType }}</td>
                    @if (eventStat.edited) {
                      <td>
                        <div class="form-inline">
                          <fa-icon [icon]="faUndo" (click)="toggleEditMode(eventStat)"
                                   class="mr-2"
                                   tooltip="Cancel this edit"/>
                          <input type="text" [(ngModel)]="eventStat.editedGroupCode"
                                 class="form-control"
                                 [ngModelOptions]="{standalone: true}"
                                 (ngModelChange)="markAsEdited(eventStat)">
                        </div>
                      </td>
                      <td>
                        <input type="text" [(ngModel)]="eventStat.editedGroupName" class="form-control"
                               [ngModelOptions]="{standalone: true}" (ngModelChange)="markAsEdited(eventStat)">
                      </td>
                    } @else {
                      <td>
                        <fa-icon [icon]="faEdit" (click)="toggleEditMode(eventStat)"
                                 class="mr-2"
                                 tooltip="Edit this group code or name"/>
                        {{ eventStat.groupCode }}
                      </td>
                      <td>{{ eventStat.groupName }}</td>
                    }
                    <td>{{ eventStat.walkCount }}</td>
                    <td>{{ eventStat.minDate | displayDate }}</td>
                    <td>{{ eventStat.maxDate | displayDate }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </app-page>
  `,
  imports: [PageComponent, FontAwesomeModule, FormsModule, DisplayDatePipe, MarkdownEditorComponent, TooltipDirective]
})

export class EventDataManagement implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EventDataManagement", NgxLoggerLevel.INFO);
  private notifierService = inject(NotifierService);
  protected icons = inject(IconService);
  private systemConfigService = inject(SystemConfigService);
  private urlService = inject(UrlService);
  private stringUtilsService = inject(StringUtilsService);
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
      this.notify.success({title: "Event Data Management", message: "Events data loaded successfully"});
    } catch (error) {
      this.notify.error({title: "Event Data Management", message: error});
    }
  }

  private refreshStats() {
    this.walkGroupAdminService.eventStats().subscribe(data => {
      this.editableEventStats = data.map(stat => ({
        ...stat,
        editedGroupCode: stat.groupCode,
        editedGroupName: stat.groupName,
        edited: false
      }));
      this.logger.info("Event stats loaded:", this.editableEventStats);
    });
  }

  toggleSelectAllForDelete(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.allSelected = checked;
    this.editableEventStats.forEach(group => group.selected = checked);
  }

  async bulkDeleteConfirm() {
    try {
      this.walkGroupAdminService.bulkDeleteEvents(this.selectedEventStats.map(g => ({
        itemType: g.itemType,
        groupCode: g.groupCode
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
    this.confirm.clear();
    this.notify.hide();
  }

  toggleEditMode(eventStat: EditableEventStats) {
    eventStat.edited = !eventStat.edited;
    if (eventStat.edited) {
      eventStat.editedGroupCode = eventStat.groupCode;
      eventStat.editedGroupName = eventStat.groupName;
    }
  }

  markAsEdited(stat: EditableEventStats) {
    stat.edited = stat.editedGroupCode !== stat.groupCode || stat.editedGroupName !== stat.groupName;
  }

  async bulkApplyConfirm() {
    try {
      const updates = this.editableEventStats.filter(stat => stat.edited).map(stat => ({
        itemType: stat.itemType,
        groupCode: stat.groupCode,
        newGroupCode: stat.editedGroupCode,
        newGroupName: stat.editedGroupName
      }));
      await this.walkGroupAdminService.bulkUpdateEvents(updates).toPromise();
      this.refreshStats();
      this.notify.success({title: "Update Successful", message: "Group codes and names updated"});
    } catch (error) {
      this.notify.error({title: "Update Failed", message: error.message});
    }
  }

}
