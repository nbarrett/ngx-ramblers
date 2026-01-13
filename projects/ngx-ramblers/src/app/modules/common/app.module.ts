import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { ApplicationRef, DoBootstrap, inject, NgModule, provideAppInitializer } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { setTheme } from "ngx-bootstrap/utils";
import { AppRoutingModule } from "../../app-routing.module";
import { ContainerComponent } from "../../container/container";
import { ChangedItemsPipe } from "../../pipes/changed-items.pipe";
import { RecaptchaModule } from "ng-recaptcha-2";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { AsyncPipe, CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouteReuseStrategy, RouterModule } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgSelectModule } from "@ng-select/ng-select";
import { FileUploadModule } from "ng2-file-upload";
import { AccordionModule } from "ngx-bootstrap/accordion";
import { AlertModule } from "ngx-bootstrap/alert";
import { CarouselModule } from "ngx-bootstrap/carousel";
import { CollapseModule } from "ngx-bootstrap/collapse";
import { BsDatepickerModule } from "ngx-bootstrap/datepicker";
import { BsDropdownModule } from "ngx-bootstrap/dropdown";
import { ModalModule } from "ngx-bootstrap/modal";
import { PaginationModule } from "ngx-bootstrap/pagination";
import { PopoverModule } from "ngx-bootstrap/popover";
import { TabsModule } from "ngx-bootstrap/tabs";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { TypeaheadModule } from "ngx-bootstrap/typeahead";
import { ImageCropperModule } from "ngx-image-cropper";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { CustomNGXLoggerService, LoggerModule, NgxLoggerLevel } from "ngx-logger";
import { MarkdownModule } from "ngx-markdown";
import { TagifyModule } from "ngx-tagify";
import { UiSwitchModule } from "ngx-ui-switch";
import { AuthInterceptor } from "../../auth/auth.interceptor";
import { GALLERY_CONFIG, GalleryConfig, GalleryModule } from "ng-gallery";
import { ImageFit } from "../../models/content-text.model";
import { LIGHTBOX_CONFIG, LightboxConfig, LightboxModule } from "ng-gallery/lightbox";
import { NgxCaptureModule } from "ngx-capture";
import { ButtonsModule } from "ngx-bootstrap/buttons";
import { NgxGoogleAnalyticsModule, NgxGoogleAnalyticsRouterModule } from "ngx-google-analytics";
import { CustomReuseStrategy } from "../../routing/custom-reuse-strategy";
import { DateUtilsService } from "../../services/date-utils.service";
import { initializeGtag } from "../../pages/admin/system-settings/google-analytics/tag-manager";
import { SystemConfigService } from "../../services/system/system-config.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { checkMigrationStatus } from "../../services/site-maintenance-initializer";
import { LastConfirmedDateDisplayed } from "../../pipes/last-confirmed-date-displayed.pipe";
import { LineFeedsToBreaksPipe } from "../../pipes/line-feeds-to-breaks.pipe";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { FullNameWithAliasOrMePipe } from "../../pipes/full-name-with-alias-or-me.pipe";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { HumanisePipe } from "../../pipes/humanise.pipe";
import { KebabCasePipe } from "../../pipes/kebabcase.pipe";
import { MeetupEventSummaryPipe } from "../../pipes/meetup-event-summary.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { MemberIdsToFullNamesPipe } from "../../pipes/member-ids-to-full-names.pipe";
import { SearchFilterPipe } from "../../pipes/search-filter.pipe";
import { SnakeCasePipe } from "../../pipes/snakecase.pipe";
import { UpdatedAuditPipe } from "../../pipes/updated-audit-pipe";
import { ValueOrDefaultPipe } from "../../pipes/value-or-default.pipe";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { AuditDeltaValuePipe } from "../../pipes/audit-delta-value.pipe";
import { BroadcastService } from "../../services/broadcast-service";
import { DisplayDateAndTimePipe } from "../../pipes/display-date-and-time.pipe";
import { DisplayTimePipe } from "../../pipes/display-time.pipe";
import { DisplayDateNoDayPipe } from "../../pipes/display-date-no-day.pipe";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DisplayDatesAndTimesPipe } from "../../pipes/display-dates-and-times.pipe";
import { DisplayDatesPipe } from "../../pipes/display-dates.pipe";
import { DisplayDayPipe } from "../../pipes/display-day.pipe";
import { EventNotePipe } from "../../pipes/event-note.pipe";
import { TimepickerModule } from "ngx-bootstrap/timepicker";
import { EventDatesAndTimesPipe } from "../../pipes/event-times-and-dates.pipe";

