import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { LowerCasePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faEnvelope, faReply } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  VolunteerAudience,
  VolunteerAudienceCriteria,
  VolunteerAudienceLaunch,
  VolunteerAudienceType,
  VolunteerLetterType,
  VolunteerParish
} from "../../../models/volunteer-management.model";
import { volunteerAudienceTitle } from "../../../functions/volunteer-audiences";
import { volunteerLetterSeeds } from "../../../functions/volunteer-letters";
import { uniq, values } from "es-toolkit/compat";
import { EmailCompositionsService } from "../../../services/email-composer/email-compositions.service";
import { EmailComposerContextSource, EmailComposition, EmailCompositionStatus } from "../../../models/email-composer.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-volunteer-audience-view",
  imports: [FormsModule, FontAwesomeModule, LowerCasePipe],
  template: `
    <div class="audience-workspace">
      <div class="audience-controls">
        <label>Audience
          <select class="form-select" [ngModel]="criteria.audienceType" (ngModelChange)="update({audienceType: $event})" aria-label="Choose an audience">
            @for (type of audienceTypes; track type) {
              <option [ngValue]="type">{{ titleFor(type) }}</option>
            }
          </select>
        </label>
        <label>Authority
          <select class="form-select" [ngModel]="criteria.localAuthorityCode" (ngModelChange)="update({localAuthorityCode: $event})" aria-label="Limit to a local authority">
            <option [ngValue]="null">All authorities</option>
            @for (code of authorityCodes; track code) {
              <option [ngValue]="code">{{ authorityName(code) }}</option>
            }
          </select>
        </label>
        <label>Sector
          <select class="form-select" [ngModel]="criteria.sectorCode" (ngModelChange)="update({sectorCode: $event})" aria-label="Limit to a sector">
            <option [ngValue]="null">All sectors</option>
            @for (code of sectorCodes; track code) {
              <option [ngValue]="code">{{ code }}</option>
            }
          </select>
        </label>
        <label>Rights-of-way group
          <select class="form-select" [ngModel]="criteria.rightsOfWayGroupCode" (ngModelChange)="update({rightsOfWayGroupCode: $event})" aria-label="Limit to a rights-of-way group">
            <option [ngValue]="null">All groups</option>
            @for (code of rightsOfWayGroupCodes; track code) {
              <option [ngValue]="code">{{ code }}</option>
            }
          </select>
        </label>
      </div>

      <div class="audience-summary">
        <div class="audience-counts">
          <div class="count-card"><span>{{ audience.supporterIds.length }}</span><small>Volunteers</small></div>
          <div class="count-card"><span>{{ audience.externalRecipients.length }}</span><small>Organisation contacts</small></div>
          <div class="count-card"><span>{{ excludedTotal }}</span><small>Left out</small></div>
        </div>
        <div class="compose-controls">
          <label>Start from
            <select class="form-select" [(ngModel)]="selectedLetterType" aria-label="Choose a starting template">
              <option [ngValue]="null">Blank email</option>
              @for (seed of letterSeeds; track seed.letterType) {
                <option [ngValue]="seed.letterType">{{ seed.title }}</option>
              }
            </select>
          </label>
          <button type="button" class="btn btn-primary text-nowrap" (click)="launch.emit({criteria, letterType: selectedLetterType})" [disabled]="totalRecipients === 0">
            <fa-icon [icon]="faEnvelope"/> Open in Email Composer
          </button>
        </div>
      </div>
      @if (selectedLetterDescription) {
        <p class="letter-description">{{ selectedLetterDescription }} Each recipient receives their own parishes and counterpart officers through merge fields.</p>
      }

      @if (audience.externalRecipients.length > 0) {
        <div class="recipient-list">
          <strong>Organisation contacts included</strong>
          <ul class="mb-0 mt-2">
            @for (recipient of audience.externalRecipients; track recipient.email) {
              <li>{{ recipient.name }} ({{ recipient.email }})</li>
            }
          </ul>
        </div>
      }

      @if (audience.excluded.length > 0) {
        <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong>{{ excludedTotal }} left out of this audience</strong>
            <div>These will not receive the email. Consent, blocked addresses and unsubscribes are applied separately by the Email Composer when it sends.</div>
            <ul class="mb-0 mt-2">
              @for (exclusion of audience.excluded; track exclusion.reason) {
                <li><strong>{{ exclusion.count }}</strong> {{ exclusion.reason | lowercase }}@if (exclusion.names.length > 0) { <span class="exclusion-names">&nbsp;({{ exclusion.names.join(", ") }}{{ exclusion.count > exclusion.names.length ? " and others" : "" }})</span> }</li>
              }
            </ul>
          </div>
        </div>
      }

      @if (correspondence.length > 0) {
        <div class="recipient-list">
          <strong>Previous correspondence</strong>
          <table class="table mb-0 mt-2">
            <thead><tr><th>Sent</th><th>Title</th><th>Recipients</th><th></th></tr></thead>
            <tbody>
              @for (composition of correspondence; track composition.id) {
                <tr>
                  <td>{{ sentAtDisplay(composition) }}</td>
                  <td>{{ composition.title }}</td>
                  <td>{{ composition.sentRecipientCount ?? "" }}</td>
                  <td class="text-end">
                    <button type="button" class="btn btn-quiet btn-sm text-nowrap" (click)="followUp.emit(composition.id)">
                      <fa-icon [icon]="faReply"/> Follow up
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host
      display: flex
      flex-direction: column
      min-height: 0
    .audience-workspace
      display: flex
      flex-direction: column
      gap: var(--space-3)
      min-height: 0
      overflow-y: auto
    .exclusion-names
      color: var(--rsm-muted)
    .audience-controls
      display: grid
      grid-template-columns: repeat(4, minmax(0, 1fr))
      gap: var(--space-3)
    .audience-controls label
      display: grid
      gap: var(--space-2)
      font-weight: 600
    .audience-summary
      display: flex
      align-items: end
      justify-content: space-between
      gap: var(--space-3)
      flex-wrap: wrap
    .audience-counts
      display: flex
      gap: var(--space-3)
      flex-wrap: wrap
    .count-card
      min-width: 140px
      padding: var(--space-4)
      background: var(--rsm-panel-bg)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid #9bc8ab
      border-radius: var(--rsm-panel-radius)
    .count-card span
      display: block
      font-size: 2rem
      font-weight: 700
      line-height: 1
      margin-bottom: var(--space-2)
    .count-card small
      color: var(--rsm-muted)
      font-weight: 600
    .recipient-list
      padding: var(--space-4)
      border: 1px solid var(--rsm-border)
      border-radius: var(--rsm-panel-radius)
    .compose-controls
      display: flex
      align-items: end
      gap: var(--space-3)
    .compose-controls label
      display: grid
      gap: var(--space-2)
      font-weight: 600
      min-width: 220px
    .letter-description
      margin: 0
      color: var(--rsm-muted)
    @media (max-width: 991.98px)
      .audience-controls
        grid-template-columns: repeat(2, minmax(0, 1fr))
    @media (max-width: 767.98px)
      .audience-controls
        grid-template-columns: 1fr
      .audience-summary .btn
        width: 100%
      .compose-controls
        flex-direction: column
        align-items: stretch
        width: 100%
      .compose-controls label
        min-width: 0
  `]
})
export class VolunteerAudienceView implements OnInit {
  private compositionsService = inject(EmailCompositionsService);
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("VolunteerAudienceView", NgxLoggerLevel.ERROR);
  protected readonly faEnvelope = faEnvelope;
  protected readonly faReply = faReply;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly audienceTypes = values(VolunteerAudienceType);
  protected readonly letterSeeds = volunteerLetterSeeds();

