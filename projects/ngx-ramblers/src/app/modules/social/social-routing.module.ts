import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { SocialHomeComponent } from "../../pages/social/home/social-home.component";
import { SocialViewPageComponent } from "../../pages/social/social-view-page/social-view-page";
import { hasDynamicPath, hasMongoId } from "../../services/path-matchers";
import { DynamicContentPageComponent } from "../common/dynamic-content-page/dynamic-content-page";
import { SocialModule } from "./social.module";

@NgModule({
  imports: [SocialModule, RouterModule.forChild([
    {matcher: hasMongoId, component: SocialViewPageComponent},
    {path: "new", component: SocialViewPageComponent},
    {matcher: hasDynamicPath, component: DynamicContentPageComponent},
    {path: "**", component: SocialHomeComponent}
  ])]
})
export class SocialRoutingModule {
}
