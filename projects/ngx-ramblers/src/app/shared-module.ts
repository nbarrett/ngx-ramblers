import { ScrollingModule } from "@angular/cdk/scrolling";
import { AsyncPipe, CommonModule, NgFor } from "@angular/common";
import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
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
import { CustomNGXLoggerService, LoggerModule, NgxLoggerLevel } from "ngx-logger";
import { MarkdownModule } from "ngx-markdown";
import { TagifyModule } from "ngx-tagify";
import { UiSwitchModule } from "ngx-ui-switch";
import { AuthInterceptor } from "./auth/auth.interceptor";
import { ContactUsComponent } from "./committee/contact-us/contact-us";
import { DatePickerComponent } from "./date-picker/date-picker.component";
import { ImageCropperAndResizerComponent } from "./image-cropper-and-resizer/image-cropper-and-resizer";
import { MarkdownEditorComponent } from "./markdown-editor/markdown-editor.component";
import { ActionButtonsComponent } from "./modules/common/action-buttons/action-buttons";
import { ActionsDropdownComponent } from "./modules/common/actions-dropdown/actions-dropdown";
import { CardEditorComponent } from "./modules/common/card-editor/card-editor";
import { CardImageComponent } from "./modules/common/card/image/card-image";
import { CopyIconComponent } from "./modules/common/copy-icon/copy-icon";
import { DynamicContentPageComponent } from "./modules/common/dynamic-content-page/dynamic-content-page";
import {
  RowSettingsActionButtonsComponent
} from "./modules/common/dynamic-content/dynamic-content-row-settings-action-buttons";
import { BulkActionSelectorComponent } from "./modules/common/dynamic-content/bulk-action-selector";
import { DynamicContentComponent } from "./modules/common/dynamic-content/dynamic-content";
import { DynamicContentSiteEditComponent } from "./modules/common/dynamic-content/dynamic-content-site-edit";
import {
  DynamicContentSiteEditTextRowComponent
} from "./modules/common/dynamic-content/dynamic-content-site-edit-text-row";
import { DynamicContentViewComponent } from "./modules/common/dynamic-content/dynamic-content-view";
import { DynamicContentViewTextRowComponent } from "./modules/common/dynamic-content/dynamic-content-view-text-row";
import { MarginSelectComponent } from "./modules/common/dynamic-content/dynamic-content-margin-select";
import { IconExamplesComponent } from "./modules/common/icon-examples/icon-examples";
import { LoginRequiredComponent } from "./modules/common/login-required/login-required";
import { SvgComponent } from "./modules/common/svg/svg";
import { LinkComponent } from "./link/link";
import { PageComponent } from "./page/page.component";
import { LinkEditComponent } from "./modules/common/link-edit/link-edit";
import { LinksEditComponent } from "./modules/common/links-edit/links-edit";
import { ImageEditComponent } from "./carousel/edit/image-edit/image-edit";
import { ImageListEditComponent } from "./carousel/edit/image-list-edit/image-list-edit";
import { TagEditorComponent } from "./pages/tag/tag-editor.component";
import { RelatedLinkComponent } from "./modules/common/related-link/related-link.component";
import { TagManagerComponent } from "./pages/tag/tag-manager.component";
import { WalkPanelExpanderComponent } from "./panel-expander/walk-panel-expander";
import { AuditDeltaChangedItemsPipePipe } from "./pipes/audit-delta-changed-items.pipe";
import { AuditDeltaValuePipe } from "./pipes/audit-delta-value.pipe";
import { ChangedItemsPipe } from "./pipes/changed-items.pipe";
import { CreatedAuditPipe } from "./pipes/created-audit-pipe";
import { DisplayDateAndTimePipe } from "./pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "./pipes/display-date.pipe";
import { DisplayDatesPipe } from "./pipes/display-dates.pipe";
import { DisplayDayPipe } from "./pipes/display-day.pipe";
import { EventNotePipe } from "./pipes/event-note.pipe";
import { FormatAuditPipe } from "./pipes/format-audit-pipe";
import { FullNameWithAliasOrMePipe } from "./pipes/full-name-with-alias-or-me.pipe";
import { FullNameWithAliasPipe } from "./pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "./pipes/full-name.pipe";
import { HumanisePipe } from "./pipes/humanise.pipe";
import { KebabCasePipe } from "./pipes/kebabcase.pipe";
import { LastConfirmedDateDisplayed } from "./pipes/last-confirmed-date-displayed.pipe";
import { LineFeedsToBreaksPipe } from "./pipes/line-feeds-to-breaks.pipe";
import { MeetupEventSummaryPipe } from "./pipes/meetup-event-summary.pipe";
import { MemberIdToFirstNamePipe } from "./pipes/member-id-to-first-name.pipe";
import { MemberIdToFullNamePipe } from "./pipes/member-id-to-full-name.pipe";
import { MemberIdsToFullNamesPipe } from "./pipes/member-ids-to-full-names.pipe";
import { MoneyPipe } from "./pipes/money.pipe";
import { SearchFilterPipe } from "./pipes/search-filter.pipe";
import { SnakeCasePipe } from "./pipes/snakecase.pipe";
import { UpdatedAuditPipe } from "./pipes/updated-audit-pipe";
import { ValueOrDefaultPipe } from "./pipes/value-or-default.pipe";
import { BroadcastService } from "./services/broadcast-service";
import { ClipboardService } from "./services/clipboard.service";
import { CommitteeConfigService } from "./services/committee/commitee-config.service";
import { IconService } from "./services/icon-service/icon-service";
import { ImageDuplicatesService } from "./services/image-duplicates-service";
import { ImageTagDataService } from "./services/image-tag-data-service";
import { MailchimpConfigService } from "./services/mailchimp-config.service";
import { MailchimpListSubscriptionService } from "./services/mailchimp/mailchimp-list-subscription.service";
import { MarkdownEditorFocusService } from "./services/markdown-editor-focus-service";
import { MemberResourcesReferenceDataService } from "./services/member/member-resources-reference-data.service";
import { NotifierService } from "./services/notifier.service";
import { PageContentService } from "./services/page-content.service";
import { RouterHistoryService } from "./services/router-history.service";
import { SiteEditService } from "./site-edit/site-edit.service";
import { CarouselSelectorComponent } from "./carousel/edit/carousel-selector/carousel-selector";
import { CarouselComponent } from "./carousel/view/carousel";
import {
  CarouselStoryNavigatorComponent
} from "./carousel/view/carousel-story-navigator/carousel-story-navigator.component";
import { AspectRatioSelectorComponent } from "./carousel/edit/aspect-ratio-selector/aspect-ratio-selector";
import { ImageListEditPageComponent } from "./carousel/edit/image-list-page/image-list-edit-page";
import { BadgeButtonComponent } from "./modules/common/badge-button/badge-button";
import { DynamicContentViewCarouselComponent } from "./modules/common/dynamic-content/dynamic-content-view-carousel";
import { CarouselSelectComponent } from "./carousel/edit/carousel-selector/carousel-select";
import { RowSettingsCarouselComponent } from "./modules/common/dynamic-content/dynamic-content-site-edit-carousel-row";
import { CsvExportComponent } from "./csv-export/csv-export";
import { GALLERY_CONFIG, GalleryConfig, GalleryModule } from "ng-gallery";
import { LIGHTBOX_CONFIG, LightboxConfig, LightboxModule } from "ng-gallery/lightbox";
import { DynamicContentViewAlbumComponent } from "./modules/common/dynamic-content/dynamic-content-view-album";
import { AlbumComponent } from "./album/view/album";
import {
  DynamicContentViewAlbumIndexComponent
} from "./modules/common/dynamic-content/dynamic-content-view-album-index";
import { AlbumGridComponent } from "./album/view/album-grid";
import { AlbumGalleryComponent } from "./album/view/album-gallery";
import { GroupEventSelectorComponent } from "./group-events-selector/group-event-selector";
import { GroupEventTypeSelectorComponent } from "./group-events-selector/group-event-type-selector";
import { DynamicContentSiteEditAlbumComponent } from "./modules/common/dynamic-content/dynamic-content-site-edit-album";
import { ColumnWidthComponent } from "./modules/common/dynamic-content/column-width";
import { DisplayDatesAndTimesPipe } from "./pipes/display-dates-and-times.pipe";
import { CommitteeRoleMultiSelectComponent } from "./committee/role-multi-select/committee-role-multi-select";
import { NgxCaptureModule } from "ngx-capture";
import { ButtonsModule } from "ngx-bootstrap/buttons";
import { NotificationDirective } from "./notifications/common/notification.directive";
import { BrevoButtonComponent } from "./modules/common/third-parties/brevo-button";
import { MailchimpButtonComponent } from "./modules/common/third-parties/mailchimp-button";
import { ButtonWrapperComponent } from "./modules/common/third-parties/button-wrapper";
import { MailProviderSettingsComponent } from "./pages/admin/system-settings/mail-provider/mail-provider-settings";
import { DisplayDateNoDayPipe } from "./pipes/display-date-no-day.pipe";
import { NotificationConfigSelectorComponent } from "./pages/admin/system-settings/mail/notification-config-selector";
import { SenderRepliesAndSignoffComponent } from "./pages/admin/send-emails/sender-replies-and-signoff";
import { CustomReuseStrategy } from "./routing/custom-reuse-strategy";
import { AlbumIndexSiteEditComponent } from "./modules/common/dynamic-content/dynamic-content-site-edit-album-index";
import { ColourSelectorComponent } from "./pages/banner/colour-selector";
import { MeetupButtonComponent } from "./modules/common/third-parties/meetup-button";

