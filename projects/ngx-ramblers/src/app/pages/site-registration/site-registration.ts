import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, Subscription, timer } from "rxjs";
import { StepperModule } from "primeng/stepper";
import { NgSelectComponent } from "@ng-select/ng-select";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faCircleExclamation, faCopy, faEnvelope, faFloppyDisk, faHammer, faMagnifyingGlass, faRotate } from "@fortawesome/free-solid-svg-icons";
import { PageComponent } from "../../page/page.component";
import { GroupSelector } from "../walks/walk-edit/group-selector";
import { SiteRegistrationService } from "../../services/site-registration.service";
import { UrlService } from "../../services/url.service";
import { REGISTRATION_STEPS, RamblersDirectoryLogo, RegistrationPageAnchor, RegistrationPlan, RegistrationState, RegistrationStep, SiteRegistration } from "../../models/site-registration.model";
import { registrationPageTree } from "../../functions/registration-page-tree";
import { SiteMapViewMode, SitemapNode } from "../../models/sitemap.model";
import { SiteMapViewComponent } from "../../modules/common/site-map/site-map-view";
import { AdminPlatformPath } from "../../models/admin-route-paths.model";
import { RamblersGroupsApiResponse } from "../../models/ramblers-walks-manager";
import { StoredValue } from "../../models/ui-actions";
import { StringUtilsService } from "../../services/string-utils.service";
import { values } from "es-toolkit/compat";

