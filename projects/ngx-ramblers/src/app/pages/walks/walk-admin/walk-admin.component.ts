import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
import { faMeetup } from "@fortawesome/free-brands-svg-icons";
import { faCalendarPlus, faFileExport, faFileImport } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-walk-admin",
  template: `
    <app-page>
      <div class="body-content">
        <div class="row">
          <div class="col-sm-6">
            <div class="item-panel">
              <div (click)="selectWalksForExport()" class="item-icon">
                <fa-icon [icon]="faFileExport" class="fa-3x ramblers"/>
                <h5>Ramblers export</h5>
              </div>
              <app-markdown-editor class="item-text" name="ramblers-export-help"
                                   description="Ramblers export help"/>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="item-panel">
              <div (click)="selectWalksForImport()" class="item-icon">
                <fa-icon [icon]="faFileImport" class="fa-3x ramblers"/>
                <h5>Ramblers walk import</h5>
              </div>
              <app-markdown-editor class="item-text" name="ramblers-import-help"
                                   description="Ramblers import help"/>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="item-panel">
              <div (click)="addWalkSlots()" class="item-icon">
                <fa-icon [icon]="faCalendarPlus" class="fa-3x calendar"/>
                <h5>Add walk slots</h5>
              </div>
              <app-markdown-editor class="item-text" name="add-walks-slots-help"
                                   description="Add walk slots help"/>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="item-panel">
              <div (click)="meetupSettings()" class="item-icon">
                <fa-icon [icon]="faMeetup" class="fa-3x meetup"/>
                <h5>Meetup settings</h5>
              </div>
              <app-markdown-editor class="item-text" name="meetup-settings-help"
                                   description="Meetup settings help"/>
            </div>
          </div>
        </div>
      </div>
    </app-page>
  `,
  styleUrls: ["./walk-admin.component.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})
export class WalkAdminComponent implements OnInit, OnDestroy {

  constructor(private memberLoginService: MemberLoginService,
              private authService: AuthService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkAdminComponent, NgxLoggerLevel.OFF);
  }
  allowAdminEdits: boolean;
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  faCalendarPlus = faCalendarPlus;
  faFileExport = faFileExport;
  faMeetup = faMeetup;

  protected readonly faFileImport = faFileImport;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.setPrivileges();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.allowAdminEdits = this.memberLoginService.allowWalkAdminEdits();
    this.logger.debug("setPrivileges:allowAdminEdits", this.allowAdminEdits);
  }

  selectWalksForExport() {
    this.urlService.navigateTo(["walks", "admin", "export"]);
  }

  selectWalksForImport() {
    this.urlService.navigateTo(["walks", "admin", "import"]);
  }

  addWalkSlots() {
    this.urlService.navigateTo(["walks", "admin", "add-walk-slots"]);
  }

  meetupSettings() {
    this.urlService.navigateTo(["walks", "admin", "meetup-settings"]);
  }
}
