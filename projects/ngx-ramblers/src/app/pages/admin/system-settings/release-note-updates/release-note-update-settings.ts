import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation, faFloppyDisk, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgSelectModule } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { defaultReleaseNoteUpdateConfiguration, defaultReleaseNoteUpdateDefaults, defaultReleaseNoteUpdateProfile } from "../../../../functions/email-composer";
import {
  ReleaseNoteUpdateCoverage,
  ReleaseNoteUpdateCategory,
  ReleaseNoteUpdateConfiguration,
  ReleaseNoteUpdateDefaults,
  RecipientMode,
  ReleaseNoteUpdateOption,
  ReleaseNoteUpdateProfile
} from "../../../../models/email-composer.model";
import { ReleaseNoteUpdateConfigService } from "../../../../services/email-composer/release-note-update-config.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { RANGE_UNIT_OPTIONS } from "../../../../models/search.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { firstValueFrom } from "rxjs";
import { ListInfo } from "../../../../models/mail.model";

@Component({
  selector: "app-release-note-update-settings",
  template: `
    <div class="thumbnail-heading-frame">
      <div class="thumbnail-heading">Release note update defaults</div>
      <p>These defaults control release-note updates created in Email Composer. They can be changed here without rebuilding or redeploying the website. The composer still lets the sender choose the scope and coverage for an individual update.</p>
      @if (saveSucceeded) {
        <div class="alert alert-success d-flex align-items-start">
          <fa-icon [icon]="faCircleCheck" class="me-2 mt-1 flex-shrink-0"/>
          <div><strong class="d-block">Defaults saved</strong>Future release note updates will start with these settings.</div>
        </div>
      } @else if (saveFailed) {
        <div class="alert alert-danger d-flex align-items-start">
          <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1 flex-shrink-0"/>
          <div><strong class="d-block">Defaults not saved</strong>{{ errorMessage }}</div>
        </div>
      }
      <fieldset [disabled]="loading || saving">
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="release-note-update-profile">Saved configuration</label>
            <ng-select id="release-note-update-profile" [items]="configuration.profiles" bindLabel="name" bindValue="id"
                       [clearable]="false" [searchable]="false" [ngModel]="selectedProfileId" (ngModelChange)="selectProfile($event)"/>
          </div>
          <div class="col-md-6 mt-3 mt-md-0 d-flex align-items-end gap-2">
            <button type="button" class="btn btn-primary" (click)="newProfile()">New configuration</button>
            @if (configuration.profiles.length > 1) {
              @if (deletePending) {
                <button type="button" class="btn btn-danger" (click)="deleteProfile()">Confirm delete</button>
                <button type="button" class="btn btn-quiet" (click)="deletePending = false">Cancel</button>
              } @else {
                <button type="button" class="btn btn-danger" (click)="deletePending = true">Delete</button>
              }
            }
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="release-note-update-audience">Default audience</label>
            <ng-select id="release-note-update-audience" [items]="recipientModeOptions" bindLabel="label" bindValue="value"
                       [clearable]="false" [searchable]="false" [(ngModel)]="selectedProfile.recipientMode"/>
          </div>
          @if (selectedProfile.recipientMode === RecipientMode.ENTIRE_LIST) {
            <div class="col-md-6 mt-3 mt-md-0">
              <label for="release-note-update-list">Mailing list</label>
              <ng-select id="release-note-update-list" [items]="mailingLists" bindLabel="name" bindValue="id"
                         [clearable]="false" [searchable]="true" [(ngModel)]="selectedProfile.selectedListId"/>
            </div>
          }
        </div>
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="release-note-update-profile-name">Configuration name</label>
            <input id="release-note-update-profile-name" class="form-control" type="text" [(ngModel)]="selectedProfile.name">
          </div>
          <div class="col-md-6 mt-3 mt-md-0 d-flex align-items-end">
            <div class="form-check">
              <input id="release-note-update-default-profile" class="form-check-input" type="checkbox"
                     [checked]="configuration.defaultProfileId === selectedProfile.id" (change)="makeDefault()">
              <label for="release-note-update-default-profile" class="form-check-label">Use as the default when creating an update</label>
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="release-note-update-period-amount">Report on information from the last</label>
            <input id="release-note-update-period-amount" class="form-control" type="number" min="1" [(ngModel)]="selectedProfile.periodAmount">
          </div>
          <div class="col-md-6 mt-3 mt-md-0">
            <label for="release-note-update-period-unit">Unit</label>
            <ng-select id="release-note-update-period-unit" [items]="periodUnitOptions" bindLabel="label" bindValue="value"
                       [clearable]="false" [searchable]="false" [(ngModel)]="selectedProfile.periodUnit"/>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-md-6">
            <div class="mb-1">Default content</div>
            @for (option of categoryOptions; track option.value) {
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" [id]="'release-note-update-default-category-' + option.value"
                       [disabled]="categoryIsLastSelected(option.value)"
                       [ngModel]="settings.categories.includes(option.value)"
                       (ngModelChange)="setCategory(option.value, $event)">
                <label class="form-check-label" [for]="'release-note-update-default-category-' + option.value">
                  <strong>{{ option.label }}</strong>
                  <span class="d-block text-muted small">{{ option.hint }}</span>
                </label>
              </div>
            }
          </div>
          <div class="col-md-6 mt-3 mt-md-0">
            <label for="release-note-update-default-coverage">Default coverage</label>
            <ng-select id="release-note-update-default-coverage" [items]="coverageOptions" bindLabel="label" bindValue="value"
                       [clearable]="false" [searchable]="false" [(ngModel)]="settings.coverage"/>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="release-note-update-maximum-themes">Maximum broad subjects</label>
            <input id="release-note-update-maximum-themes" class="form-control" type="number" min="1" max="20" [(ngModel)]="settings.maximumThemes">
          </div>
          <div class="col-md-6 mt-3 mt-md-0">
            <label for="release-note-update-maximum-sources">Maximum related notes per subject</label>
            <input id="release-note-update-maximum-sources" class="form-control" type="number" min="1" max="30" [(ngModel)]="settings.maximumSourcesPerTheme">
          </div>
        </div>
        <div class="mb-3">
          <div class="form-check mb-3">
            <input id="release-note-update-include-technical" class="form-check-input" type="checkbox" [(ngModel)]="settings.includeTechnicalChanges">
            <label for="release-note-update-include-technical" class="form-check-label">
              <strong>Include technical changes</strong>
              <span class="d-block text-muted small">Leave this off to exclude infrastructure, maintenance and internal engineering. Even when enabled, technical work is included only when it has a clear practical consequence for users.</span>
            </label>
          </div>
          <div class="form-check mb-3">
            <input id="release-note-update-include-images" class="form-check-input" type="checkbox" [(ngModel)]="settings.includeImages">
            <label for="release-note-update-include-images" class="form-check-label">
              <strong>Include suitable release-note images</strong>
              <span class="d-block text-muted small">Add a relevant image to a subject when one is available in its supporting release notes.</span>
            </label>
          </div>
          <label for="release-note-update-writing-rules">Writing rules</label>
          <textarea id="release-note-update-writing-rules" class="form-control" rows="7" [(ngModel)]="settings.writingRules"></textarea>
          <div class="text-muted small mt-1">JSON formatting and factual safeguards are fixed. The editorial wording above is sent with each drafting request.</div>
        </div>
        <button type="button" class="btn btn-primary" [disabled]="loading || saving" (click)="save()">
          @if (saving) {
            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/>
          } @else {
            <fa-icon [icon]="faFloppyDisk" class="me-1"/>
          }
          {{ saving ? "Saving…" : "Save defaults" }}
        </button>
      </fieldset>
    </div>
  `,
  imports: [FormsModule, FontAwesomeModule, NgSelectModule]
})
export class ReleaseNoteUpdateSettings implements OnInit {

