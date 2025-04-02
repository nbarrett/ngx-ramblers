import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import cloneDeep from "lodash-es/cloneDeep";
import last from "lodash-es/last";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { ApiAction } from "../../../models/api-response.model";
import {
  AccessLevelData,
  MemberResource,
  MemberResourceApiResponse,
  MemberResourcesPermissions,
  ResourceSubject
} from "../../../models/member-resource.model";
import { Member } from "../../../models/member.model";
import { Confirm } from "../../../models/ui-actions";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { ApiResponseProcessor } from "../../../services/api-response-processor.service";
import { sortBy } from "../../../functions/arrays";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesService } from "../../../services/member-resources/member-resources.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { HowToModalComponent } from "../how-to-modal.component";
import { PageComponent } from "../../../page/page.component";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { AccessFilterParameters } from "../../../models/search.model";

@Component({
    selector: "app-how-to-subject-listing",
    templateUrl: "./subject-listing.html",
    styleUrls: ["./subject-listing.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [PageComponent, MarkdownEditorComponent, FormsModule, FontAwesomeModule, MarkdownComponent, DisplayDatePipe]
})
export class HowToSubjectListingComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("HowToSubjectListingComponent", NgxLoggerLevel.ERROR);
  private pageService = inject(PageService);
  private memberResourcesReferenceDataService = inject(MemberResourcesReferenceDataService);
  private authService = inject(AuthService);
  private searchFilterPipe = inject(SearchFilterPipe);
  private notifierService = inject(NotifierService);
  private modalService = inject(BsModalService);
  private route = inject(ActivatedRoute);
  private apiResponseProcessor = inject(ApiResponseProcessor);
  private memberLoginService = inject(MemberLoginService);
  protected dateUtils = inject(DateUtilsService);
  memberResourcesService = inject(MemberResourcesService);
  memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  private stringUtils = inject(StringUtilsService);
  urlService = inject(UrlService);
  public notifyTarget: AlertTarget = {};
  public confirm = new Confirm();
  public members: Member[] = [];
  public memberResources: MemberResource[] = [];
  public filteredMemberResources: MemberResource[] = [];
  public destinationType: string;
  private memberResourceId: string;
  public memberResource: MemberResource;
  private subscriptions: Subscription[] = [];
  private searchChangeObservable: Subject<string>;
  public filterParameters: AccessFilterParameters = {quickSearch: ""};
  public allow: MemberResourcesPermissions = {};
  private notify: AlertInstance;
  public subject: string;
  public resourceSubject: ResourceSubject;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.authService.authResponse().subscribe(() => this.authChanges()));
    this.notify.setBusy();
    this.destinationType = "";
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.subject = paramMap.get("subject");
      if (this.subject) {
        this.logger.debug("subject:", this.subject);
        this.resourceSubject = this.memberResourcesReferenceData.resourceSubjectForSubject(this.subject);
        this.pageService.setTitle(this.resourceSubject?.description);
        this.memberResourcesService.all({criteria: {subject: {$eq: this.subject}}, sort: {createdDate: -1}});
      }
    }));

    if (this.urlService.pathContainsMongoId()) {
      this.logger.debug("memberResourceId from route params:", this.urlService.lastPathSegment());
      this.memberResourceId = this.urlService.lastPathSegment();
    }
    this.filterParameters.filter = this.memberResourcesReferenceData.accessLevelViewTypes()[0];
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.success({
      title: "Finding how-to articles",
      message: "please wait..."
    });
    if (this.memberResourceId) {
      this.logger.debug("memberResourceId from route params:", this.memberResourceId);
      this.memberResourcesService.getById(this.memberResourceId);
    }
    this.searchChangeObservable = new Subject<string>();
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(1000))
      .pipe(distinctUntilChanged())
      .subscribe(searchTerm => this.applyFilterToMemberResources(searchTerm)));

    this.subscriptions.push(this.memberResourcesService.notifications().subscribe((apiResponse: MemberResourceApiResponse) => {
      if (apiResponse.error) {
        this.logger.warn("received error:", apiResponse.error);
        this.notify.error({
          title: "Problem viewing Member Resource",
          message: "Refresh this page to clear this message."
        });
      } else if (this.confirm.notificationsOutstanding()) {
        this.logger.debug("Not processing subscription response due to confirm:", this.confirm.confirmType());
      } else {
        if (apiResponse.action === ApiAction.QUERY && !!this.memberResourceId) {
          this.notify.warning({
            title: "Single Member Resource being viewed",
            message: "Refresh this page to return to normal view."
          });
        }
        this.confirm.clear();
        this.memberResources = this.apiResponseProcessor.processResponse(this.logger, this.memberResources, apiResponse);
        this.applyFilterToMemberResources();
      }
    }));
    this.authChanges();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  accessLevelComparer(o1: AccessLevelData, o2: AccessLevelData) {
    return o1?.id === o2?.id;
  }

  accessLevelTracker(accessLevelData: AccessLevelData) {
    return accessLevelData?.includeAccessLevelIds;
  }

  applyFilterToMemberResources(searchTerm?: string) {
    this.logger.info("applyFilterToMemberResources:searchTerm:", searchTerm, "filterParameters.quickSearch:", this.filterParameters.quickSearch);
    this.notify.setBusy();

    const unfilteredMemberResources = this.memberResources
      .filter((memberResource: MemberResource) => {
        if (this.allow.committee) {
          this.logger.debug("this.filterParameters.filter", this.filterParameters.filter);
          return this.filterParameters.filter.includeAccessLevelIds.includes(memberResource.accessLevel);
        } else {
          return this.memberResourcesReferenceData.accessLevelFor(memberResource.accessLevel).filter();
        }
      })
      .sort(sortBy("-resourceDate"));
    this.filteredMemberResources = this.searchFilterPipe.transform(unfilteredMemberResources, this.filterParameters.quickSearch);
    const filteredCount = (this.filteredMemberResources?.length) || 0;
    const totalCount = (unfilteredMemberResources.length) || 0;
    this.logger.info("unfilteredMemberResources:", unfilteredMemberResources, "this.filteredMemberResources", this.filteredMemberResources);
    this.notify.progress(`${filteredCount} of ${this.stringUtils.pluraliseWithCount(totalCount, "article")}`);
    this.notify.clearBusy();
  }

  authChanges() {
    this.allow.committee = this.memberLoginService.allowCommittee();
    this.applyFilterToMemberResources();
    this.logger.debug("permissions:", this.allow);
  }

  isActive(memberResource) {
    const active = this.memberLoginService.allowCommittee() && memberResource === this.memberResource;
    if (active) {
      this.logger.debug("isActive =", active, "with memberResource", memberResource);
    }
    return active;
  }

  allowAdd() {
    return this.memberLoginService.allowCommittee() && this.memberLoginService.allowFileAdmin();
  }

  allowEdit(memberResource: MemberResource) {
    return this.allowAdd() && memberResource?.id;
  }

  allowDelete(memberResource) {
    return this.allowEdit(memberResource);
  }

  removeDeleteOrAddOrInProgressFlags() {
    this.confirm.clear();
  }

  delete() {
    this.confirm.toggleOnDeleteConfirm();
  }

  cancelDelete() {
    this.confirm.clear();
  }

  showDeleted() {
    this.notify.success("member resource was deleted successfully");
  }

  confirmDelete() {
    this.notify.setBusy();
    this.memberResourcesService.delete(this.memberResource)
      .then(() => this.confirm.clear())
      .then(() => this.notify.clearBusy());
  }

  selectMemberResource(memberResource: MemberResource) {
    if (this.confirm.noneOutstanding() && this.memberResource !== memberResource) {
      this.logger.debug("selectMemberResource with memberResource", memberResource);
      this.memberResource = memberResource;
    } else {
      this.logger.off("not selecting memberResource", memberResource, "this.confirm.noneOutstanding():", this.confirm.noneOutstanding());
    }
  }

  createModalOptions(initialState?: any): ModalOptions {
    return {
      class: "modal-xl",
      animated: false,
      backdrop: "static",
      ignoreBackdropClick: false,
      keyboard: true,
      focus: true,
      show: true,
      initialState: cloneDeep(initialState)
    };
  }

  edit(memberResource: MemberResource) {
    this.modalService.show(HowToModalComponent, this.createModalOptions({memberResource, confirm: this.confirm}));
  }

  add() {
    this.edit(this.memberResourcesReferenceDataService.defaultMemberResource());
  }

  refreshMemberResources() {
    this.memberResourcesService.all();
  }

  showAlertMessage(): boolean {
    return this.notifyTarget.busy || this.notifyTarget.showAlert;
  }

  notLast(resource: MemberResource): boolean {
    return last(this.filteredMemberResources) !== resource;
  }

}
