import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
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
import { NgTemplateOutlet } from "@angular/common";
import { SystemConfig } from "../../../models/system.model";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { WalkGroupAdminService } from "../walk-import/walk-group-admin-service";
import { EventStats } from "../../../models/group-event.model";
import { Confirm, ConfirmType } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";

@Component({
  selector: "app-event-data-management",
  template: `
    <app-page pageTitle="Event Data Management">
      <div class="row">
        <div class="col-sm-12 mb-3 mx-2">
          <app-markdown-editor name="event-data-management-help-page" description="Event Data Management help page"/>
        </div>
      </div>
      <ng-template #backButton>
        <input type="submit" value="Back" (click)="navigateBackToAdmin()" class="ml-2 btn btn-primary">
      </ng-template>
      @if (eventStats.length > 0) {
        <div class="row mb-2 align-items-center">
          <div class="col">
            @if (confirm.noneOutstanding()) {
              <button type="submit" class="btn btn-danger" (click)="bulkDelete()" [disabled]="!selectedGroups.length">
                Delete Selected
              </button>
            } @else {
              <button type="submit" class="btn btn-danger" (click)="bulkDeleteConfirm()"
                      [disabled]="!selectedGroups.length">
                Confirm Delete
              </button>
              <button type="submit" class="btn btn-success ml-2" (click)="cancelDelete()"
                      [disabled]="!selectedGroups.length">
                Cancel
              </button>
            }
            <ng-container *ngTemplateOutlet="backButton"/>
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
                           (change)="toggleSelectAll($event)"
                           [checked]="allSelected">
                    <label class="custom-control-label" for="select-all">All</label>
                  </div>
                </th>
                <th>Event Type</th>
                <th>Group Code</th>
                <th>Events</th>
                <th>From</th>
                <th>To</th>
                @if (false) {
                  <th>Unique Creators</th>
                }
              </tr>
              </thead>
              <tbody>
                @for (eventStat of eventStats; let index = $index; track index) {
                  <tr>
                    <td>
                      <div class="custom-control custom-checkbox m-1">
                        <input id="select-{{index}}" type="checkbox" class="custom-control-input"
                               [(ngModel)]="eventStat.selected" [ngModelOptions]="{standalone: true}"><label
                        class="custom-control-label"
                        for="select-{{index}}"></label>
                      </div>
                    </td>
                    <td>{{ eventStat.itemType }}</td>
                    <td>{{ eventStat.groupCode }}</td>
                    <td>{{ eventStat.walkCount }}</td>
                    <td>{{ eventStat.minDate | displayDate }}</td>
                    <td>{{ eventStat.maxDate | displayDate }}</td>
                    @if (false) {
                      <td>{{ eventStat.uniqueCreators.join(", ") }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </app-page>
  `,
  imports: [PageComponent, FontAwesomeModule, FormsModule, NgTemplateOutlet, DisplayDatePipe, MarkdownEditorComponent]
})

export class EventDataManagement implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EventDataManagement", NgxLoggerLevel.ERROR);
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
  protected eventStats: EventStats[] = [];
  protected allSelected = false;

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
      this.eventStats = data;
    });
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.allSelected = checked;
    this.eventStats.forEach(group => group.selected = checked);
  }

  get selectedGroups() {
    return this.eventStats.filter(group => group.selected);
  }

  async bulkDeleteConfirm() {
    try {
      this.walkGroupAdminService.bulkDeleteEvents(this.selectedGroups.map(g => ({
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
    if (this.selectedGroups.length > 0) {
      this.confirm.as(ConfirmType.BULK_DELETE);
      this.notify.warning(`Delete ${this.stringUtilsService.pluraliseWithCount(this.selectedGroups.length, "group selection")}? This action cannot be undone.`);
    }
  }

  navigateBackToAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  cancelDelete() {
    this.confirm.clear();
    this.notify.hide();
  }
}
