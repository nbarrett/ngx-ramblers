import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { GroupEventAuthGuard } from "../../guards/group-event-auth-guard";
import { WalksAuthGuard } from "../../guards/walks-auth-guard";
import { WalksPopulationLocalGuard } from "../../guards/walks-population-local-guard";
import { PathSegment, RouteParam } from "../../models/content-text.model";
import { hasTrailingEditPath, hasTrailingNewPath } from "../../services/path-matchers";

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
      loadComponent: () => import("../../pages/walks/walk-export/walk-export")
        .then(m => m.WalkExport),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/import",
      loadComponent: () => import("../../pages/walks/walk-import/walk-import")
        .then(m => m.WalkImport),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/config",
      loadComponent: () => import("../../pages/walks/walk-config/walk-config")
        .then(m => m.WalkConfigComponent),
      canActivate: [WalksAuthGuard]
    },
    {
      path: "admin/event-data-management",
      loadComponent: () => import("../../pages/walks/walk-admin/event-data-management")
        .then(m => m.EventDataManagement),
      canActivate: [WalksAuthGuard]
    },
    {
      path: `${PathSegment.EDIT}/:${RouteParam.WALK_ID}`,
      loadComponent: () => import("../../pages/walks/walk-edit-fullpage/walk-edit-full-page.component")
        .then(m => m.WalkEditFullPageComponent),
      canActivate: [WalksPopulationLocalGuard]
    },
    {
      path: `${PathSegment.VIEW}/:${RouteParam.WALK_ID}`,
      loadComponent: () => import("../../pages/walks/walk-edit-fullpage/walk-edit-full-page.component")
        .then(m => m.WalkEditFullPageComponent),
      canActivate: [WalksAuthGuard]
    },
    {
      path: PathSegment.NEW,
      loadComponent: () => import("../../pages/group-events/edit/group-event-edit")
        .then(m => m.GroupEventEdit),
      canActivate: [AreaExistsGuard, GroupEventAuthGuard]
    },
    {
      path: `:${RouteParam.ID}/${PathSegment.EDIT}`,
      loadComponent: () => import("../../pages/group-events/edit/group-event-edit")
        .then(m => m.GroupEventEdit),
      canActivate: [AreaExistsGuard, GroupEventAuthGuard]
    },
    {
      matcher: hasTrailingNewPath,
      loadComponent: () => import("../../pages/group-events/edit/group-event-edit")
        .then(m => m.GroupEventEdit),
      canActivate: [AreaExistsGuard, GroupEventAuthGuard]
    },
    {
      matcher: hasTrailingEditPath,
      loadComponent: () => import("../../pages/group-events/edit/group-event-edit")
        .then(m => m.GroupEventEdit),
      canActivate: [AreaExistsGuard, GroupEventAuthGuard]
    },
    {
      path: ":path",
      loadComponent: () =>
        import("../../pages/walks/walk-list/walk-view-selector").then(
          m => m.WalksViewSelector
        )
    },
    {
      path: "**",
      loadComponent: () =>
        import("../../pages/walks/walk-list/walk-view-selector").then(
          m => m.WalksViewSelector
        )
    }
  ])]
})
export class WalksRoutingModule {
}

