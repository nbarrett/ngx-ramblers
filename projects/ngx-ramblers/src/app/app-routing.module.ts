import { inject, NgModule } from "@angular/core";
import { NoPreloading, RouterModule, Routes } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { hasDynamicPath, hasEditSubPath, hasSendNotificationPath, hasTrailingEditPath, hasTrailingNewPath, hasUnsubscribePath, hasViewSubPath } from "./services/path-matchers";
import { contactUsGuard } from "./pages/contact-us/contact-us.guard";
import { AreaExistsGuard } from "./guards/area-exists-guard";
import { CommitteeAuthGuard } from "./guards/committee-auth-guard";
import { GroupEventAuthGuard } from "./guards/group-event-auth-guard";
import { PageAccessGuard } from "./guards/page-access-guard";
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
    matcher: hasUnsubscribePath,
    loadComponent: () => import("./pages/unsubscribe/unsubscribe.component")
      .then(m => m.UnsubscribeComponent)
  },
  {
    path: "fragments",
    redirectTo: "/admin/content-templates",
    pathMatch: "full"
  },
  {
    matcher: hasSendNotificationPath,
    loadComponent: () => import("./pages/committee/send-notification/committee-send-notification")
      .then(m => m.CommitteeSendNotification),
    canActivate: [SystemHealthyGuard, CommitteeAuthGuard]
  },
  {
    matcher: hasEditSubPath,
    loadComponent: () => import("./pages/walks/walk-edit-fullpage/walk-edit-full-page.component")
      .then(m => m.WalkEditFullPageComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    matcher: hasViewSubPath,
    loadComponent: () => import("./pages/walks/walk-edit-fullpage/walk-edit-full-page.component")
      .then(m => m.WalkEditFullPageComponent),
    canActivate: [SystemHealthyGuard]
  },
  {
    matcher: hasTrailingNewPath,
    loadComponent: () => import("./pages/group-events/edit/group-event-edit")
      .then(m => m.GroupEventEdit),
    canActivate: [SystemHealthyGuard, AreaExistsGuard, GroupEventAuthGuard]
  },
  {
    matcher: hasTrailingEditPath,
    loadComponent: () => import("./pages/group-events/edit/group-event-edit")
      .then(m => m.GroupEventEdit),
    canActivate: [SystemHealthyGuard, AreaExistsGuard, GroupEventAuthGuard]
  },
  {
    matcher: hasDynamicPath,
    loadComponent: () => import("./pages/walks/walk-list/walk-view-selector")
      .then(m => m.WalksViewSelector),
    canActivate: [SystemHealthyGuard, PageAccessGuard]
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
