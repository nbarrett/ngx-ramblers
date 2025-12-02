import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faMeetup } from "@fortawesome/free-brands-svg-icons";
import { faBook, faCalendarPlus, faFileExport, faFileImport } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { UrlService } from "../../../services/url.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { faDatabase } from "@fortawesome/free-solid-svg-icons/faDatabase";

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
                  <h5>Ramblers Walk Export</h5>
                </div>
                <app-markdown-editor standalone class="item-text" name="ramblers-export-help"
                                     description="Ramblers export help"/>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="item-panel">
                <div (click)="selectWalksForImport()" class="item-icon">
                  <fa-icon [icon]="faFileImport" class="fa-3x ramblers"/>
                  <h5>Ramblers Walk Import</h5>
                </div>
                <app-markdown-editor standalone class="item-text" name="ramblers-import-help"
                                     description="Ramblers import help"/>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="item-panel">
                <div (click)="addWalkSlots()" class="item-icon">
                  <fa-icon [icon]="faCalendarPlus" class="fa-3x calendar"/>
                  <h5>Add Walk Slots</h5>
                </div>
                <app-markdown-editor standalone class="item-text" name="add-walks-slots-help"
                                     description="Add walk slots help"/>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="item-panel">
                <div (click)="meetupSettings()" class="item-icon">
                  <fa-icon [icon]="faMeetup" class="fa-3x meetup"/>
                  <h5>Meetup Settings</h5>
                </div>
                <app-markdown-editor standalone class="item-text" name="meetup-settings-help"
                                     description="Meetup settings help"/>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="item-panel">
                <div (click)="selectEventDataManagement()" class="item-icon">
                  <fa-icon [icon]="faDatabase" class="fa-3x meetup"/>
                  <h5>Event Data Management</h5>
                </div>
                <app-markdown-editor standalone class="item-text" name="event-data-management-help"
                                     description="Event data management help"/>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="item-panel">
                <div (click)="adminHowTo()" class="item-icon">
                  <fa-icon [icon]="faBook" class="fa-3x ramblers"/>
                  <h5>How To Documentation</h5>
                </div>
                <app-markdown-editor category="walks-admin" standalone class="item-text" name="how-to-documentation-help"
                                     description="How-to documentation help"/>
              </div>
            </div>
          </div>
        </div>
      </app-page>
    `,
    styleUrls: ["./walk-admin.component.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [PageComponent, FontAwesomeModule, MarkdownEditorComponent]
})
export class WalkAdminComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkAdminComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private authService = inject(AuthService);
  private urlService = inject(UrlService);
  allowAdminEdits: boolean;
  private subscriptions: Subscription[] = [];
  faCalendarPlus = faCalendarPlus;
  faFileExport = faFileExport;
  faMeetup = faMeetup;
  protected readonly faFileImport = faFileImport;
  protected readonly faDatabase = faDatabase;
  protected readonly faBook = faBook;

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

  selectEventDataManagement() {
    this.urlService.navigateTo(["walks", "admin", "event-data-management"]);
  }

  adminHowTo() {
    this.urlService.navigateToAbsoluteUrl("https://www.ngx-ramblers.org.uk/how-to/committee/walks/import");
  }

  addWalkSlots() {
    this.urlService.navigateTo(["walks", "admin", "add-walk-slots"]);
  }

  meetupSettings() {
    this.urlService.navigateTo(["walks", "admin", "meetup-settings"]);
  }
}
