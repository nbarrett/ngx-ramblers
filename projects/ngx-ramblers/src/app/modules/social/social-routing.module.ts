import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { hasDynamicPath, hasMongoId } from "../../services/path-matchers";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { SocialPopulationLocalGuard } from "../../guards/social-population-local-guard";


@NgModule({
  imports: [RouterModule.forChild([
    {
      path: "new", loadComponent: () => import("../../pages/social/edit/social-edit.component")
        .then(m => m.SocialEditComponent), canActivate: [AreaExistsGuard, SocialPopulationLocalGuard]
    },
    {
      path: ":id/edit", loadComponent: () => import("../../pages/social/edit/social-edit.component")
        .then(m => m.SocialEditComponent), canActivate: [AreaExistsGuard, SocialPopulationLocalGuard]
    },
    {
      matcher: hasMongoId, loadComponent: () => import("../../pages/social/social-view-page/social-view-page")
        .then(m => m.SocialViewPageComponent), canActivate: [AreaExistsGuard]
    },
    {
      matcher: hasDynamicPath, loadComponent: () => import("../common/dynamic-content-page/dynamic-content-page")
        .then(m => m.DynamicContentPageComponent), canActivate: [AreaExistsGuard]
    },
    {
      path: "**", loadComponent: () => import("../../pages/social/home/social-home.component")
        .then(m => m.SocialHomeComponent), canActivate: [AreaExistsGuard]
    }
  ])]
})
export class SocialRoutingModule {
}