@NgModule({
  imports: [
    AppRoutingModule,
    BrowserAnimationsModule,
    RecaptchaModule,
    ScrollingModule,
    AsyncPipe,
    CommonModule,
    FormsModule,
    RouterModule,
    FontAwesomeModule,
    NgSelectModule,
    FileUploadModule,
    AccordionModule.forRoot(),
    TimepickerModule.forRoot(),
    AlertModule.forRoot(),
    CarouselModule.forRoot(),
    CollapseModule.forRoot(),
    BsDatepickerModule.forRoot(),
    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    PaginationModule.forRoot(),
    PopoverModule.forRoot(),
    TabsModule.forRoot(),
    TooltipModule.forRoot(),
    TypeaheadModule.forRoot(),
    ImageCropperModule,
    LeafletModule,
    LoggerModule.forRoot({serverLoggingUrl: "api/logs", level: NgxLoggerLevel.OFF, serverLogLevel: NgxLoggerLevel.OFF}),
    MarkdownModule.forRoot(),
    TagifyModule.forRoot(),
    UiSwitchModule,
    GalleryModule,
    LightboxModule,
    NgxCaptureModule,
    ButtonsModule,
    NgxGoogleAnalyticsModule,
    NgxGoogleAnalyticsRouterModule,
    ChangedItemsPipe,
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    AuditDeltaChangedItemsPipePipe,
    AuditDeltaValuePipe,
    BroadcastService,
    ChangedItemsPipe,
    CustomNGXLoggerService,
    DisplayDateAndTimePipe,
    DisplayTimePipe,
    DisplayDateNoDayPipe,
    DisplayDatePipe,
    DisplayDatesAndTimesPipe,
    DisplayDatesPipe,
    DisplayDayPipe,
    EventDatesAndTimesPipe,
    EventNotePipe,
    FullNamePipe,
    FullNameWithAliasOrMePipe,
    FullNameWithAliasPipe,
    HumanisePipe,
    KebabCasePipe,
    LastConfirmedDateDisplayed,
    LineFeedsToBreaksPipe,
    MeetupEventSummaryPipe,
    MemberIdToFullNamePipe,
    MemberIdsToFullNamesPipe,
    SearchFilterPipe,
    SnakeCasePipe,
    UpdatedAuditPipe,
    ValueOrDefaultPipe,
    {provide: RouteReuseStrategy, useClass: CustomReuseStrategy},
    {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true},
    {provide: GALLERY_CONFIG, useValue: {imageSize: ImageFit.COVER} as GalleryConfig},
    {provide: LIGHTBOX_CONFIG, useValue: {keyboardShortcuts: false, exitAnimationTime: 1000} as LightboxConfig},
    provideAppInitializer(() => {
      const initializerFn = (initializeGtag)(inject(SystemConfigService), inject(LoggerFactory), inject(DateUtilsService));
      return initializerFn();
    }),
    provideAppInitializer(checkMigrationStatus)
  ]
})
export class AppModule implements DoBootstrap {
  constructor() {
    setTheme("bs5");
  }

  ngDoBootstrap(appRef: ApplicationRef) {
    appRef.bootstrap(ContainerComponent);
  }
}
