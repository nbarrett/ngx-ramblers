import {Component, EventEmitter, Input, OnInit, Output, inject} from "@angular/core";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faAddressCard, faChevronDown, faChevronRight} from "@fortawesome/free-solid-svg-icons";
import {BrandingMode, RecipientMode, RecipientAddressMode, PriorSendExclusion} from "../../models/email-composer.model";
import {Member} from "../../models/member.model";
import {ExternalRecipient} from "../../models/external-recipient.model";
import {MailingListRadiosComponent} from "../../modules/common/mail/mailing-list-radios";
import {MemberMultiSelect} from "../../modules/common/member-multi-select/member-multi-select";
import {RecipientFieldComponent} from "../../modules/common/recipient-field/recipient-field";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerRecipientSourcesService} from "../../services/email-composer/email-composer-recipient-sources.service";
import {EmailComposerRecipientResolutionService} from "../../services/email-composer/email-composer-recipient-resolution.service";
import {EmailComposerRecipientsService} from "../../services/email-composer/email-composer-recipients.service";


@Component({
  selector: "app-email-composer-recipients",
  imports: [FontAwesomeModule, MailingListRadiosComponent, MemberMultiSelect, RecipientFieldComponent],
  styleUrls: ["email-composer-forms.sass"],
  template: `
      <div class="email-composer-section">
        @if (recipients.forcedMemberId) {
          <div class="row mb-3">
            <div class="col-sm-12">
              <p class="mb-0">
                <fa-icon [icon]="faAddressCard" class="me-2"/>
                <strong>Single member</strong> - this email will be sent individually to
                <strong>{{ forcedMemberLabel }}</strong>. To send to more people,
                <button type="button" class="btn btn-link p-0 align-baseline" (click)="clearForced.emit()">choose recipients</button>.
              </p>
            </div>
          </div>
        } @else {
          @if (state.brandingMode !== BrandingMode.UNBRANDED) {
            <fieldset class="email-composer-fieldset">
            <legend>
              <button type="button" class="btn btn-link p-0 text-decoration-none fw-bold text-reset"
                      (click)="recipients.narrowMembersExpanded = !recipients.narrowMembersExpanded"
                      [attr.aria-expanded]="recipients.narrowMembersExpanded">
                <fa-icon [icon]="recipients.narrowMembersExpanded ? faChevronDown : faChevronRight" class="me-1"/>
                Recipient selection
              </button>
            </legend>
            @if (!recipients.narrowMembersExpanded) {
              <button type="button" class="email-composer-fieldset-summary"
                      (click)="recipients.narrowMembersExpanded = true">
                {{ recipients.recipientSelectionSummary() }}
              </button>
            }
            <div [class.d-none]="!recipients.narrowMembersExpanded">
              @if (!recipients.forcedMemberId && !state.notificationConfig) {
                <div class="row mb-3">
                  <div class="col-sm-12">
                    <div class="form-check">
                      <input id="mode-list" type="radio" class="form-check-input" name="recipient-mode"
                             [checked]="state.recipientMode === RecipientMode.ENTIRE_LIST"
                             (change)="recipients.chooseRecipientMode(RecipientMode.ENTIRE_LIST)">
                      <label class="form-check-label" for="mode-list">
                        <strong>A whole mailing list</strong> - sent to everyone on the list
                      </label>
                    </div>
                    <div class="form-check">
                      <input id="mode-selected" type="radio" class="form-check-input" name="recipient-mode"
                             [checked]="state.recipientMode === RecipientMode.SELECTED_MEMBERS"
                             (change)="recipients.chooseRecipientMode(RecipientMode.SELECTED_MEMBERS)">
                      <label class="form-check-label" for="mode-selected">
                        <strong>Specific members</strong> - choose members directly or from a mailing list
                      </label>
                    </div>
                  </div>
                </div>
              }
              @if (state.recipientMode === RecipientMode.ENTIRE_LIST) {
                <label>Choose a list:</label>
                <app-mailing-list-radios
                  [lists]="recipientSources.nonEmptyLists()"
                  [members]="recipientSources.members"
                  groupName="send-list"
                  idPrefix="send-list"
                  [selectedId]="state.selectedListId"
                  (selectedIdChange)="recipients.onSendListIdChange($event)"/>
              } @else {
                <div class="row g-3">
                  <div class="col-12 col-lg-6">
                    <div class="fw-semibold mb-1">Member audience</div>
                    <app-mailing-list-radios
                      [lists]="recipientSources.nonEmptyLists()"
                      [members]="recipientSources.members"
                      [noneSelected]="!state.preFilterKey"
                      groupName="narrow-list"
                      idPrefix="narrow-list"
                      [selectedId]="state.narrowListId"
                      noneLabel="Everyone in the group"
                      listsHeading="Mailing lists"
                      itemClass="ms-3"
                      (selectedIdChange)="recipients.chooseMemberAudience($event)"/>
                  </div>
                  <div class="col-12 col-lg-6">
                    <app-member-multi-select
                      [members]="recipientSources.candidateMembers()"
                      [selectedIds]="state.selectedMemberIds"
                      [preFilterKey]="state.preFilterKey"
                      [notificationConfig]="state.notificationConfig"
                      [memberBulkLoadDateMap]="recipientSources.memberBulkLoadDateMap"
                      [requireConsent]="recipientSources.requiresConsent()"
                      [respectBlocks]="recipientSources.respectsBlocks()"
                      [unsubscribedDates]="recipientSources.unsubscribedMemberDates()"
                      [includeAlreadySent]="includeAlreadySent"
                      [showMemberPicker]="false"
                      (selectedIdsChange)="recipients.onFilteredMemberIdsChange($event)"
                      (preFilterKeyChange)="recipients.onPreFilterKeyChange($event)"
                      (priorSendExclusionsChange)="priorSendExclusionsChange.emit($event)"/>
                  </div>
                </div>
              }
            </div>
            </fieldset>
          }
          @if (state.brandingMode === BrandingMode.UNBRANDED && recipientSources.unbrandedCommitteeLists().length > 0) {
            <fieldset class="email-composer-fieldset">
              <legend>
                <button type="button" class="btn btn-link p-0 text-decoration-none fw-bold text-reset"
                        (click)="recipients.narrowMembersExpanded = !recipients.narrowMembersExpanded"
                        [attr.aria-expanded]="recipients.narrowMembersExpanded">
                  <fa-icon [icon]="recipients.narrowMembersExpanded ? faChevronDown : faChevronRight" class="me-1"/>
                  Choose recipients
                </button>
              </legend>
              @if (!recipients.narrowMembersExpanded) {
                <button type="button" class="email-composer-fieldset-summary"
                        (click)="recipients.narrowMembersExpanded = true">
                  {{ recipientSummary }}. Expand to change.
                </button>
              }
              <div [class.d-none]="!recipients.narrowMembersExpanded">
                <app-mailing-list-radios
                  [lists]="recipientSources.unbrandedCommitteeLists()"
                  [members]="recipientSources.members"
                  groupName="unbranded-recipient-list"
                  idPrefix="unbranded-recipient-list"
                  [selectedId]="recipientResolution.unbrandedSelectedListId()"
                  noneLabel="Select individual members"
                  (selectedIdChange)="recipients.onUnbrandedListIdChange($event)"/>
              </div>
            </fieldset>
          }
          <fieldset class="email-composer-fieldset mt-3">
              <legend>This email is going to</legend>
              <app-recipient-field
                unframed
                [knownOnly]="state.brandingMode !== BrandingMode.UNBRANDED"
                [unavailableReasons]="unavailableReasons"
                [to]="state.externalRecipients" (toChange)="recipients.onUnbrandedToChange($event)"
                [cc]="state.ccRecipients" (ccChange)="recipients.onUnbrandedCcChange($event)"
                [bcc]="state.bccRecipients" (bccChange)="recipients.onUnbrandedBccChange($event)"
                [members]="recipients.unbrandedSuggestionMembers()"
                [knownMembers]="recipientSources.allMembers"
                [committeeAddresses]="state.brandingMode === BrandingMode.UNBRANDED && recipientResolution.unbrandedSelectedListId() ? [] : recipientResolution.committeeRecipientAddresses()"
                [listRecipients]="recipientResolution.unbrandedSelectedListId() ? [] : recipients.unbrandedCommitteeListRecipients()"
                [ccAllowedEmails]="session.inboxReplyContext ? null : recipients.committeeCcEmails()"
                [ccAvailable]="recipients.ccFieldAvailable()"
                [audienceFilter]="state.preFilterKey"
                [memberBulkLoadDateMap]="recipientSources.memberBulkLoadDateMap"
                [savedRecipients]="recipients.unbrandedSuggestionSavedRecipients()"
                [bulkSourceName]="recipients.recipientBulkSourceName()"
                [(saveForReuse)]="recipients.newExternalSaveForReuse"
                (openMember)="openMember.emit($event)"
                (openSavedAddress)="openSavedAddress.emit($event)"
                (addAll)="recipients.addAllFromSelectedList($event)"
                (expandList)="recipients.expandListToken($event.field, $event.recipient)"
                (activeFieldChange)="recipients.onUnbrandedActiveFieldChange($event)"/>
              @if (recipientResolution.committeeRoleSendOffered()) {
                <label class="recipient-save" for="send-to-role-addresses">
                  <input class="form-check-input" type="checkbox" id="send-to-role-addresses"
                         [checked]="state.recipientAddressMode === RecipientAddressMode.COMMITTEE_ROLE"
                         (change)="recipients.onSendToCommitteeRoleAddressesChange($event)">
                  Send to committee role addresses
                </label>
                <small class="text-muted">Everyone on this send is a committee member. Leave this off to use their personal addresses. Turn it on to use each person's committee role address instead.</small>
              }
            </fieldset>
        }
      </div>
  `
})
export class EmailComposerRecipientsComponent implements OnInit {
  protected session = inject(EmailComposerSessionService);
  protected recipientSources = inject(EmailComposerRecipientSourcesService);
  protected recipientResolution = inject(EmailComposerRecipientResolutionService);
  protected recipients = inject(EmailComposerRecipientsService);
  protected readonly BrandingMode = BrandingMode;
  protected readonly RecipientMode = RecipientMode;
  protected readonly RecipientAddressMode = RecipientAddressMode;
  protected readonly faAddressCard = faAddressCard;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  @Input() forcedMemberLabel = "";
  @Input() recipientSummary = "";
  @Input() includeAlreadySent = false;
  @Input() unavailableReasons: Record<string, string> = {};
  @Output() clearForced = new EventEmitter<void>();
  @Output() openMember = new EventEmitter<Member>();
  @Output() openSavedAddress = new EventEmitter<ExternalRecipient>();
  @Output() priorSendExclusionsChange = new EventEmitter<PriorSendExclusion[]>();
  ngOnInit(): void {
    if (this.state.brandingMode === BrandingMode.UNBRANDED) {
      this.recipients.narrowMembersExpanded = true;
    }
  }

  protected get state() {
    return this.session.state;
  }
}