@NgModule({
  imports: [
    AlertModule.forRoot(),
    AsyncPipe,
    BsDatepickerModule.forRoot(),
    BsDropdownModule.forRoot(),
    ButtonsModule,
    CarouselModule.forRoot(),
    CollapseModule.forRoot(),
    CommonModule,
    FileUploadModule,
    FontAwesomeModule,
    FormsModule,
    FormsModule,
    GalleryModule,
    ImageCropperModule,
    LightboxModule,
    LoggerModule.forRoot({serverLoggingUrl: "api/logs", level: NgxLoggerLevel.OFF, serverLogLevel: NgxLoggerLevel.OFF}),
    MarkdownModule.forRoot(),
    ModalModule.forRoot(),
    NgFor,
    NgSelectModule,
    NgxCaptureModule,
    PaginationModule.forRoot(),
    PopoverModule.forRoot(),
    RouterModule,
    ScrollingModule,
    TabsModule.forRoot(),
    TagifyModule.forRoot(),
    TooltipModule.forRoot(),
    TypeaheadModule.forRoot(),
    UiSwitchModule,
  ],
  declarations: [
    ColourSelectorComponent,
    ActionButtonsComponent,
    ActionsDropdownComponent,
    AlbumComponent,
    AlbumGalleryComponent,
    AlbumGridComponent,
    AspectRatioSelectorComponent,
    BadgeButtonComponent,
    BrevoButtonComponent,
    MeetupButtonComponent,
    BulkActionSelectorComponent,
    ButtonWrapperComponent,
    CardEditorComponent,
    CardImageComponent,
    CarouselComponent,
    CarouselSelectComponent,
    CarouselSelectorComponent,
    CarouselStoryNavigatorComponent,
    ColumnWidthComponent,
    CommitteeRoleMultiSelectComponent,
    ContactUsComponent,
    CopyIconComponent,
    CreatedAuditPipe,
    CsvExportComponent,
    DatePickerComponent,
    DisplayDateAndTimePipe,
    DisplayDateNoDayPipe,
    DisplayDatePipe,
    DisplayDatesAndTimesPipe,
    DisplayDatesPipe,
    DisplayDayPipe,
    DynamicContentComponent,
    DynamicContentPageComponent,
    DynamicContentSiteEditAlbumComponent,
    AlbumIndexSiteEditComponent,
    DynamicContentSiteEditComponent,
    DynamicContentSiteEditTextRowComponent,
    DynamicContentViewAlbumComponent,
    DynamicContentViewAlbumIndexComponent,
    DynamicContentViewCarouselComponent,
    DynamicContentViewComponent,
    DynamicContentViewTextRowComponent,
    EventNotePipe,
    FormatAuditPipe,
    FullNamePipe,
    FullNameWithAliasOrMePipe,
    FullNameWithAliasPipe,
    GroupEventSelectorComponent,
    GroupEventTypeSelectorComponent,
    HumanisePipe,
    IconExamplesComponent,
    ImageCropperAndResizerComponent,
    ImageEditComponent,
    ImageListEditComponent,
    ImageListEditPageComponent,
    KebabCasePipe,
    LastConfirmedDateDisplayed,
    LineFeedsToBreaksPipe,
    LinkComponent,
    LinkEditComponent,
    LinksEditComponent,
    LoginRequiredComponent,
    MailchimpButtonComponent,
    MailProviderSettingsComponent,
    MarginSelectComponent,
    MarkdownEditorComponent,
    MeetupEventSummaryPipe,
    MemberIdsToFullNamesPipe,
    MemberIdToFirstNamePipe,
    MemberIdToFullNamePipe,
    MoneyPipe,
    NotificationConfigSelectorComponent,
    SenderRepliesAndSignoffComponent,
    NotificationDirective,
    PageComponent,
    RelatedLinkComponent,
    RowSettingsActionButtonsComponent,
    RowSettingsCarouselComponent,
    SearchFilterPipe,
    SnakeCasePipe,
    SvgComponent,
    TagEditorComponent,
    TagManagerComponent,
    UpdatedAuditPipe,
    ValueOrDefaultPipe,
    WalkPanelExpanderComponent,
  ],
  exports: [
    AccordionModule,
    ColourSelectorComponent,
    ActionButtonsComponent,
    ActionsDropdownComponent,
    AlertModule,
    AspectRatioSelectorComponent,
    BadgeButtonComponent,
    BrevoButtonComponent,
    MeetupButtonComponent,
    BsDatepickerModule,
    BsDropdownModule,
    ButtonWrapperComponent,
    ButtonsModule,
    CardEditorComponent,
    CardImageComponent,
    CarouselComponent,
    CarouselModule,
    CarouselSelectorComponent,
    CarouselStoryNavigatorComponent,
    CollapseModule,
    CommitteeRoleMultiSelectComponent,
    CommonModule,
    ContactUsComponent,
    CopyIconComponent,
    CreatedAuditPipe,
    CsvExportComponent,
    DatePickerComponent,
    DisplayDateAndTimePipe,
    DisplayDateNoDayPipe,
    DisplayDatePipe,
    DisplayDatesAndTimesPipe,
    DisplayDatesPipe,
    DisplayDayPipe,
    DynamicContentComponent,
    DynamicContentPageComponent,
    EventNotePipe,
    FileUploadModule,
    FontAwesomeModule,
    FormsModule,
    FullNamePipe,
    FullNameWithAliasOrMePipe,
    FullNameWithAliasPipe,
    HumanisePipe,
    IconExamplesComponent,
    ImageCropperAndResizerComponent,
    ImageCropperModule,
    KebabCasePipe,
    LastConfirmedDateDisplayed,
    LineFeedsToBreaksPipe,
    LinkComponent,
    LinkEditComponent,
    LinksEditComponent,
    LoggerModule,
    LoginRequiredComponent,
    MailProviderSettingsComponent,
    MailchimpButtonComponent,
    MarkdownEditorComponent,
    MarkdownModule,
    MeetupEventSummaryPipe,
    MemberIdToFirstNamePipe,
    MemberIdToFullNamePipe,
    MemberIdsToFullNamesPipe,
    ModalModule,
    MoneyPipe,
    NgSelectModule,
    NotificationDirective,
    NotificationConfigSelectorComponent,
    SenderRepliesAndSignoffComponent,
    PageComponent,
    PaginationModule,
    PopoverModule,
    RelatedLinkComponent,
    RouterModule,
    SearchFilterPipe,
    SnakeCasePipe,
    SvgComponent,
    TabsModule,
    TooltipModule,
    UiSwitchModule,
    UpdatedAuditPipe,
    ValueOrDefaultPipe,
    WalkPanelExpanderComponent,
  ]
})
export class SharedModule {
  static forRoot(): ModuleWithProviders<SharedModule> {
    return {
      ngModule: SharedModule,
      providers: [
        AuditDeltaChangedItemsPipePipe,
        AuditDeltaValuePipe,
        BroadcastService,
        ChangedItemsPipe,
        ClipboardService,
        CommitteeConfigService,
        CustomNGXLoggerService,
        DisplayDateAndTimePipe,
        DisplayDateNoDayPipe,
        DisplayDatePipe,
        DisplayDatesAndTimesPipe,
        DisplayDatesPipe,
        DisplayDayPipe,
        EventNotePipe,
        FullNamePipe,
        FullNameWithAliasOrMePipe,
        FullNameWithAliasPipe,
        HumanisePipe,
        IconService,
        ImageDuplicatesService,
        ImageTagDataService,
        KebabCasePipe,
        LastConfirmedDateDisplayed,
        LineFeedsToBreaksPipe,
        MailchimpConfigService,
        MailchimpListSubscriptionService,
        MarkdownEditorFocusService,
        MeetupEventSummaryPipe,
        MemberIdToFullNamePipe,
        MemberIdsToFullNamesPipe,
        MemberResourcesReferenceDataService,
        NotifierService,
        PageContentService,
        RouterHistoryService,
        SearchFilterPipe,
        SiteEditService,
        SnakeCasePipe,
        UpdatedAuditPipe,
        ValueOrDefaultPipe,
        {provide: RouteReuseStrategy, useClass: CustomReuseStrategy},
        {
          provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true
        },
        {
          provide: GALLERY_CONFIG,
          useValue: {
            imageSize: "cover"
          } as GalleryConfig
        },
        {
          provide: LIGHTBOX_CONFIG,
          useValue: {
            keyboardShortcuts: false,
            exitAnimationTime: 1000
          } as LightboxConfig
        }
      ]
    };
  }
}