@Component({
  selector: "app-site-registration",
  imports: [FormsModule, RouterLink, StepperModule, NgSelectComponent, FontAwesomeModule, PageComponent, GroupSelector, SiteMapViewComponent],
  template: `
    <app-page pageTitle="Register your group">
      <p>Create a free review site from your group's own public pages, photos and current Walks Manager programme. Your existing website is not changed, and your group decides whether to continue after reviewing the result. <a routerLink="/how-to/group-registration" target="_blank" rel="noopener noreferrer">Where to find group registration</a>.</p>
      @if (registrationOpen === false) {
        <div class="alert alert-warning d-flex align-items-start"><fa-icon [icon]="faCircleExclamation" class="me-2"/><div>
          <strong>Group registration is switched off</strong>
          <p>Turn it on under <a [routerLink]="'/' + registrationsPath" [fragment]="Anchor.PUBLIC_REGISTRATION" target="_blank" rel="noopener noreferrer">Group registrations</a>.</p>
        </div></div>
      } @else if (message) {
        <div class="alert alert-warning d-flex align-items-start"><fa-icon [icon]="faCircleExclamation" class="me-2"/><div><strong>Registration update</strong><p>{{message}}</p></div></div>
      }
      @if (token) {
        <div class="thumbnail-heading-frame mb-3"><div class="thumbnail-heading">Return to this registration</div>
          <p>Keep this private link. It restores your saved answers.</p>
          <input class="form-control" readonly [value]="resumeUrl" aria-label="Private return link"/>
          <button class="btn btn-quiet mt-2" (click)="copyLink()"><fa-icon [icon]="icons.copy" class="me-2"/>Copy return link</button>
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
                  <p class="guidance"><strong>Lite</strong> provides email and membership tools with a reduced public site. It does not import your existing website.</p>
                  <p class="guidance"><strong>Full</strong> includes every discovered page and photo from the group's current website. Walks come from Walks Manager, not from the old site.</p>
                  <div class="form-check form-check-inline">
                    <input id="registration-plan-lite" class="form-check-input" type="radio" name="plan" [value]="Plan.LITE" [(ngModel)]="plan" (ngModelChange)="planChanged($event)" [disabled]="!!registration"/>
                    <label class="form-check-label" for="registration-plan-lite">Lite</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input id="registration-plan-full" class="form-check-input" type="radio" name="plan" [value]="Plan.FULL" [(ngModel)]="plan" (ngModelChange)="planChanged($event)" [disabled]="!!registration"/>
                    <label class="form-check-label" for="registration-plan-full">Full</label>
                  </div>
                  <p><a routerLink="/how-to/group-registration/lite" target="_blank" rel="noopener noreferrer">What Lite includes</a> · <a routerLink="/how-to/group-registration/full" target="_blank" rel="noopener noreferrer">Choosing pages for a Full site</a> · <a routerLink="/how-to/group-registration/after-submission" target="_blank" rel="noopener noreferrer">What happens after you confirm</a></p>
                }
                @case (Step.GROUP) {
                  <p class="guidance">Choose your Ramblers area, then your group from the existing Ramblers directory.</p>
                  <label for="registration-area">Area</label>
                  <ng-select id="registration-area" [items]="areas" bindLabel="areaName" bindValue="areaCode" [(ngModel)]="areaCode" (ngModelChange)="areaChanged($event)" [disabled]="!!registration"/>
                  <app-group-selector label="Group" [areaCode]="areaCode" [groupCode]="groupCode" [disabled]="!!registration" (groupChanged)="groupChanged($event)"/>
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
                  <button class="btn btn-primary mt-2" [disabled]="busy || !email || !group" (click)="start()"><fa-icon [icon]="icons.email" class="me-2"/>Send confirmation email</button>
                }
                @case (Step.CONTENT) {
                  @if (registration) {
                    <p class="guidance">About Us and Contact Us always sit on the navbar, with Home, Walks, Events, Photos, Information and Admin. Walks and Events take a place when the group has them. Nothing else sits on the bar.</p>
                    <label for="registration-website">Current website</label>
                    <input id="registration-website" type="url" class="form-control" [(ngModel)]="registration.website"/>
                    <button class="btn btn-primary my-2" [disabled]="busy" (click)="discover()"><fa-icon [icon]="icons.search" class="me-2"/>Find pages</button>
                    <app-site-map-view [roots]="pageTree()" [viewMode]="SiteMapViewMode.TREE" [treeDepth]="99" showFilter showPreview emptyMessage="Find pages to see the content that will be copied to the new site."/>
                    <p><a routerLink="/how-to/group-registration/full" target="_blank" rel="noopener noreferrer">Choosing pages for a Full site</a></p>
                  }
                }
                @case (Step.REVIEW) {
                  <p class="guidance">Confirm your choices to queue provisioning. The platform administrator will review the site before sending your group an invitation.</p>
                  <p><strong>{{registration?.group?.name}}</strong> — {{registration?.plan}}</p>
                  <app-site-map-view [roots]="pageTree()" [viewMode]="SiteMapViewMode.TREE" [treeDepth]="99" showFilter showPreview emptyMessage="No source pages have been discovered yet."/>
                  <button class="btn btn-primary" [disabled]="busy" (click)="submit()"><fa-icon [icon]="icons.build" class="me-2"/>Confirm and build site</button>
                }
                @case (Step.PROGRESS) {
                  <p>Status: <strong>{{registration?.state}}</strong></p>
                  @if (registration?.error) { <p>{{registration.error}}</p> }
                  @for (item of registration?.progress || []; track $index) { <p>{{item.step}}: {{item.status}} {{item.message}}</p> }
                  <button class="btn btn-quiet" [disabled]="busy" (click)="refresh()"><fa-icon [icon]="icons.refresh" class="me-2"/>Refresh status</button>
                }
              }
              <div class="stepper-nav mt-3">
                <button class="btn btn-quiet me-2" [disabled]="busy || index === 0" (click)="goToStep(index - 1)"><fa-icon [icon]="icons.back" class="me-2"/>Back</button>
                @if (index < 4) { <button class="btn btn-primary" [disabled]="busy || !canAccessStep(steps[nextStep(index)].key)" (click)="goToStep(nextStep(index))"><fa-icon [icon]="icons.save" class="me-2"/>Save and next</button> }
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
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stringUtils = inject(StringUtilsService);
  private subscriptions: Subscription[] = [];
  protected readonly Step = RegistrationStep;
  protected readonly Plan = RegistrationPlan;
  protected readonly Anchor = RegistrationPageAnchor;
  protected readonly registrationsPath = AdminPlatformPath.ENVIRONMENT_MANAGEMENT_REGISTRATIONS;
  protected readonly faCircleExclamation = faCircleExclamation;
  readonly icons = {copy: faCopy, email: faEnvelope, search: faMagnifyingGlass, build: faHammer, refresh: faRotate, back: faArrowLeft, save: faFloppyDisk};
  readonly SiteMapViewMode = SiteMapViewMode;
  readonly steps = REGISTRATION_STEPS;
  plan = RegistrationPlan.LITE;
  areaCode = "";
  groupCode = "";
  group: RamblersGroupsApiResponse = null;
  email = "";
  areas: {areaCode: string; areaName: string}[] = [];
  registration: SiteRegistration = null;
  token = "";
  resumeUrl = "";
  message = "";
  registrationOpen: boolean = null;
  busy = false;
  activeStep = 1;
  directoryLogo: RamblersDirectoryLogo = null;

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
      this.areas = (await firstValueFrom(this.http.get<{areas: {areaCode: string; areaName: string}[]}>("api/areas/available-areas"))).areas;
      await this.refreshDirectoryLogo();
    });
    this.subscriptions.push(timer(10000, 10000).subscribe(() => {
      if (this.token && !this.busy && this.registration?.state !== RegistrationState.DRAFT) {
        this.refresh();
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  canAccessStep(step: RegistrationStep): boolean {
    const draft = !this.registration || this.registration.state === RegistrationState.DRAFT;
    if (step === RegistrationStep.PLAN) {
      return draft;
    } else if (step === RegistrationStep.GROUP) {
      return draft && !!this.plan;
    } else if (step === RegistrationStep.EMAIL) {
      return !!this.group && (!this.registration || this.registration.state === RegistrationState.AWAITING_EMAIL);
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
    if (this.canAccessStep(this.steps[index].key)) {
      await this.perform(async () => {
        if (this.registration?.state === RegistrationState.DRAFT) {
          this.registration.currentStep = this.steps[index].key;
          this.registration = await this.service.save(this.token, this.registration);
        }
        this.activeStep = index + 1;
        await this.router.navigate([], {relativeTo: this.route, queryParams: {[StoredValue.STEP]: this.steps[index].key}, queryParamsHandling: "merge"});
      });
    }
  }

  async start(): Promise<void> {
    await this.perform(async () => {
      const result = await this.service.start({email: this.email, groupCode: this.group.group_code, plan: this.plan});
      this.message = result.message;
      if (result.resumeToken) {
        this.token = result.resumeToken;
        this.resumeUrl = `${window.location.origin}/register/${this.token}`;
        this.registration = await this.service.current(this.token);
      }
    });
  }

  async discover(): Promise<void> {
    await this.perform(async () => {
      this.registration = await this.service.save(this.token, this.shapeRegistration(this.registration));
      this.registration = this.shapeRegistration(await this.service.discover(this.token));
    });
  }

  async submit(): Promise<void> {
    await this.perform(async () => {
      this.registration = await this.service.save(this.token, this.shapeRegistration(this.registration));
      this.restore(await this.service.submit(this.token));
    });
  }

  async refresh(): Promise<void> {
    await this.perform(async () => this.restore(await this.service.current(this.token)));
  }

  async copyLink(): Promise<void> {
    await this.perform(async () => { await navigator.clipboard.writeText(this.resumeUrl); this.message = "Return link copied."; });
  }

  pageTree(): SitemapNode[] {
    return this.registration?.pages ? registrationPageTree(this.shapeRegistration(this.registration).pages) : [];
  }

  private shapeRegistration(registration: SiteRegistration): SiteRegistration {
    return {...registration, pages: registration.pages || []};
  }

  planChanged(plan: RegistrationPlan): void {
    this.plan = plan;
    this.updatePublicQueryParams({[StoredValue.PLAN]: plan});
  }

  areaChanged(areaCode: string): void {
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
    this.registration = this.shapeRegistration(registration);
    this.plan = registration.plan;
    this.group = registration.group;
    this.groupCode = registration.group.group_code;
    this.areaCode = registration.group.area_code;
    this.email = registration.email;
    this.activeStep = this.steps.findIndex(step => step.key === registration.currentStep) + 1;
    this.refreshDirectoryLogo();
  }

  private areaName(): string {
    return this.areas.find(area => area.areaCode === this.areaCode)?.areaName || "";
  }

  private async refreshDirectoryLogo(): Promise<void> {
    this.directoryLogo = await this.service.directoryLogo(this.group?.name || "", this.areaName());
  }

  private updatePublicQueryParams(queryParams: {[key: string]: string}): void {
    this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: "merge", replaceUrl: true});
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
