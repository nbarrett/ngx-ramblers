import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksImportService } from "../../../services/walks/walks-import.service";
import { BulkLoadMemberAndMatchToWalks, WalksImportPreparation } from "../../../models/member.model";
import sum from "lodash-es/sum";
import { StringUtilsService } from "../../../services/string-utils.service";
import { IconService } from "../../../services/icon-service/icon-service";
import { PageComponent } from "../../../page/page.component";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";

@Component({
    selector: "app-walk-import",
    template: `
      <app-page pageTitle="Walks Manager Import">
        <div class="row">
          <div class="col-sm-12 mb-3 mx-2">
            <app-markdown-editor name="ramblers-import-help-page" description="Ramblers import help page"/>
          </div>
        </div>
        <div class="row mb-2">
          <div class="col-sm-12 form-inline">
            @if (!walksImportPreparation) {
              <input type="submit"
                value="Collect importable walks from Walks Manager"
                (click)="collectAvailableWalks()"
                [disabled]="importInProgress || this.display.walkPopulationLocal()" class="btn btn-primary">
            }
            @if (!!walksImportPreparation) {
              <input type="submit"
                value="Import And Save Walks Locally"
                (click)="importAndSaveWalksLocally()"
                [disabled]="importInProgress || this.display.walkPopulationLocal()" class="btn btn-primary">
            }
            @if (!!walksImportPreparation) {
              <input type="submit"
                value="Reset"
                (click)="reset()"
                [disabled]="importInProgress" class="ml-2 btn btn-primary">
            }
            <input type="submit" value="Back to Walks Admin" (click)="navigateBackToAdmin()"
              title="Back to walks"
              class="ml-2 btn btn-primary">
          </div>
        </div>
        <div class="form-group">
          @if (alertTarget.showAlert) {
            <div class="alert {{alertTarget.alertClass}}">
              <fa-icon [icon]="alertTarget.alert.icon"></fa-icon>
              @if (alertTarget.alertTitle) {
                <strong>
                {{ alertTarget.alertTitle }}: </strong>
                } {{ alertTarget.alertMessage }}
              </div>
            }
          </div>
          @if (messages.length>0) {
            <div class="row">
              @if (!importInProgress) {
                <div class="col-sm-12 mb-2">
                  <h3>Summary Import Information</h3>
                </div>
              }
              @for (message of messages; track message) {
                <div class="col-sm-4">
                  <ul class="list-arrow">
                    <li>{{ message }}</li>
                  </ul>
                </div>
              }
            </div>
          }
          @if (walksImportPreparation?.bulkLoadMembersAndMatchesToWalks?.length>0) {
            <div class="row">
              <div class="col-sm-12">
                <h3>Matching of Walks to Walk Leaders and Members</h3>
                <table class="round styled-table table-striped table-hover table-sm table-pointer">
                  <thead>
                    <tr>
                      <th>Member Action</th>
                      <th>Contact Id</th>
                      <th>Contact Name</th>
                      <th>Contact Mobile</th>
                      <th>Walks Matched</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (bulkLoadMemberAndMatch of walksImportPreparation?.bulkLoadMembersAndMatchesToWalks; track bulkLoadMemberAndMatch) {
                      <tr>
                        <td class="form-inline">
                          <fa-icon
                            [icon]="icons.toFontAwesomeIcon(bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.memberMatch)?.icon"
                            [class]="icons.toFontAwesomeIcon(bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.memberMatch)?.class"/>
                          <div class="ml-2">{{ bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.memberMatch }}</div>
                        </td>
                        <td class="nowrap">{{ bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.contact?.id }}</td>
                        <td class="nowrap">{{ bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.member | fullNameWithAlias }}</td>
                        <td class="nowrap">{{ bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.member?.mobileNumber }}</td>
                        <td class="nowrap">{{ bulkLoadMemberAndMatch.walks.length }}</td>
                      </tr>
                    }
                    <tr>
                      <td class="nowrap"></td>
                      <td class="nowrap"></td>
                      <td class="nowrap"></td>
                      <td class="nowrap"></td>
                      <td class="nowrap">{{ summary(walksImportPreparation.bulkLoadMembersAndMatchesToWalks) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }
        </app-page>`,
    imports: [PageComponent, MarkdownEditorComponent, FontAwesomeModule, FullNameWithAliasPipe]
})

export class WalkImportComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkImportComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  protected icons = inject(IconService);
  private systemConfigService = inject(SystemConfigService);
  display = inject(WalkDisplayService);
  private walksImportService = inject(WalksImportService);
  private urlService = inject(UrlService);
  private stringUtilsService = inject(StringUtilsService);
  public walksImportPreparation: WalksImportPreparation;
  public fileName: string;
  public alertTarget: AlertTarget = {};
  private notify: AlertInstance;
  public importInProgress = false;
  faRemove = faRemove;
  public messages: string[] = [];
  public errorMessages: string[] = [];

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.alertTarget);
    this.systemConfigService.events().subscribe(async item => {
      if (this.display.walkPopulationLocal()) {
        this.notify.warning({
          title: "Walks Import Initialisation",
          message: "Walks cannot be imported from this view when the walk population is set to " + this.display?.group?.walkPopulation
        });
      } else {
      }
    });
  }

  ngOnDestroy(): void {
  }


  navigateBackToAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  reset() {
    this.messages = [];
    this.walksImportPreparation = null;
  }

  async collectAvailableWalks() {
    this.messages = [];
    this.importInProgress = true;

    this.notify.warning({
      title: "Walks Import Initialisation",
      message: `Gathering walks and member date for matching`
    });

    this.walksImportService.prepareImport(this.messages)
      .then(walksImportPreparation => {
        this.walksImportPreparation = walksImportPreparation;
        this.notify.success({
          title: "Walks Import Preparation Complete",
          message: `See the table below for the list of members and the number of walks they are matched to`
        });
      })
      .catch(error => this.notify.error({
        title: "Walks Import Initialisation Failed",
        message: error
      }))
      .finally(() => this.importInProgress = false);
  }

  importAndSaveWalksLocally() {
    this.messages = [];
    this.importInProgress = true;
    this.notify.warning({
      title: "Walks Import Starting",
      message: `Importing ${this.summary(this.walksImportPreparation.bulkLoadMembersAndMatchesToWalks)} walks`
    });

    this.walksImportService.performImport(this.walksImportPreparation, this.messages, this.notify)
      .then((errorMessages: string[]) => {
        this.errorMessages = errorMessages;
        if (this?.errorMessages?.length > 0) {
          this.notify.warning({
            title: "Walks Import Complete",
            message: `Imported completed with ${this.stringUtilsService.pluraliseWithCount(this?.errorMessages?.length, "error")}. If you are happy with number of walks imported, Walk population should now be changed to Local in system settings.`
          });

        } else {
          this.notify.success({
            title: "Walks Import Complete",
            message: `Imported completed successfully. Walk population should now be changed to Local in system settings.`
          });
        }
      })
      .catch(error => this.notify.error({
        title: "Walks Import Failed",
        message: error
      }))
      .finally(() => this.importInProgress = false);
  }

  summary(bulkLoadMemberAndMatchToWalks: BulkLoadMemberAndMatchToWalks[]): number {
    return sum(bulkLoadMemberAndMatchToWalks?.map(item => item?.walks?.length));
  }
}