  private configService = inject(ReleaseNoteUpdateConfigService);
  private mailMessagingService = inject(MailMessagingService);
  private logger: Logger = inject(LoggerFactory).createLogger("ReleaseNoteUpdateSettings", NgxLoggerLevel.ERROR);
  protected settings: ReleaseNoteUpdateDefaults = defaultReleaseNoteUpdateDefaults();
  protected configuration: ReleaseNoteUpdateConfiguration = defaultReleaseNoteUpdateConfiguration();
  protected selectedProfile: ReleaseNoteUpdateProfile = defaultReleaseNoteUpdateProfile();
  protected selectedProfileId = this.selectedProfile.id;
  protected deletePending = false;
  protected mailingLists: ListInfo[] = [];
  protected loading = true;
  protected saving = false;
  protected saveSucceeded = false;
  protected saveFailed = false;
  protected errorMessage = "";
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faFloppyDisk = faFloppyDisk;
  protected readonly faSpinner = faSpinner;
  protected readonly categoryOptions: ReleaseNoteUpdateOption<ReleaseNoteUpdateCategory>[] = [
    {value: ReleaseNoteUpdateCategory.EMAIL, label: "Email features", hint: "Inbox, newsletters, subscriptions, sending, delivery and member communications."},
    {value: ReleaseNoteUpdateCategory.NON_EMAIL, label: "Non-email features", hint: "Walks, events, website content, maps, images and social media."},
    {value: ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT, label: "Platform management", hint: "Managing websites, environments, setup and administration across NGX."}
  ];
  protected readonly coverageOptions: ReleaseNoteUpdateOption<ReleaseNoteUpdateCoverage>[] = [
    {value: ReleaseNoteUpdateCoverage.COMPREHENSIVE, label: "Comprehensive", hint: "Cover all material consumer-facing capabilities."},
    {value: ReleaseNoteUpdateCoverage.HIGHLIGHTS, label: "Highlights only", hint: "Choose the changes with the greatest user impact."}
  ];
  protected readonly periodUnitOptions = RANGE_UNIT_OPTIONS;
  protected readonly RecipientMode = RecipientMode;
  protected readonly recipientModeOptions = [
    {value: RecipientMode.SELECTED_MEMBERS, label: "Committee members"},
    {value: RecipientMode.ENTIRE_LIST, label: "A whole mailing list"}
  ];

