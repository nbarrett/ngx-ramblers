import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription, timer } from "rxjs";
import { StepperModule } from "primeng/stepper";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faCircleExclamation, faEnvelope, faFloppyDisk, faHammer, faMagnifyingGlass, faRotate, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { PageComponent } from "../../page/page.component";
import { GroupSelector } from "../walks/walk-edit/group-selector";
import { SiteRegistrationService } from "../../services/site-registration.service";
import { UrlService } from "../../services/url.service";
import { REGISTRATION_STEPS, RamblersDirectoryLogo, RegistrationDiscoveryProgress, RegistrationPage, RegistrationPageAnchor, RegistrationPlan, RegistrationState, RegistrationStep, SiteRegistration } from "../../models/site-registration.model";
import { registrationPageTree } from "../../functions/registration-page-tree";
import { SiteMapViewMode, SitemapMoveDirection, SitemapNode } from "../../models/sitemap.model";
import { SiteMapViewComponent } from "../../modules/common/site-map/site-map-view";
import { AdminPlatformPath } from "../../models/admin-route-paths.model";
import { RamblersGroupsApiResponse } from "../../models/ramblers-walks-manager";
import { StoredValue, StoredValueQueryParameters } from "../../models/ui-actions";
import { StringUtilsService } from "../../services/string-utils.service";
import { values } from "es-toolkit/compat";
import { RegistrationProgressLogComponent } from "../../modules/common/registration-progress-log/registration-progress-log";
import { SecretInputComponent } from "../../modules/common/secret-input/secret-input.component";
import { SuggestedTextChooserComponent } from "../../shared/components/suggested-text-chooser";
import { DescriptionTidyView } from "../../models/text-diff.model";
import { registrationPagesMoved, registrationPagesWithSelection } from "../../functions/registration-page-tree";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { AreaSelector } from "../walks/walk-edit/area-selector";
import { AvailableAreasService } from "../../services/available-areas.service";
import { AvailableArea } from "../../models/system.model";
import { DynamicContentComponent } from "../../modules/common/dynamic-content/dynamic-content";
import { RegistrationStepperComponent } from "../../modules/common/registration-stepper/registration-stepper";
import { BuiltInAnchor } from "../../models/content-text.model";
import { MemberLoginService } from "../../services/member/member-login.service";

