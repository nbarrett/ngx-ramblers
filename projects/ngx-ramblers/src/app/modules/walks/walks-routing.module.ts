import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { WalkAddSlotsComponent } from "../../pages/walks/walk-add-slots/walk-add-slots.component";
import { WalkAdminComponent } from "../../pages/walks/walk-admin/walk-admin.component";
import { WalkEditFullPageComponent } from "../../pages/walks/walk-edit-fullpage/walk-edit-full-page.component";
import { WalkEditComponent } from "../../pages/walks/walk-edit/walk-edit.component";
import { WalkExportComponent } from "../../pages/walks/walk-export/walk-export.component";
import { WalkListComponent } from "../../pages/walks/walk-list/walk-list.component";
import { WalkMeetupSettingsComponent } from "../../pages/walks/walk-meetup-settings/walk-meetup-settings.component";
import { WalkViewComponent } from "../../pages/walks/walk-view/walk-view";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";
import { hasDynamicPath, hasMongoId, hasRamblersIdOrUrl } from "../../services/path-matchers";
import { StringUtilsService } from "../../services/string-utils.service";
import { WalksAuthGuard } from "../../guards/walks-auth-guard";
import { ActionButtonsComponent } from "../common/action-buttons/action-buttons";
import { DynamicContentPageComponent } from "../common/dynamic-content-page/dynamic-content-page";
import { WalksModule } from "./walks.module";
import { WalksPopulationLocalGuard } from "../../guards/walks-population-local-guard";
import { WalkImportComponent } from "../../pages/walks/walk-import/walk-import.component";

@NgModule({
  imports: [WalksModule, RouterModule.forChild([
    {
      path: "add",
      component: WalkEditComponent,
      canActivate: [WalksAuthGuard, WalksPopulationLocalGuard]
    },
    {
      path: "admin",
      component: WalkAdminComponent,
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/add-walk-slots",
      component: WalkAddSlotsComponent,
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/export",
      component: WalkExportComponent,
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/import",
      component: WalkImportComponent,
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/meetup-settings",
      component: WalkMeetupSettingsComponent,
      canActivate: [WalksAuthGuard]
    },
    {
      path: "edit/:walk-id",
      component: WalkEditFullPageComponent,
      canActivate: [WalksPopulationLocalGuard]
    },
    {
      path: "carousel",
      component: ActionButtonsComponent
    },
    {
      matcher: hasMongoId,
      component: WalkViewComponent
    },
    {
      matcher: hasRamblersIdOrUrl,
      component: WalkViewComponent
    },
    {
      matcher: hasDynamicPath,
      component: DynamicContentPageComponent
    },
    {
      path: "**",
      component: WalkListComponent
    },
  ])]
})
export class WalksRoutingModule {
  private logger: Logger;

  constructor(private pageService: PageService,
              private stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalksRoutingModule, NgxLoggerLevel.OFF);
  }
}

