import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { hasMongoId } from "../../services/path-matchers";
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
      path: ":path",
      loadComponent: () =>
        import("../../pages/social/social-view/social-view-selector").then(
          m => m.SocialViewSelector
        ), canActivate: [AreaExistsGuard]
    },
    {
      path: "**",
      loadComponent: () =>
        import("../../pages/social/social-view/social-view-selector").then(
          m => m.SocialViewSelector
        ), canActivate: [AreaExistsGuard]
    }
  ])]
})
export class SocialRoutingModule {
}
