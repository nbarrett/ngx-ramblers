import { NgModule } from "@angular/core";
import { NoPreloading, RouterModule, Routes } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { ForgotPasswordComponent } from "./login/forgot-password.component";
import { LoginComponent } from "./login/login.component";
import { LogoutComponent } from "./logout/logout.component";
import { DynamicContentPageComponent } from "./modules/common/dynamic-content-page/dynamic-content-page";
import { HomeComponent } from "./pages/home/home.component";
import { PrivacyPolicyComponent } from "./pages/home/privacy-policy.component";
import { HowToSubjectListingComponent } from "./pages/how-to/subject-listing/subject-listing";
import { ImageListComponent } from "./pages/image-editor/image-list/image-list.component";
import { JoinUsComponent } from "./pages/join-us/join-us.component";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { hasDynamicPath, hasMongoId } from "./services/path-matchers";

const routes: Routes = [
  {path: "", component: HomeComponent},
  {path: "admin", loadChildren: () => import("./modules/admin/admin-routing.module").then(module => module.AdminRoutingModule)},
  {path: "committee", loadChildren: () => import("./modules/committee/committee-routing.module").then(module => module.CommitteeRoutingModule)},
  {path: "social", loadChildren: () => import("./modules/social/social-routing.module").then(module => module.SocialRoutingModule)},
  {path: "walks", loadChildren: () => import("./modules/walks/walks-routing.module").then(module => module.WalksRoutingModule)},
  {path: "forgot-password", component: ForgotPasswordComponent},
  {path: "home", component: HomeComponent},
  {path: "how-to/committee/email-archives/:subject", component: HowToSubjectListingComponent},
  {path: "image-editor/:image-source", component: ImageListComponent},
  {path: "join-us", component: JoinUsComponent},
  {path: "login", component: LoginComponent},
  {path: "logout", component: LogoutComponent},
  {path: "privacy-policy", component: PrivacyPolicyComponent},
  {matcher: hasDynamicPath, component: DynamicContentPageComponent},
  {path: "**", redirectTo: "/"},
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: false, preloadingStrategy: NoPreloading, relativeLinkResolution: "legacy" })],
  exports: [RouterModule]
})

export class AppRoutingModule {
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(AppRoutingModule, NgxLoggerLevel.OFF);
  }

}
