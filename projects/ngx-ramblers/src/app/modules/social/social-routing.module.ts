import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { SocialViewPageComponent } from "../../pages/social/social-view-page/social-view-page";
import { hasDynamicPath, hasMongoId, hasRamblersIdOrUrl } from "../../services/path-matchers";
import { DynamicContentPageComponent } from "../common/dynamic-content-page/dynamic-content-page";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { SocialPopulationLocalGuard } from "../../guards/social-population-local-guard";
import { SharedModule } from "../../shared-module";
import { SocialHomeComponent } from "../../pages/social/home/social-home.component";
import { SocialEditComponent } from "../../pages/social/edit/social-edit.component";

@NgModule({
  imports: [SharedModule, RouterModule.forChild([
    {path: "new", component: SocialEditComponent, canActivate: [AreaExistsGuard, SocialPopulationLocalGuard]},
    {path: ":id/edit", component: SocialEditComponent, canActivate: [AreaExistsGuard, SocialPopulationLocalGuard]},
    {matcher: hasMongoId, component: SocialViewPageComponent, canActivate: [AreaExistsGuard]},
    {matcher: hasDynamicPath, component: DynamicContentPageComponent, canActivate: [AreaExistsGuard]},
    {path: "**", component: SocialHomeComponent, canActivate: [AreaExistsGuard]}
  ])]
})
export class SocialRoutingModule {
}