@Component({
  selector: "app-site-registration",
  imports: [FormsModule, RouterLink, DynamicContentComponent, RegistrationStepperComponent, StepperModule, FontAwesomeModule, PageComponent, GroupSelector, AreaSelector, SiteMapViewComponent, RegistrationProgressLogComponent, SecretInputComponent, SuggestedTextChooserComponent],
  template: `
    <app-page pageTitle="Register your group or area" [showTitle]="false">
      <app-dynamic-content [anchor]="BuiltInAnchor.REGISTRATION_INTRO" areaAsContentPath contentPathReadOnly preventRedirect/>
      @if (memberLoginService.allowMemberAdminEdits()) {
        <div class="mb-3">
          <a class="btn btn-primary btn-sm" [routerLink]="'/' + registrationsPath"><fa-icon [icon]="icons.admin" class="me-2"/>Open Site registrations</a>
        </div>
      }
      @if (registrationOpen === false) {
        <div class="alert alert-warning d-flex align-items-start"><fa-icon [icon]="faCircleExclamation" class="me-2"/><div>
          <strong>Site registration is switched off</strong>
          <p>Turn it on under <a [routerLink]="'/' + registrationsPath" [fragment]="Anchor.PUBLIC_REGISTRATION" target="_blank" rel="noopener noreferrer">Site registrations</a>.</p>
        </div></div>
      }
      @if (token) {
        <div class="thumbnail-heading-frame mb-3"><div class="thumbnail-heading">Return to this registration</div>
          <p>Keep this private link. It restores your saved answers.</p>
          <app-secret-input id="registration-return-link" [(ngModel)]="resumeUrl" [reveal]="false" readOnly aria-label="Private return link" autocomplete="off"/>
        </div>
      }
      <p-stepper class="p-stepper" [(value)]="activeStep" [linear]="false">
        @for (step of steps; track step.key; let index = $index) {
          <p-step-item [value]="index + 1">
            <p-step [disabled]="busy || !canAccessStep(step.key)">
              <div class="stepper-step-header">
                <span class="stepper-step-number">{{index + 1}}</span>
                <div class="stepper-step-text">
                  <div class="stepper-step-label">{{step.label}}</div>
                  <div class="stepper-step-hint">{{step.hint}}</div>
                </div>
              </div>
            </p-step>
            <p-step-panel><ng-template pTemplate="content">
              @switch (step.key) {
                @case (Step.PLAN) {
                  <div class="form-check mb-3">
                    <input id="registration-plan-lite" class="form-check-input" type="radio" name="plan" [value]="Plan.LITE" [(ngModel)]="plan" (ngModelChange)="planChanged($event)" [disabled]="!planEditable()"/>
                    <label class="form-check-label" for="registration-plan-lite"><strong>Lite</strong> provides email and membership tools with a reduced public site. It does not import your existing website. <a routerLink="/how-to/group-registration/lite" target="_blank" rel="noopener noreferrer">What Lite includes</a></label>
                  </div>
                  <div class="form-check mb-3">
                    <input id="registration-plan-full" class="form-check-input" type="radio" name="plan" [value]="Plan.FULL" [(ngModel)]="plan" (ngModelChange)="planChanged($event)" [disabled]="!planEditable()"/>
                    <label class="form-check-label" for="registration-plan-full"><strong>Full</strong> includes every discovered page and photo from the group's current website. Walks come from Walks Manager, not from the old site. <a routerLink="/how-to/group-registration/full" target="_blank" rel="noopener noreferrer">Choosing pages for a Full site</a></label>
                  </div>
                  <p class="mb-0"><a routerLink="/how-to/group-registration/after-submission" target="_blank" rel="noopener noreferrer">What happens after you confirm</a></p>
                }
                @case (Step.GROUP) {
                  <p class="guidance">Choose your Ramblers area from the existing Ramblers directory. To register a group, choose it too. Leave the group empty to register the area itself.</p>
                  <app-area-selector id="registration-area" label="Area" [areaCode]="areaCode" [disabled]="!!registration" (areaChanged)="areaChanged($event)"/>
                  <app-group-selector label="Group (leave empty for an area site)" [areaCode]="areaCode" [groupCode]="groupCode" [disabled]="!!registration" (groupChanged)="groupChanged($event)"/>
                  @if (directoryLogo?.awsFileName) {
                    <div class="mt-3">
                      <img [src]="urlService.resourceRelativePathForAWSFileName(directoryLogo.awsFileName)" [alt]="directoryLogo.displayName" style="height: 48px; width: auto;">
                    </div>
                  }
                }
                @case (Step.EMAIL) {
                  <p class="guidance">Use an email address approved by the platform administrator for your committee. Follow the email link to unlock the remaining steps.</p>
                  <label for="registration-email">Committee email</label>
                  <input id="registration-email" type="email" class="form-control" [(ngModel)]="email" [disabled]="!!registration"/>
                  <button class="btn btn-primary mt-2" [disabled]="busy || !email || !areaCode" (click)="start()"><fa-icon [icon]="icons.email" class="me-2"/>Send confirmation email</button>
                }
                @case (Step.CONTENT) {
                  @if (registration) {
                    <p class="guidance">Find pages builds a navbar of at most eight sections (Home, About Us, Walks, Events, Contact Us, Photos, Information, Admin). Everything else is grouped under those. Tick to include, untick to leave out, and use the arrows to reorder.</p>
                    <label for="registration-website">Current website</label>
                    <input id="registration-website" type="url" class="form-control" [(ngModel)]="registration.website"/>
                    <button class="btn btn-primary my-2" [disabled]="busy" (click)="discover()">
                      <fa-icon [icon]="busy ? icons.refresh : icons.search" [animation]="busy ? 'spin' : undefined" class="me-2"/>
                      {{busy ? "Finding pages..." : "Find pages"}}
                    </button>
                    @if (busy && discoveryProgress) {
                      <p class="discovery-progress small text-muted mb-2" aria-live="polite">
                        {{ discoveryProgress.message }}
                        @if (discoveryProgress.pagesRead) {
                          · {{ discoveryProgress.pagesRead }} read, {{ discoveryProgress.pagesFound }} found so far
                        }
                      </p>
                    }
                    @if (message) {
                      <div class="alert alert-warning d-flex align-items-start mb-2"><fa-icon [icon]="faCircleExclamation" class="me-2"/><div><strong>Could not find pages</strong><p class="mb-0">{{message}}</p></div></div>
                    }
                    <p class="guidance">Tick the pages to import. Untick a page to leave it out. The wand uses the suggested navbar title; the cross keeps the wording from the current website.</p>
                    <app-site-map-view [roots]="pageNodes" [viewMode]="SiteMapViewMode.TREE" [treeDepth]="99" showFilter showPreview selectable
                                       (selectionChange)="onPageSelection($event)" (moveChange)="onPageMove($event)" (focusChange)="onPageFocus($event)"
                                       emptyMessage="Find pages to see the content that will be copied to the new site.">
                      @if (focusedPage(); as page) {
                        <div class="thumbnail-heading">This page</div>
                        <p class="mb-2"><code>/{{page.path}}</code></p>
                        <label class="form-check mb-2"><input class="form-check-input" type="checkbox" [ngModel]="page.selected" (ngModelChange)="onPageSelection({key: page.path, selected: $event})"/> Import this page</label>
                        <app-suggested-text-chooser
                          [suggestion]="page.suggestedTitle && page.suggestedTitle !== (page.sourceTitle || page.title) ? page.suggestedTitle : ''"
                          [changesMarkdown]="pageSuggestionDiff(page)"
                          [view]="pageSuggestionView"
                          [views]="pageSuggestionViews"
                          [queryParamKey]="StoredValue.PAGE_SUGGESTION"
                          [heading]="'Suggested navbar title:'"
                          [prompt]="'use the wand to take this wording or keep the current website title.'"
                          (viewChange)="pageSuggestionView = $event"
                          (applied)="applySuggestedTitle(page)"
                          (kept)="keepSourceTitle(page)">
                          <label class="form-label" for="focused-page-title">Title</label>
                          <input id="focused-page-title" class="form-control" [(ngModel)]="page.title" (ngModelChange)="updatePageTitle(page, $event)"/>
                        </app-suggested-text-chooser>
                        @if (page.imageUrls?.length) {
                          <div class="d-flex flex-wrap gap-2 mt-2">
                            @for (image of page.imageUrls; track image) {
                              <img [src]="image" alt="" class="rounded" style="max-width: 8rem; max-height: 8rem; object-fit: cover;"/>
                            }
                          </div>
                        } @else if (page.url) {
                          <p class="text-muted mt-2 mb-0">No images were found on this source page. <a [href]="page.url" target="_blank" rel="noopener noreferrer">Open the current page</a></p>
                        }
                      } @else {
                        <p class="mb-0">Click a page title, then tick or untick it. Suggested navbar titles appear here when they differ from the current website.</p>
                      }
                    </app-site-map-view>
                    <p><a routerLink="/how-to/group-registration/full" target="_blank" rel="noopener noreferrer">Choosing pages for a Full site</a></p>
                  }
                }
                @case (Step.REVIEW) {
                  <p class="guidance">Confirm your choices to start creating the review site. The platform administrator will check it before your group receives an invitation.</p>
                  <p><strong>{{registration?.group?.name}}</strong> - {{registration?.plan}}</p>
                  <p class="guidance">This is the structure that will be built. Go back to Choose content to tick, untick or move pages.</p>
                  <app-site-map-view [roots]="selectedPageNodes" [viewMode]="SiteMapViewMode.TREE" [treeDepth]="99" showFilter emptyMessage="No pages are ticked for import."/>
                }
                @case (Step.PROGRESS) {
                  <app-registration-stepper class="d-block mb-3" [stages]="registration?.stages || []"/>
                  <app-registration-progress-log class="d-block mb-3" [progress]="registration?.progress || []" [error]="registration?.error || ''" [inFlight]="progressInFlight()"/>
                }
              }
              @if (message && step.key !== Step.CONTENT) {
                <div class="alert alert-warning d-flex align-items-start mt-3 mb-0"><fa-icon [icon]="faCircleExclamation" class="me-2"/><div><strong>Registration update</strong><p class="mb-0">{{message}}</p></div></div>
              }
              <div class="stepper-nav stepper-nav-split mt-3">
                <button class="btn btn-quiet" [disabled]="busy || index === 0" (click)="goToStep(index - 1)"><fa-icon [icon]="icons.back" class="me-2"/>Back</button>
                @if (step.key === Step.REVIEW) {
                  <button class="btn btn-primary ms-auto" [disabled]="busy" (click)="submit()"><fa-icon [icon]="icons.build" class="me-2"/>Confirm and build site</button>
                } @else if (step.key === Step.PROGRESS && (registration?.state === State.FAILED || registration?.state === State.BROKEN)) {
                  <button class="btn btn-primary ms-auto" [disabled]="busy" (click)="retryBuild()"><fa-icon [icon]="icons.refresh" class="me-2"/>Retry build</button>
                } @else if (step.key === Step.PROGRESS) {
                  <button class="btn btn-quiet ms-auto" [disabled]="busy" (click)="refresh()"><fa-icon [icon]="icons.refresh" class="me-2"/>Refresh status</button>
                } @else if (index < 4) {
                  <button class="btn btn-primary ms-auto" [disabled]="busy || !canAccessStep(steps[nextStep(index)].key)" (click)="goToStep(nextStep(index))"><fa-icon [icon]="icons.save" class="me-2"/>Save and next</button>
                }
              </div>
            </ng-template></p-step-panel>
          </p-step-item>
        }
      </p-stepper>
    </app-page>`
})
export class SiteRegistrationComponent implements OnInit, OnDestroy {
  private service = inject(SiteRegistrationService);
  protected urlService = inject(UrlService);
  private availableAreasService = inject(AvailableAreasService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stringUtils = inject(StringUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("SiteRegistrationComponent", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];
  private destroyed = false;
  protected readonly Step = RegistrationStep;
  protected readonly Plan = RegistrationPlan;
  protected readonly State = RegistrationState;
  protected readonly Anchor = RegistrationPageAnchor;
  protected readonly registrationsPath = AdminPlatformPath.ENVIRONMENT_MANAGEMENT_REGISTRATIONS;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly BuiltInAnchor = BuiltInAnchor;
  protected memberLoginService = inject(MemberLoginService);
  readonly icons = {admin: faListCheck, email: faEnvelope, search: faMagnifyingGlass, build: faHammer, refresh: faRotate, back: faArrowLeft, save: faFloppyDisk};
  readonly SiteMapViewMode = SiteMapViewMode;
  readonly steps = REGISTRATION_STEPS;
  plan = RegistrationPlan.LITE;
  areaCode = "";
  groupCode = "";
  group: RamblersGroupsApiResponse = null;
  email = "";
  registration: SiteRegistration = null;
  pageNodes: SitemapNode[] = [];
  selectedPageNodes: SitemapNode[] = [];
  token = "";
  resumeUrl = "";
  message = "";
  registrationOpen: boolean = null;
  busy = false;
  discoveryProgress: RegistrationDiscoveryProgress | null = null;
  activeStep = 1;
  directoryLogo: RamblersDirectoryLogo = null;

  progressInFlight(): boolean {
    return [RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING].includes(this.registration?.state);
  }

  async ngOnInit(): Promise<void> {
    const requestedPlan = this.route.snapshot.queryParamMap.get(StoredValue.PLAN) as RegistrationPlan;
    this.plan = values(RegistrationPlan).includes(requestedPlan) ? requestedPlan : RegistrationPlan.LITE;
    this.areaCode = this.route.snapshot.queryParamMap.get(StoredValue.AREA) || "";
    this.groupCode = this.route.snapshot.queryParamMap.get(StoredValue.GROUP) || "";
    const requestedStep = this.route.snapshot.queryParamMap.get(StoredValue.STEP) as RegistrationStep;
    const requestedStepIndex = this.steps.findIndex(step => step.key === requestedStep);
    this.activeStep = requestedStepIndex >= 0 ? requestedStepIndex + 1 : 1;
    await this.perform(async () => {
      this.registrationOpen = (await this.service.availability()).enabled;
      const confirmation = this.route.snapshot.paramMap.get("confirmation");
      this.token = confirmation ? (await this.service.confirm(confirmation)).resumeToken : this.route.snapshot.paramMap.get("token") || "";
      if (this.token) {
        await this.router.navigate(["/register", this.token], {replaceUrl: true});
        this.restore(await this.service.current(this.token));
        this.resumeUrl = `${window.location.origin}/register/${this.token}`;
      }
    });
    this.refreshDirectoryLogo();
    if (!this.destroyed) {
      this.subscriptions.push(timer(10000, 10000).subscribe(() => {
        if (this.token && !this.busy && this.registration?.state !== RegistrationState.DRAFT) {
          this.refreshProgress();
        }
      }));
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  activeStepKey(): RegistrationStep {
    return this.steps[this.activeStep - 1]?.key || null;
  }

  canAccessStep(step: RegistrationStep): boolean {
    const draft = !this.registration || this.registration.state === RegistrationState.DRAFT;
    if (step === RegistrationStep.PLAN) {
      return draft;
    } else if (step === RegistrationStep.GROUP) {
      return draft && !!this.plan;
    } else if (step === RegistrationStep.EMAIL) {
      return !!this.areaCode && (!this.registration || this.registration.state === RegistrationState.AWAITING_EMAIL);
    } else if (step === RegistrationStep.CONTENT) {
      return draft && !!this.registration?.verifiedAt && this.plan === RegistrationPlan.FULL;
    } else if (step === RegistrationStep.REVIEW) {
      return draft && !!this.registration?.verifiedAt && (this.plan === RegistrationPlan.LITE || this.registration.pages.some(page => page.selected));
    } else {
      return !!this.registration && ![RegistrationState.DRAFT, RegistrationState.AWAITING_EMAIL].includes(this.registration.state);
    }
  }

  nextStep(index: number): number {
    return index === 2 && this.plan === RegistrationPlan.LITE ? 4 : index + 1;
  }

  async goToStep(index: number): Promise<void> {
    const goingBack = index < this.activeStep - 1;
    if (goingBack || this.canAccessStep(this.steps[index].key)) {
      await this.perform(async () => {
        if (this.registration?.state === RegistrationState.DRAFT) {
          this.applyRegistration(await this.service.save(this.token, {...this.registration, currentStep: this.steps[index].key}));
        }
        this.activeStep = index + 1;
        await this.router.navigate([], {relativeTo: this.route, queryParams: {[StoredValue.STEP]: this.steps[index].key}, queryParamsHandling: "merge"});
      });
    }
  }

  async start(): Promise<void> {
    await this.perform(async () => {
      const result = await this.service.start({email: this.email, areaCode: this.areaCode, groupCode: this.groupCode, plan: this.plan});
      this.message = result.message;
      if (result.resumeToken) {
        this.token = result.resumeToken;
        this.resumeUrl = `${window.location.origin}/register/${this.token}`;
        this.applyRegistration(await this.service.current(this.token));
      }
    });
  }

  async discover(): Promise<void> {
    if (!this.registration?.website) {
      this.message = "Enter the current website address, then find pages.";
    } else {
      const watch = timer(1000, 1500).subscribe(() => this.refreshDiscoveryProgress());
      try {
        await this.perform(async () => {
          this.applyRegistration(await this.service.save(this.token, this.registration));
          this.applyRegistration(await this.service.discover(this.token, this.registration.website));
        });
      } finally {
        watch.unsubscribe();
        this.discoveryProgress = null;
      }
    }
  }

  async submit(): Promise<void> {
    await this.perform(async () => {
      this.applyRegistration(await this.service.save(this.token, this.registration));
      this.restore(await this.service.submit(this.token));
    });
  }

  async retryBuild(): Promise<void> {
    await this.perform(async () => {
      this.restore(await this.service.retryOwn(this.token));
      this.activeStep = 6;
    });
  }

  async refresh(): Promise<void> {
    await this.perform(async () => this.restore(await this.service.current(this.token)));
  }

  pageSuggestionView: DescriptionTidyView | string = DescriptionTidyView.ORIGINAL;
  pageSuggestionViews: SectionToggleTab[] = [
    {value: DescriptionTidyView.ORIGINAL, label: "Edit"},
    {value: DescriptionTidyView.CHANGES, label: "Show differences"},
    {value: DescriptionTidyView.PROPOSED, label: "Show proposed"}
  ];
  focusedPath: string = null;
  StoredValue = StoredValue;

  focusedPage(): RegistrationPage | null {
    return this.registration?.pages?.find(page => page.path === this.focusedPath) || null;
  }

  onPageFocus(node: SitemapNode): void {
    this.focusedPath = node.key;
  }

  onPageSelection(change: {key: string; selected: boolean}): void {
    if (this.registration) {
      this.applyRegistration({...this.registration, pages: registrationPagesWithSelection(this.registration.pages, change.key, change.selected)});
    }
  }

  onPageMove(change: {key: string; direction: SitemapMoveDirection}): void {
    if (this.registration) {
      this.applyRegistration({...this.registration, pages: registrationPagesMoved(this.registration.pages, change.key, change.direction)});
    }
  }

  pageSuggestionDiff(page: RegistrationPage): string {
    const current = page.sourceTitle || page.title;
    const suggested = page.suggestedTitle || "";
    return suggested && suggested !== current ? `**${current}** → **${suggested}**` : "";
  }

  applySuggestedTitle(page: RegistrationPage): void {
    this.updatePageTitle(page, page.suggestedTitle || page.title);
  }

  keepSourceTitle(page: RegistrationPage): void {
    this.updatePageTitle(page, page.sourceTitle || page.title);
  }

  updatePageTitle(page: RegistrationPage, title: string): void {
    if (this.registration) {
      this.applyRegistration({
        ...this.registration,
        pages: this.registration.pages.map(item => item.path === page.path ? {...item, title} : item)
      });
    }
  }

  private applyRegistration(registration: SiteRegistration): void {
    const pages = registration?.pages || [];
    this.registration = registration ? {...registration, pages} : null;
    this.pageNodes = registrationPageTree(pages);
    this.selectedPageNodes = registrationPageTree(pages.filter(page => page.selected));
  }

  private async refreshProgress(): Promise<void> {
    try {
      const latest = await this.service.current(this.token);
      if (!this.destroyed && this.registration) {
        this.registration = {
          ...this.registration,
          state: latest.state,
          verifiedAt: latest.verifiedAt,
          progress: latest.progress || [],
          error: latest.error,
          siteUrl: latest.siteUrl,
          siteHealth: latest.siteHealth
        };
      }
    } catch (error) {
      this.logger.warn("progress refresh failed", error);
    }
  }

  planEditable(): boolean {
    return !this.registration || (!!this.registration.verifiedAt && this.registration.state === RegistrationState.DRAFT);
  }

  planChanged(plan: RegistrationPlan): void {
    this.plan = plan;
    if (this.registration) {
      this.registration = {...this.registration, plan};
    }
    this.updatePublicQueryParams({[StoredValue.PLAN]: plan});
  }

  areaChanged(area: AvailableArea | null): void {
    const areaCode = area?.areaCode || "";
    this.areaCode = areaCode;
    this.group = null;
    this.groupCode = "";
    this.updatePublicQueryParams({[StoredValue.AREA]: areaCode || null, [StoredValue.GROUP]: null});
    this.refreshDirectoryLogo();
  }

  groupChanged(group: RamblersGroupsApiResponse): void {
    this.group = group;
    this.groupCode = group?.group_code || "";
    this.updatePublicQueryParams({[StoredValue.GROUP]: this.groupCode || null});
    this.refreshDirectoryLogo();
  }

  private restore(registration: SiteRegistration): void {
    this.applyRegistration(registration);
    this.plan = registration.plan;
    this.group = registration.group;
    this.groupCode = registration.group.scope === "G" ? registration.group.group_code : "";
    this.areaCode = registration.group.area_code || registration.group.group_code;
    this.email = registration.email;
    this.activeStep = this.steps.findIndex(step => step.key === registration.currentStep) + 1;
    this.refreshDirectoryLogo();
  }

  private async refreshDirectoryLogo(): Promise<void> {
    const areas = await this.availableAreasService.areas().catch(() => []);
    const areaName = areas.find(area => area.areaCode === this.areaCode)?.areaName || "";
    this.directoryLogo = await this.service.directoryLogo(this.group?.name || areaName, areaName);
  }


  private updatePublicQueryParams(queryParams: StoredValueQueryParameters): void {
    this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: "merge", replaceUrl: true});
  }

  private async refreshDiscoveryProgress(): Promise<void> {
    const current = await this.service.current(this.token).catch(() => null);
    if (this.busy && current?.discoveryProgress) {
      this.discoveryProgress = current.discoveryProgress;
    }
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.message = "";
    try { await action(); } catch (error) {
      const text = this.stringUtils.userErrorMessage(error, "Registration could not be updated.");
      if (text.includes("switched off")) {
        this.registrationOpen = false;
      } else {
        this.message = text;
      }
    }
    finally { this.busy = false; }
  }
}
