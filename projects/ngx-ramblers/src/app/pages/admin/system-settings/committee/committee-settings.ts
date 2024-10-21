import { Component, OnDestroy, OnInit } from "@angular/core";
import { faAdd, faClose, faSortAlphaAsc } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import {
  CommitteeConfig,
  CommitteeFileType,
  DEFAULT_COST_PER_MILE,
  Notification
} from "../../../../models/committee.model";
import { sortBy } from "../../../../functions/arrays";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { Subscription } from "rxjs";
import isEqual from "lodash-es/isEqual";

@Component({
  selector: "app-committee-settings",
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <tabset class="custom-tabset" *ngIf="committeeConfig">
            <tab heading="Committee Members">
              <div *ngIf="committeeConfig" class="img-thumbnail thumbnail-admin-edit">
                <div class="col-sm-12 mt-2 mb-2">
                  <app-markdown-editor category="admin" name="committee-roles-help"
                                       description="Committee roles help"></app-markdown-editor>
                </div>
                <div class="col-sm-12">
                  <app-badge-button [disabled]="oneOrMoreRolesNotSaved()" [icon]="faAdd" (click)="createNewRole()"
                                    caption="Add new role"/>
                  <app-badge-button [icon]="faSortAlphaAsc" (click)="sortRoles()"
                                    caption="Sort Roles"/>
                </div>
                <div class="col-sm-12">
                  <ng-container *ngFor="let role of committeeConfig.roles">
                    <app-committee-member [committeeMember]="role" [index]="committeeConfig.roles.indexOf(role)"
                                          [roles]="committeeConfig.roles"/>
                  </ng-container>
                </div>
              </div>
            </tab>
            <tab heading="File Types">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row">
                  <div class="col-sm-12 mt-2 mb-2">
                    <app-markdown-editor category="admin" name="committee-file-types-help"
                                         description="Committee file types help"></app-markdown-editor>
                  </div>
                </div>
                <div class="badge-button mb-3" (click)="addFileType()"
                     delay=500 tooltip="Add new file type">
                  <fa-icon [icon]="faAdd"></fa-icon>
                  Add new file type
                </div>
                <div *ngFor="let fileType of committeeConfig.fileTypes; let fileTypeIndex = index;" class="row">
                  <div class="col-sm-8">
                    <div class="form-group">
                      <label [for]="stringUtils.kebabCase('file-type', fileTypeIndex)">File Type</label>
                      <input [id]="stringUtils.kebabCase('file-type', fileTypeIndex)" type="text"
                             class="form-control input-sm"
                             placeholder="Enter File Type Description" [(ngModel)]="fileType.description">
                    </div>
                  </div>
                  <div class="col-sm-3">
                    <div class="form-group mt-5">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="fileType.public"
                               type="checkbox" class="custom-control-input"
                               [id]="stringUtils.kebabCase('public', fileTypeIndex)">
                        <label class="custom-control-label" [for]="stringUtils.kebabCase('public', fileTypeIndex)">
                          Visible by Public</label>
                      </div>
                    </div>
                  </div>
                  <div class="col-sm-1 mt-5">
                    <div class="badge-button" (click)="deleteFileType(fileType)"
                         delay=500 tooltip="Delete file type">
                      <fa-icon [icon]="faClose"></fa-icon>
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="Expenses">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row">
                  <div class="col-sm-12 mt-2 mb-2">
                    <app-markdown-editor category="admin" name="committee-expenses-help"
                                         description="Committee file expenses help"></app-markdown-editor>
                  </div>
                </div>
                <div class="col-sm-12">
                  <div class="form-group">
                    <label for="cost-per-mile">Cost Per Mile</label>
                    <input *ngIf="committeeConfig?.expenses" [(ngModel)]="committeeConfig.expenses.costPerMile"
                           type="text"
                           class="form-control input-sm" id="cost-per-mile"
                           placeholder="Enter cost per mile for travel expenses here">
                  </div>
                </div>
              </div>
            </tab>
          </tabset>
          <div *ngIf="notifyTarget.showAlert" class="row">
            <div class="col-sm-12 mb-10">
              <div class="alert {{notifyTarget.alert.class}}">
                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                <strong *ngIf="notifyTarget.alertTitle">
                  {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
              </div>
            </div>
          </div>
        </div>
        <div class="col-sm-12">
          <input type="submit" value="Save settings and exit" (click)="saveAndExit()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm green-confirm button-form-left'">
          <input type="submit" value="Save" (click)="save()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm green-confirm button-form-left'">
          <input type="submit" value="Undo Changes" (click)="undoChanges()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm button-form-left'">
          <input type="submit" value="Exit Without Saving" (click)="cancel()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm button-form-left'">
        </div>
      </div>
    </app-page>`,
})
export class CommitteeSettingsComponent implements OnInit, OnDestroy {

  constructor(public stringUtils: StringUtilsService,
              private urlService: UrlService,
              private committeeConfigService: CommitteeConfigService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeSettingsComponent, NgxLoggerLevel.ERROR);
  }

  private subscription: Subscription;


  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  private logger: Logger;
  public committeeConfig: CommitteeConfig;
  protected readonly faClose = faClose;
  protected readonly faAdd = faAdd;

  protected readonly faSortAlphaAsc = faSortAlphaAsc;

  ngOnInit() {
    this.subscription = this.committeeConfigService.committeeConfigEvents().subscribe(committeeConfig => {
      this.committeeConfig = committeeConfig;
      if (!this.committeeConfig?.expenses) {
        this.committeeConfig.expenses = {costPerMile: DEFAULT_COST_PER_MILE};
      }
      this.logger.info("retrieved committeeConfig", committeeConfig);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  saveAndExit() {
    this.save()
      .then(() => this.urlService.navigateTo(["admin"]))
      .catch((error) => this.notify.error(error));
  }

  save() {
    this.logger.info("saving config", this.committeeConfig);
    this.committeeConfig.fileTypes = this.committeeConfig.fileTypes.sort(sortBy("description"));
    return this.committeeConfigService.saveConfig(this.committeeConfig);
  }

  cancel() {
    this.undoChanges();
    this.urlService.navigateTo(["admin"]);
  }

  notReady() {
    return !this.committeeConfig;
  }

  deleteFileType(fileType: CommitteeFileType) {
    this.committeeConfig.fileTypes = this.committeeConfig.fileTypes.filter(item => item !== fileType);
  }

  addFileType() {
    this.committeeConfig.fileTypes.push({description: "(Enter new file type)"});
  }

  oneOrMoreRolesNotSaved() {
    return this.committeeConfig.roles.some(role => isEqual(this.committeeConfigService.emptyCommitteeMember(), role));

  }

  createNewRole() {
    this.committeeConfig.roles.splice(0, 0, this.committeeConfigService.emptyCommitteeMember());
  }

  sortRoles() {
    this.committeeConfig.roles = this.committeeConfig.roles.sort(sortBy("roleType", "description"));
  }


  undoChanges() {
    this.committeeConfigService.refreshConfig();
  }
}
