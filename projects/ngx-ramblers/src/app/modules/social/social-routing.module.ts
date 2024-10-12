import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { SocialHomeComponent } from "../../pages/social/home/social-home.component";
import { SocialViewPageComponent } from "../../pages/social/social-view-page/social-view-page";
import { hasDynamicPath, hasMongoId, hasRamblersIdOrUrl } from "../../services/path-matchers";
import { DynamicContentPageComponent } from "../common/dynamic-content-page/dynamic-content-page";
import { SocialModule } from "./social.module";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { SocialPopulationLocalGuard } from "../../guards/social-population-local-guard";

@NgModule({
  imports: [SocialModule, RouterModule.forChild([
    {matcher: hasMongoId, component: SocialViewPageComponent, canActivate: [AreaExistsGuard]},
    {matcher: hasRamblersIdOrUrl, component: SocialViewPageComponent, canActivate: [AreaExistsGuard]},
    {path: "new", component: SocialViewPageComponent, canActivate: [AreaExistsGuard, SocialPopulationLocalGuard]},
    {matcher: hasDynamicPath, component: DynamicContentPageComponent, canActivate: [AreaExistsGuard]},
    {path: "**", component: SocialHomeComponent, canActivate: [AreaExistsGuard]}
  ])]
})
export class SocialRoutingModule {
}
