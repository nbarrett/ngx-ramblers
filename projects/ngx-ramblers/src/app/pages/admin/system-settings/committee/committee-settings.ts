import { Component, inject, OnDestroy, OnInit } from "@angular/core";
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
import { isEqual } from "es-toolkit/compat";
import { PageComponent } from "../../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { CommitteeMemberComponent } from "./committee-member";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-committee-settings",
    template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          @if (committeeConfig) {
            <tabset class="custom-tabset">
              <tab heading="Committee Members">
                @if (committeeConfig) {
                  <div class="img-thumbnail thumbnail-admin-edit">
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
                      @for (role of committeeConfig.roles; track role.nameAndDescription) {
                        <app-committee-member [committeeMember]="role" [index]="committeeConfig.roles.indexOf(role)"
                                              [roles]="committeeConfig.roles"/>
                      }
                    </div>
                  </div>
                }
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
                  @for (fileType of committeeConfig.fileTypes; track fileType.description; let fileTypeIndex = $index) {
                    <div class="row">
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
                          <div class="form-check">
                            <input [(ngModel)]="fileType.public"
                                   type="checkbox" class="form-check-input"
                                   [id]="stringUtils.kebabCase('public', fileTypeIndex)">
                            <label class="form-check-label" [for]="stringUtils.kebabCase('public', fileTypeIndex)">
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
                  }
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
                      @if (committeeConfig?.expenses) {
                        <input [(ngModel)]="committeeConfig.expenses.costPerMile"
                               type="text"
                               class="form-control input-sm" id="cost-per-mile"
                               placeholder="Enter cost per mile for travel expenses here">
                      }
                    </div>
                  </div>
                </div>
              </tab>
            </tabset>
          }
          @if (notifyTarget.showAlert) {
            <div class="row">
              <div class="col-sm-12 mb-10">
                <div class="alert {{notifyTarget.alert.class}}">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  @if (notifyTarget.alertTitle) {
                    <strong>
                      {{ notifyTarget.alertTitle }}: </strong>
                  } {{ notifyTarget.alertMessage }}
                </div>
              </div>
            </div>
          }
        </div>
        <div class="col-sm-12">
          <input type="submit" value="Save settings and exit" (click)="saveAndExit()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
          <input type="submit" value="Save" (click)="save()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
          <input type="submit" value="Undo Changes" (click)="undoChanges()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
          <input type="submit" value="Exit Without Saving" (click)="cancel()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
        </div>
      </div>
    </app-page>`,
    imports: [PageComponent, TabsetComponent, TabDirective, MarkdownEditorComponent, BadgeButtonComponent, CommitteeMemberComponent, TooltipDirective, FontAwesomeModule, FormsModule, NgClass]
})
export class CommitteeSettingsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private committeeConfigService = inject(CommitteeConfigService);
  protected dateUtils = inject(DateUtilsService);
  private subscription: Subscription;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
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
