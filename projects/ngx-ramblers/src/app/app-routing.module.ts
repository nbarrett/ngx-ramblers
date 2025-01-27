import { inject, NgModule } from "@angular/core";
import { NoPreloading, RouterModule, Routes } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { ForgotPasswordComponent } from "./login/forgot-password.component";
import { LoginComponent } from "./login/login.component";
import { LogoutComponent } from "./logout/logout.component";
import { DynamicContentPageComponent } from "./modules/common/dynamic-content-page/dynamic-content-page";
import { HomeComponent } from "./pages/home/home.component";
import { PrivacyPolicyComponent } from "./pages/home/privacy-policy.component";
import { HowToSubjectListingComponent } from "./pages/how-to/subject-listing/subject-listing";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { hasDynamicPath } from "./services/path-matchers";
import { SocialViewComponent } from "./pages/social/social-view/social-view";
import { contactUsGuard } from "./pages/contact-us/contact-us.guard";
import { SocialEditComponent } from "./pages/social/edit/social-edit.component";
import { AreaExistsGuard } from "./guards/area-exists-guard";
import { SocialPopulationLocalGuard } from "./guards/social-population-local-guard";
import { SocialAuthGuard } from "./guards/social-auth-guard";

const routes: Routes = [
  {path: "", component: HomeComponent, canActivate: [contactUsGuard]},
  {path: "admin", loadChildren: () => import("./modules/admin/admin-routing.module").then(module => module.AdminRoutingModule)},
  {path: "committee", loadChildren: () => import("./modules/committee/committee-routing.module").then(module => module.CommitteeRoutingModule)},
  {path: "social", loadChildren: () => import("./modules/social/social-routing.module").then(module => module.SocialRoutingModule)},
  {path: "walks", loadChildren: () => import("./modules/walks/walks-routing.module").then(module => module.WalksRoutingModule)},
  {path: "forgot-password", component: ForgotPasswordComponent},
  {path: "home", component: HomeComponent},
  {path: "how-to/committee/email-archives/:subject", component: HowToSubjectListingComponent},
  {path: "login", component: LoginComponent},
  {path: "logout", component: LogoutComponent},
  {path: "privacy-policy", component: PrivacyPolicyComponent},
  {
    path: "social-events/new",
    component: SocialEditComponent,
    canActivate: [AreaExistsGuard, SocialPopulationLocalGuard, SocialAuthGuard]
  },
  {path: "social-events/:id", component: SocialViewComponent},
  {
    path: "social-events/:id/edit",
    component: SocialEditComponent,
    canActivate: [AreaExistsGuard, SocialPopulationLocalGuard, SocialAuthGuard]
  },
  {matcher: hasDynamicPath, component: DynamicContentPageComponent},
  {path: "**", redirectTo: "/"},
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: false, preloadingStrategy: NoPreloading })],
  exports: [RouterModule]
})

export class AppRoutingModule {
  logger: Logger = inject(LoggerFactory).createLogger("AppRoutingModule", NgxLoggerLevel.OFF);
}
