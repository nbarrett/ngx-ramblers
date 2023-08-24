import { HttpClientModule } from "@angular/common/http";
import { ApplicationRef, DoBootstrap, NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { NgxLoggerLevel } from "ngx-logger";
import { AppRoutingModule } from "../../app-routing.module";
import { CarouselStoryNavigatorComponent } from "../../carousel-story-navigator/carousel-story-navigator.component";
import { ContainerComponent } from "../../container/container";
import { FooterComponent } from "../../footer/footer";
import { FooterIconsComponent } from "../../footer/icons/footer-icons";
import { HeaderBarComponent } from "../../header-bar/header-bar";
import { HeaderButtonsComponent } from "../../header-buttons/header-buttons";
import { LoginPanelComponent } from "../../login-panel/login-panel.component";
import { ForgotPasswordComponent } from "../../login/forgot-password.component";
import { LoginComponent } from "../../login/login.component";
import { SetPasswordComponent } from "../../login/set-password.component";
import { LogoutComponent } from "../../logout/logout.component";
import { MeetupDescriptionComponent } from "../../notifications/walks/templates/meetup/meetup-description.component";
import { PageNavigatorComponent } from "../../page-navigator/page-navigator.component";
import { BannerImageSelectorComponent } from "../../pages/banner/banner-image-selector.component";
import { BannerLogoAndTextLinesOutputComponent } from "../../pages/banner/banner-logo-and-text-lines-output.component";
import { BannerHeadLogoComponent } from "../../pages/banner/banner-logo/banner-logo";
import { BannerPapercutOutputComponent } from "../../pages/banner/banner-papercut-output.component";
import { BannerTitleConfigComponent } from "../../pages/banner/banner-title-config.component";
import { BannerTitleOutputComponent } from "../../pages/banner/banner-title-output.component";
import { BannerTitlePartConfigComponent } from "../../pages/banner/banner-title-part-config.component";
import { BannerComponent } from "../../pages/banner/banner.component";
import { ColourSelectorComponent } from "../../pages/banner/colour-selector";
import { IconSelectorComponent } from "../../pages/banner/icon-selector";
import { FacebookComponent } from "../../pages/facebook/facebook.component";
import { HomeComponent } from "../../pages/home/home.component";
import { PrivacyPolicyComponent } from "../../pages/home/privacy-policy.component";
import { HowToModalComponent } from "../../pages/how-to/how-to-modal.component";
import { HowToSubjectListingComponent } from "../../pages/how-to/subject-listing/subject-listing";
import { InstagramComponent } from "../../pages/instagram/instagram.component";
import { JoinUsComponent } from "../../pages/join-us/join-us.component";
import { LoginModalComponent } from "../../pages/login/login-modal/login-modal.component";
import { ChangedItemsPipe } from "../../pipes/changed-items.pipe";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SharedModule } from "../../shared-module";
import { SiteEditComponent } from "../../site-edit/site-edit.component";
import { CardContainerComponent } from "./card-container/card-container.component";
import { NavbarContentComponent } from "./navbar-content/navbar-content";
import { NavbarComponent } from "./navbar/navbar";

@NgModule({
  declarations: [
    BannerComponent,
    BannerLogoAndTextLinesOutputComponent,
    BannerPapercutOutputComponent,
    ColourSelectorComponent,
    IconSelectorComponent,
    BannerHeadLogoComponent,
    BannerImageSelectorComponent,
    BannerTitleConfigComponent,
    BannerTitleOutputComponent,
    BannerTitlePartConfigComponent,
    CardContainerComponent,
    CarouselStoryNavigatorComponent,
    ChangedItemsPipe,
    ContainerComponent,
    FacebookComponent,
    FooterComponent,
    FooterIconsComponent,
    ForgotPasswordComponent,
    HeaderBarComponent,
    HeaderButtonsComponent,
    HomeComponent,
    HowToModalComponent,
    HowToSubjectListingComponent,
    InstagramComponent,
    JoinUsComponent,
    LoginComponent,
    LoginModalComponent,
    LoginPanelComponent,
    LogoutComponent,
    MeetupDescriptionComponent,
    NavbarComponent,
    NavbarContentComponent,
    PageNavigatorComponent,
    PrivacyPolicyComponent,
    SetPasswordComponent,
    SiteEditComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    SharedModule.forRoot(),
  ]
})

export class AppModule implements DoBootstrap {
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(AppModule, NgxLoggerLevel.OFF);
  }

  ngDoBootstrap(appRef: ApplicationRef) {
    appRef.bootstrap(ContainerComponent);
  }

}
