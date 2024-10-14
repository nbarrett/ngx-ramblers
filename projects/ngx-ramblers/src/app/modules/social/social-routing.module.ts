import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { SocialViewPageComponent } from "../../pages/social/social-view-page/social-view-page";
import { hasDynamicPath, hasMongoId, hasRamblersIdOrUrl } from "../../services/path-matchers";
import { DynamicContentPageComponent } from "../common/dynamic-content-page/dynamic-content-page";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { SocialPopulationLocalGuard } from "../../guards/social-population-local-guard";
import { SharedModule } from "../../shared-module";
import { SocialHomeComponent } from "../../pages/social/home/social-home.component";

@NgModule({
  imports: [SharedModule, RouterModule.forChild([
    {matcher: hasMongoId, component: SocialViewPageComponent, canActivate: [AreaExistsGuard]},
    {matcher: hasRamblersIdOrUrl, component: SocialViewPageComponent, canActivate: [AreaExistsGuard]},
    {path: "new", component: SocialViewPageComponent, canActivate: [AreaExistsGuard, SocialPopulationLocalGuard]},
    {matcher: hasDynamicPath, component: DynamicContentPageComponent, canActivate: [AreaExistsGuard]},
    {path: "**", component: SocialHomeComponent, canActivate: [AreaExistsGuard]}
  ])]
})
export class SocialRoutingModule {
}