  @Input() audience: VolunteerAudience;
  @Input() criteria: VolunteerAudienceCriteria;
  @Input() parishes: VolunteerParish[] = [];

  @Output() criteriaChange = new EventEmitter<VolunteerAudienceCriteria>();
  @Output() launch = new EventEmitter<VolunteerAudienceLaunch>();
  @Output() followUp = new EventEmitter<string>();

  protected selectedLetterType: VolunteerLetterType | null = null;
  protected correspondence: EmailComposition[] = [];

  ngOnInit(): void {
    this.compositionsService.list(EmailCompositionStatus.Sent)
      .then(sent => {
        this.correspondence = sent
          .filter(composition => composition.state?.context?.source === EmailComposerContextSource.VOLUNTEER)
          .sort((first, second) => (second.sentAt ?? 0) - (first.sentAt ?? 0));
      })
      .catch(error => this.logger.error("Failed to load volunteer correspondence", error));
  }

  protected get selectedLetterDescription(): string {
    return this.letterSeeds.find(seed => seed.letterType === this.selectedLetterType)?.description ?? "";
  }

  protected sentAtDisplay(composition: EmailComposition): string {
    return composition.sentAt ? this.dateUtils.displayDateAndTime(composition.sentAt) : "";
  }

  protected get excludedTotal(): number {
    return (this.audience?.excluded ?? []).reduce((total, exclusion) => total + exclusion.count, 0);
  }

  protected get totalRecipients(): number {
    return (this.audience?.supporterIds.length ?? 0) + (this.audience?.externalRecipients.length ?? 0);
  }

  protected get authorityCodes(): string[] {
    return uniq(this.parishes.map(parish => parish.localAuthorityCode).filter(code => code)).sort();
  }

  protected get sectorCodes(): string[] {
    return uniq(this.parishes.map(parish => parish.sectorCode).filter(code => code)).sort();
  }

  protected get rightsOfWayGroupCodes(): string[] {
    return uniq(this.parishes.map(parish => parish.rightsOfWayGroupCode).filter(code => code)).sort();
  }

  protected authorityName(localAuthorityCode: string): string {
    return this.parishes.find(parish => parish.localAuthorityCode === localAuthorityCode)?.localAuthorityName ?? localAuthorityCode;
  }

  protected titleFor(audienceType: VolunteerAudienceType): string {
    return volunteerAudienceTitle(audienceType);
  }

  protected update(changes: Partial<VolunteerAudienceCriteria>): void {
    this.criteriaChange.emit({...this.criteria, ...changes});
  }
}