  protected selectProfile(profileId: string): void {
    const selected = this.configuration.profiles.find(profile => profile.id === profileId);
    if (selected) {
      this.selectedProfileId = selected.id;
      this.selectedProfile = selected;
      this.settings = selected.defaults;
      this.deletePending = false;
    }
  }

  protected newProfile(): void {
    const profile = {...defaultReleaseNoteUpdateProfile(), id: crypto.randomUUID(), name: "New update configuration"};
    this.configuration.profiles = this.configuration.profiles.concat([profile]);
    this.selectProfile(profile.id);
  }

  protected makeDefault(): void {
    this.configuration.defaultProfileId = this.selectedProfile.id;
  }

  protected deleteProfile(): void {
    this.configuration.profiles = this.configuration.profiles.filter(profile => profile.id !== this.selectedProfile.id);
    if (this.configuration.defaultProfileId === this.selectedProfile.id) {
      this.configuration.defaultProfileId = this.configuration.profiles[0].id;
    }
    this.selectProfile(this.configuration.defaultProfileId);
  }

  protected categoryIsLastSelected(category: ReleaseNoteUpdateCategory): boolean {
    return this.settings.categories.length === 1 && this.settings.categories.includes(category);
  }

  protected setCategory(category: ReleaseNoteUpdateCategory, selected: boolean): void {
    this.settings.categories = selected
      ? this.settings.categories.includes(category) ? this.settings.categories : this.settings.categories.concat(category)
      : this.settings.categories.filter(candidate => candidate !== category);
  }

  async ngOnInit(): Promise<void> {
    try {
      const [configuration, mailMessagingConfig] = await Promise.all([
        this.configService.loadConfiguration(),
        firstValueFrom(this.mailMessagingService.events())
      ]);
      this.configuration = configuration;
      this.mailingLists = mailMessagingConfig.brevo?.lists?.lists ?? [];
      this.selectProfile(this.configuration.defaultProfileId);
    } catch (error) {
      this.logger.error("load failed", error);
      this.saveFailed = true;
      this.errorMessage = String(error);
    } finally {
      this.loading = false;
    }
  }

  protected async save(): Promise<void> {
    this.saving = true;
    this.saveSucceeded = false;
    this.saveFailed = false;
    try {
      this.selectedProfile.defaults = this.settings;
      this.configuration = await this.configService.saveConfiguration(this.configuration);
      this.selectProfile(this.selectedProfileId);
      this.saveSucceeded = true;
    } catch (error) {
      this.logger.error("save failed", error);
      this.saveFailed = true;
      this.errorMessage = String(error);
    } finally {
      this.saving = false;
    }
  }
}

export default ReleaseNoteUpdateSettings;
