import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgSelectModule } from "@ng-select/ng-select";
import { Angular2CsvModule } from "angular2-csv";
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
import { LoggedInGuard } from "./admin-login-guard.service";
import { AuthInterceptor } from "./auth/auth.interceptor";
import { ContactUsComponent } from "./contact-us/contact-us-directive.component";
import { DatePickerComponent } from "./date-picker/date-picker.component";
import { ImageCropperAndResizerComponent } from "./image-cropper/image-cropper";
import { MarkdownEditorComponent } from "./markdown-editor/markdown-editor.component";
import { ActionButtonsComponent } from "./modules/common/action-buttons/action-buttons";
import { ActionsDropdownComponent } from "./modules/common/actions-dropdown/actions-dropdown";
import { CardEditorComponent } from "./modules/common/card-editor/card-editor";
import { CardImageComponent } from "./modules/common/card/image/card-image";
import { CopyIconComponent } from "./modules/common/copy-icon/copy-icon";
import { DynamicContentPageComponent } from "./modules/common/dynamic-content-page/dynamic-content-page";
import { ActionButtonsSettingsComponent } from "./modules/common/dynamic-content/action-buttons-settings";
import { BulkActionSelectorComponent } from "./modules/common/dynamic-content/bulk-action-selector";
import { DynamicContentComponent } from "./modules/common/dynamic-content/dynamic-content";
import { DynamicContentSiteEditComponent } from "./modules/common/dynamic-content/dynamic-content-site-edit";
import { DynamicContentSiteEditTextRowComponent } from "./modules/common/dynamic-content/dynamic-content-site-edit-text-row";
import { DynamicContentViewComponent } from "./modules/common/dynamic-content/dynamic-content-view";
import { DynamicContentViewTextRowComponent } from "./modules/common/dynamic-content/dynamic-content-view-text-row";
import { MarginSelectComponent } from "./modules/common/dynamic-content/margin-select";
import { IconExamplesComponent } from "./modules/common/icon-examples/icon-examples";
import { LoginRequiredComponent } from "./modules/common/login-required/login-required";
import { SvgComponent } from "./modules/common/svg/svg";
import { LinkComponent } from "./link/link";
import { PageComponent } from "./page/page.component";
import { LinkEditComponent } from "./modules/common/link-edit/link-edit";
import { LinksEditComponent } from "./modules/common/links-edit/links-edit";
import { ImageEditComponent } from "./pages/image-editor/image-edit/image-edit.component";
import { ImageListComponent } from "./pages/image-editor/image-list/image-list.component";
import { TagEditorComponent } from "./pages/tag/tag-editor.component";
import { RelatedLinkComponent } from "./modules/common/related-link/related-link.component";
import { TagManagerComponent } from "./pages/tag/tag-manager.component";
import { PanelExpanderComponent } from "./panel-expander/panel-expander.component";
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

@NgModule({
  imports: [
    AlertModule.forRoot(),
    Angular2CsvModule,
    BsDatepickerModule.forRoot(),
    BsDropdownModule.forRoot(),
    CarouselModule.forRoot(),
    CollapseModule.forRoot(),
    CommonModule,
    FileUploadModule,
    FontAwesomeModule,
    FormsModule,
    FormsModule,
    ImageCropperModule,
    LoggerModule.forRoot({serverLoggingUrl: "api/logs", level: NgxLoggerLevel.OFF, serverLogLevel: NgxLoggerLevel.OFF}),
    MarkdownModule.forRoot(),
    ModalModule.forRoot(),
    NgSelectModule,
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
    ActionButtonsComponent,
    ActionsDropdownComponent,
    CardEditorComponent,
    CardImageComponent,
    ContactUsComponent,
    CopyIconComponent,
    CreatedAuditPipe,
    DatePickerComponent,
    DisplayDateAndTimePipe,
    DisplayDatePipe,
    DisplayDatesPipe,
    DisplayDayPipe,
    DynamicContentComponent,
    DynamicContentPageComponent,
    DynamicContentSiteEditComponent,
    DynamicContentSiteEditTextRowComponent,
    DynamicContentViewComponent,
    DynamicContentViewTextRowComponent,
    EventNotePipe,
    FormatAuditPipe,
    FullNamePipe,
    FullNameWithAliasOrMePipe,
    FullNameWithAliasPipe,
    HumanisePipe,
    IconExamplesComponent,
    ImageCropperAndResizerComponent,
    ImageEditComponent,
    ImageListComponent,
    KebabCasePipe,
    LastConfirmedDateDisplayed,
    LineFeedsToBreaksPipe,
    LinkComponent,
    LinkEditComponent,
    LinksEditComponent,
    LoginRequiredComponent,
    ActionButtonsSettingsComponent,
    BulkActionSelectorComponent,
    MarginSelectComponent,
    MarkdownEditorComponent,
    MeetupEventSummaryPipe,
    MemberIdToFirstNamePipe,
    MemberIdToFullNamePipe,
    MemberIdsToFullNamesPipe,
    MoneyPipe,
    PageComponent,
    PanelExpanderComponent,
    RelatedLinkComponent,
    SearchFilterPipe,
    SnakeCasePipe,
    SvgComponent,
    TagEditorComponent,
    TagManagerComponent,
    UpdatedAuditPipe,
    ValueOrDefaultPipe,
  ],
  exports: [
    AccordionModule,
    ActionButtonsComponent,
    ActionsDropdownComponent,
    AlertModule,
    Angular2CsvModule,
    BsDatepickerModule,
    BsDropdownModule,
    CardEditorComponent,
    CardImageComponent,
    CarouselModule,
    CollapseModule,
    CommonModule,
    ContactUsComponent,
    CopyIconComponent,
    CreatedAuditPipe,
    DatePickerComponent,
    DisplayDateAndTimePipe,
    DisplayDatePipe,
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
    LinkEditComponent,
    LinksEditComponent,
    LoggerModule,
    LoginRequiredComponent,
    MarkdownEditorComponent,
    MarkdownModule,
    MeetupEventSummaryPipe,
    MemberIdsToFullNamesPipe,
    MemberIdToFirstNamePipe,
    MemberIdToFullNamePipe,
    ModalModule,
    MoneyPipe,
    NgSelectModule,
    LinkComponent,
    PageComponent,
    PaginationModule,
    PanelExpanderComponent,
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
        DisplayDatePipe,
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
        LoggedInGuard,
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
        {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true},
      ]
    };
  }
}
