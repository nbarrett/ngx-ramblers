import { inject, NgModule } from "@angular/core";
import { NoPreloading, RouterModule, Routes } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { hasDynamicPath } from "./services/path-matchers";
import { contactUsGuard } from "./pages/contact-us/contact-us.guard";
import { AreaExistsGuard } from "./guards/area-exists-guard";
import { SocialPopulationLocalGuard } from "./guards/social-population-local-guard";
import { SocialAuthGuard } from "./guards/social-auth-guard";

const routes: Routes = [
  {
    path: "",
    loadComponent: () => import("./pages/home/home.component")
      .then(m => m.HomeComponent),
    canActivate: [contactUsGuard]
  },
  {
    path: "admin", loadChildren: () => import("./modules/admin/admin-routing.module")
      .then(module => module.AdminRoutingModule)
  },
  {
    path: "committee", loadChildren: () => import("./modules/committee/committee-routing.module")
      .then(module => module.CommitteeRoutingModule)
  },
  {
    path: "social", loadChildren: () => import("./modules/social/social-routing.module")
      .then(module => module.SocialRoutingModule)
  },
  {
    path: "walks", loadChildren: () => import("./modules/walks/walks-routing.module")
      .then(module => module.WalksRoutingModule)
  },
  {
    path: "forgot-password",
    loadComponent: () => import("./login/forgot-password.component")
      .then(m => m.ForgotPasswordComponent)
  },
  {
    path: "home", loadComponent: () => import("./pages/home/home.component")
      .then(m => m.HomeComponent)
  },
  {
    path: "how-to/committee/email-archives/:subject",
    loadComponent: () => import("./pages/how-to/subject-listing/subject-listing")
      .then(m => m.HowToSubjectListingComponent)
  },
  {
    path: "login", loadComponent: () => import("./login/login.component")
      .then(m => m.LoginComponent)
  },
  {
    path: "logout", loadComponent: () => import("./logout/logout.component")
      .then(m => m.LogoutComponent)
  },
  {
    path: "privacy-policy",
    loadComponent: () => import("./pages/home/privacy-policy.component")
      .then(m => m.PrivacyPolicyComponent)
  },
  {
    path: "social-events/new",
    loadComponent: () => import("./pages/social/edit/social-edit.component")
      .then(m => m.SocialEditComponent),
    canActivate: [AreaExistsGuard, SocialPopulationLocalGuard, SocialAuthGuard]
  },
  {
    path: "social-events/:id",
    loadComponent: () => import("./pages/social/social-view/social-view").then(m => m.SocialView)
  },
  {
    path: "social-events/:id/edit",
    loadComponent: () => import("./pages/social/edit/social-edit.component").then(m => m.SocialEditComponent),
    canActivate: [AreaExistsGuard, SocialPopulationLocalGuard, SocialAuthGuard]
  },
  {
    matcher: hasDynamicPath,
    loadComponent: () => import("./modules/common/dynamic-content-page/dynamic-content-page")
      .then(m => m.DynamicContentPageComponent)
  },
  {path: "**", redirectTo: "/"},
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: false, preloadingStrategy: NoPreloading })],
  exports: [RouterModule]
})

export class AppRoutingModule {
  logger: Logger = inject(LoggerFactory).createLogger("AppRoutingModule", NgxLoggerLevel.OFF);
}
