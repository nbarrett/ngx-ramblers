import { inject, NgModule } from "@angular/core";
import { NoPreloading, RouterModule, Routes } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { hasDynamicPath } from "./services/path-matchers";
import { contactUsGuard } from "./pages/contact-us/contact-us.guard";
import { AreaExistsGuard } from "./guards/area-exists-guard";
import { SocialPopulationLocalGuard } from "./guards/social-population-local-guard";
import { SocialAuthGuard } from "./guards/social-auth-guard";
import { SystemHealthyGuard } from "./guards/system-healthy-guard";

const routes: Routes = [
  {
    path: "",
    loadComponent: () => import("./pages/home/home.component")
      .then(m => m.HomeComponent),
    canActivate: [SystemHealthyGuard, contactUsGuard]
  },
  {
    path: "admin", loadChildren: () => import("./modules/admin/admin-routing.module")
      .then(module => module.AdminRoutingModule)
  },
  {
    path: "committee", loadChildren: () => import("./modules/committee/committee-routing.module")
      .then(module => module.CommitteeRoutingModule),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "social", loadChildren: () => import("./modules/social/social-routing.module")
      .then(module => module.SocialRoutingModule),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "walks", loadChildren: () => import("./modules/walks/walks-routing.module")
      .then(module => module.WalksRoutingModule),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "forgot-password",
    loadComponent: () => import("./login/forgot-password.component")
      .then(m => m.ForgotPasswordComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "home", loadComponent: () => import("./pages/home/home.component")
      .then(m => m.HomeComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "how-to/committee/email-archives/:subject",
    loadComponent: () => import("./pages/how-to/subject-listing/subject-listing")
      .then(m => m.HowToSubjectListingComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "login", loadComponent: () => import("./login/login.component")
      .then(m => m.LoginComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "logout", loadComponent: () => import("./logout/logout.component")
      .then(m => m.LogoutComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "privacy-policy",
    loadComponent: () => import("./pages/home/privacy-policy.component")
      .then(m => m.PrivacyPolicyComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "social-events/new",
    loadComponent: () => import("./pages/social/edit/social-edit.component")
      .then(m => m.SocialEditComponent),
    canActivate: [SystemHealthyGuard, AreaExistsGuard, SocialPopulationLocalGuard, SocialAuthGuard]
  },
  {
    path: "social-events/:id",
    loadComponent: () => import("./pages/social/social-view/social-view").then(m => m.SocialView),
    canActivate: [SystemHealthyGuard]
  },
  {
    path: "social-events/:id/edit",
    loadComponent: () => import("./pages/social/edit/social-edit.component").then(m => m.SocialEditComponent),
    canActivate: [SystemHealthyGuard, AreaExistsGuard, SocialPopulationLocalGuard, SocialAuthGuard]
  },
  {
    path: "fragments",
    redirectTo: "/admin/fragment-index",
    pathMatch: "full"
  },
  {
    matcher: hasDynamicPath,
    loadComponent: () => import("./modules/common/dynamic-content-page/dynamic-content-page")
      .then(m => m.DynamicContentPageComponent),
    canActivate: [SystemHealthyGuard]
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
