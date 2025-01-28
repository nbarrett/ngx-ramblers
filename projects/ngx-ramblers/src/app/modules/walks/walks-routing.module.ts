import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { hasDynamicPath, hasMongoId, hasRamblersIdOrUrl } from "../../services/path-matchers";
import { WalksAuthGuard } from "../../guards/walks-auth-guard";
import { WalksPopulationLocalGuard } from "../../guards/walks-population-local-guard";

@NgModule({
  imports: [RouterModule.forChild([
    {
      path: "add",
      loadComponent: () => import("../../pages/walks/walk-edit/walk-edit.component")
        .then(m => m.WalkEditComponent),
      canActivate: [WalksAuthGuard, WalksPopulationLocalGuard]
    },
    {
      path: "admin",
      loadComponent: () => import("../../pages/walks/walk-admin/walk-admin.component")
        .then(m => m.WalkAdminComponent),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/add-walk-slots",
      loadComponent: () => import("../../pages/walks/walk-add-slots/walk-add-slots.component")
        .then(m => m.WalkAddSlotsComponent),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/export",
      loadComponent: () => import("../../pages/walks/walk-export/walk-export.component")
        .then(m => m.WalkExportComponent),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/import",
      loadComponent: () => import("../../pages/walks/walk-import/walk-import.component")
        .then(m => m.WalkImportComponent),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/meetup-settings",
      loadComponent: () => import("../../pages/walks/walk-meetup-settings/walk-meetup-settings.component")
        .then(m => m.WalkMeetupSettingsComponent),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "edit/:walk-id",
      loadComponent: () => import("../../pages/walks/walk-edit-fullpage/walk-edit-full-page.component")
        .then(m => m.WalkEditFullPageComponent),
      canActivate: [WalksPopulationLocalGuard]
    },
    {
      path: "carousel",
      loadComponent: () => import("../common/action-buttons/action-buttons")
        .then(m => m.ActionButtonsComponent)
    },
    {
      matcher: hasMongoId,
      loadComponent: () => import("../../pages/walks/walk-view/walk-view")
        .then(m => m.WalkViewComponent)
    },
    {
      matcher: hasRamblersIdOrUrl,
      loadComponent: () => import("../../pages/walks/walk-view/walk-view")
        .then(m => m.WalkViewComponent)
    },
    {
      matcher: hasDynamicPath,
      loadComponent: () => import("../common/dynamic-content-page/dynamic-content-page")
        .then(m => m.DynamicContentPageComponent)
    },
    {
      path: "**",
      loadComponent: () => import("../../pages/walks/walk-list/walk-list.component")
        .then(m => m.WalkListComponent)
    },
  ])]
})
export class WalksRoutingModule {
}

