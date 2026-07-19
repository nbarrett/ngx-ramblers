import { Confirm } from "../../../../models/ui-actions";
import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { BroadcastService } from "../../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { ListInfo, ListSetting, ListUpdateRequest, MailMessagingConfig } from "../../../../models/mail.model";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { MailService } from "projects/ngx-ramblers/src/app/services/mail/mail.service";
import { MailListEditorComponent } from "./list-editor";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { ListSubscriberCountComponent } from "../../../../modules/common/mail/list-subscriber-count";
import { ListSubscriberService } from "../../../../services/mail/list-subscriber.service";
import { MailListUpdaterService } from "../../../../services/mail/mail-list-updater.service";
import { MailConfigService } from "../../../../services/mail/mail-config.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { RetrospectiveApplyPreview } from "../../../../models/mail-list-subscription.model";
import { Member } from "../../../../models/member.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { faSpinner, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { AlertTarget } from "../../../../models/alert-target.model";

@Component({
    selector: "app-mail-list-settings",
    template: `
      @if (mailMessagingConfig?.brevo?.lists?.lists) {
        <hr/>
        <div class="row mt-3">
          <div class="col">
            @if (!listUpdateRequest) {
              <h5>{{ mailMessagingConfig?.brevo?.lists?.lists.indexOf(list) + 1 }}: {{ list.name }}</h5>
              <div class="list-subscriber-summary">
                <app-list-subscriber-count [list]="list" [members]="members"/>
                @if (subscriberCountsDiffer()) {
                  <span class="ms-2 brevo-subscriber-count">Brevo: {{ list.uniqueSubscribers }}</span>
                  <fa-icon class="ms-2 list-sync-warning" [icon]="faTriangleExclamation"
                           [tooltip]="syncTooltip()" containerClass="list-sync-warning-tooltip" placement="right"/>
                }
              </div>
            }
            @if (listUpdateRequest) {
              <app-list-editor [listCreateRequest]="listUpdateRequest"/>
              <app-brevo-button button title="Save" (click)="saveEdit()"/>
              <app-brevo-button button class="ms-2" title="Cancel" (click)="cancelEdit()"/>
            }
          </div>
          <div class="col-auto">
            <div class="float-end">
              @if (confirm.noneOutstanding()) {
                <div>
                  @if (!listUpdateRequest) {
                    <app-brevo-button button title="Edit"
                                      (click)="beginEdit()"/>
                  }
                  <app-brevo-button class="ms-2" button title="View"
                                    (click)="viewList(list.id)"
                                    [disabled]="listEditOrDeleteDisabled()"/>
                  <app-brevo-button class="ms-2" button [title]="'Delete'"
                                    (click)="deleteList(list.id)"
                                    [disabled]="listEditOrDeleteDisabled()"/>
                </div>
              }
              @if (confirm.deleteConfirmOutstanding()) {
                <app-brevo-button button [title]="'Confirm'"
                                  (click)="confirmDeleteList(list.id)"
                                  [disabled]="listEditOrDeleteDisabled()"/>
                <app-brevo-button class="ms-2" button [title]="'Cancel'"
                                  (click)="cancelDelete()"
                                  [disabled]="listEditOrDeleteDisabled()"/>
              }
            </div>
          </div>
        </div>
        <div class="row mt-3">
          <div class="col">
            <div class="form-check">
              <input [checked]="autoSubscribeNewMembers()"
                     (change)="autoSubscribeNewMembersChange()"
                     type="checkbox" class="form-check-input" id="auto-subscribe-new-members-{{list.id}}"> <label
              class="custom-control-label"
              for="auto-subscribe-new-members-{{list.id}}">Auto-subscribe new members
            </label>
            </div>
          </div>
          <div class="col">
            <div class="form-check">
              <input [checked]="requiresMemberEmailMarketingConsent()"
                     (change)="requiresMemberEmailMarketingConsentChange()"
                     [disabled]="!autoSubscribeNewMembers()"
                     type="checkbox" class="form-check-input"
                     id="requires-member-email-marketing-consent-{{list.id}}">
              <label class="form-check-label"
                     for="requires-member-email-marketing-consent-{{list.id}}">Only Auto-subscribe members that have
                given email
                marketing consent via Ramblers Head Office Website
              </label>
            </div>
          </div>
          <div class="col">
            <div class="form-check">
              <input [checked]="memberSubscribable()"
                     (change)="memberSubscribableChange()"
                     type="checkbox" class="form-check-input" id="self-subscribable-{{list.id}}">
              <label class="form-check-label" for="self-subscribable-{{list.id}}">Member-subscribable</label>
            </div>
          </div>
        </div>
        @if (retrospectivePreview) {
          <div class="row mt-3">
            <div class="col">
              <div class="alert alert-warning">
                <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                <strong>{{ retrospectiveHeading() }}</strong>
                <p class="mt-2 mb-2">{{ retrospectiveMessage() }}</p>
                @if (retrospectivePreview.keptUnsubscribedCount > 0) {
                  <p class="mb-2">{{ keptUnsubscribedMessage() }}</p>
                }
                @if (retrospectiveBusy) {
                  <p class="mb-3">
                    <fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>
                    <strong>{{ progressMessage() }}</strong>
                  </p>
                }
                @if (retrospectivePreview.changes.length > 0) {
                  <app-brevo-button button [title]="retrospectiveApplyTitle()" [loading]="retrospectiveBusy"
                                    [disabled]="retrospectiveBusy" (click)="applyToExistingMembers()"/>
                  <app-brevo-button class="ms-2" button title="New members only" [disabled]="retrospectiveBusy"
                                    (click)="declineRetrospectiveApply()"/>
                } @else {
                  <app-brevo-button button title="Understood" [disabled]="retrospectiveBusy"
                                    (click)="declineRetrospectiveApply()"/>
                }
              </div>
            </div>
          </div>
        }
      }`,
    styles: [`
      .brevo-subscriber-count
        font-size: 0.85em
        color: #6c757d
      .list-sync-warning
        color: rgb(240, 128, 80)
        cursor: default
        vertical-align: -0.05em
      :host ::ng-deep .list-sync-warning-tooltip .tooltip-inner
        max-width: 360px
        text-align: left
        white-space: normal
    `],
    imports: [MailListEditorComponent, BrevoButtonComponent, ListSubscriberCountComponent, FontAwesomeModule, TooltipDirective]
})
export class MailListSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailListSettingsComponent", NgxLoggerLevel.ERROR);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private mailLinkService = inject(MailLinkService);
  private mailService = inject(MailService);
  private listSubscriberService = inject(ListSubscriberService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  private mailConfigService = inject(MailConfigService);
  protected stringUtilsService = inject(StringUtilsService);
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faSpinner = faSpinner;
  @Input() mailMessagingConfig: MailMessagingConfig;
  @Input() list: ListInfo;
  @Input() members: Member[] = [];
  @Input() notify: AlertInstance;
  @Input() notifyTarget: AlertTarget;
  public confirm: Confirm = new Confirm();
  public listUpdateRequest: ListUpdateRequest;
  public retrospectivePreview: RetrospectiveApplyPreview;
  public retrospectiveBusy = false;

  ngOnInit() {
    this.logger.info("constructed with list", this.list);
  }

  notReady() {
    return !!this.listUpdateRequest || !(this?.mailMessagingConfig?.mailConfig);
  }

  subscriberCountsDiffer(): boolean {
    return this.listSubscriberService.subscriberCount(this.members, this.list.id) !== (this.list.uniqueSubscribers ?? 0);
  }

  syncTooltip(): string {
    const local = this.listSubscriberService.subscriberCount(this.members, this.list.id);
    const brevo = this.list.uniqueSubscribers ?? 0;
    return `This site shows ${local} subscribed, Brevo has ${brevo}. Run Update Brevo Mailing Lists to sync. A remaining difference is usually members without marketing consent (counted here, excluded from Brevo) or Brevo-side unsubscribes and bounces.`;
  }


  deleteList(id: number) {
    if (!this.listEditOrDeleteDisabled()) {
      if (!id) {
        this.notify.error({
          title: "Delete Mail List",
          message: "Please select a list from the drop-down before choosing delete"
        });
      } else {
        this.confirm.toggleOnDeleteConfirm();
        this.confirm.toggleOnDeleteConfirm();
      }
    }
  }

  confirmDeleteList(id: number) {
    if (!this.listEditOrDeleteDisabled()) {
      this.notify.hide();
      this.mailService.deleteList(id)
        .then(response => {
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_LISTS_CHANGED, response));
        }).catch(error => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.ERROR, error)))
        .finally(() => {
          this.cancelDelete();
        });
    }
  }

  viewList(id: number) {
    if (!this.listEditOrDeleteDisabled()) {
      if (!id) {
        this.notify.error({
          title: "View Mail List",
          message: "Please select a list from the drop-down before choosing view"
        });
      } else {
        this.notify.hide();
        this.logger.info("viewList:id", id, "id", id);
        return window.open(this.mailLinkService.listView(id), "_blank");
      }
    }
  }

  listEditOrDeleteDisabled() {
    return this.notReady() || !this.list.id;
  }

  cancelDelete() {
    this.confirm.clear();
  }

  autoSubscribeNewMembers() {
    return this.listSetting()?.autoSubscribeNewMembers;
  }

  requiresMemberEmailMarketingConsent() {
    return this.listSetting()?.requiresMemberEmailMarketingConsent;
  }

  memberSubscribable() {
    return this.listSetting()?.memberSubscribable;
  }

  private listSetting(): ListSetting {
    const mailConfig = this.mailMessagingConfig?.mailConfig;
    if (!mailConfig) {
      return null;
    }
    if (!mailConfig.listSettings) {
      mailConfig.listSettings = [];
    }
    const existing = mailConfig.listSettings.find(item => item.id === this.list.id);
    if (existing) {
      return existing;
    }
    const created: ListSetting = {id: this.list.id, autoSubscribeNewMembers: false, requiresMemberEmailMarketingConsent: false, memberSubscribable: false};
    mailConfig.listSettings.push(created);
    return created;
  }

  autoSubscribeNewMembersChange() {
    this.listSetting().autoSubscribeNewMembers = !this.autoSubscribeNewMembers();
    this.persistListSettings();
    this.offerRetrospectiveApply();
  }

  requiresMemberEmailMarketingConsentChange() {
    this.listSetting().requiresMemberEmailMarketingConsent = !this.requiresMemberEmailMarketingConsent();
    this.persistListSettings();
    this.offerRetrospectiveApply();
  }

  private persistListSettings(): void {
    this.mailConfigService.saveConfig(this.mailMessagingConfig.mailConfig)
      .then(() => this.logger.info("list settings saved for", this.list?.name))
      .catch((error: any) => {
        this.logger.error("list settings save failed for", this.list?.name, error);
        this.notify.error({title: "List settings", message: error});
      });
  }

  nothingToApply(): boolean {
    return (this.retrospectivePreview?.changes?.length || 0) === 0;
  }

  retrospectiveHeading(): string {
    return this.nothingToApply() ? "No existing members can be changed" : "Apply this setting to existing members?";
  }

  retrospectiveMessage(): string {
    const subscribing = this.retrospectivePreview?.subscribingCount || 0;
    const unsubscribing = this.retrospectivePreview?.unsubscribingCount || 0;
    if (this.nothingToApply()) {
      return `The ${this.list?.name} setting is saved and applies to new members from now on. No existing member can be changed by it, as every one of them has an unsubscribe on record.`;
    } else {
      const wording = [
        subscribing > 0 ? `subscribe ${this.stringUtilsService.pluraliseWithCount(subscribing, "existing member")}` : null,
        unsubscribing > 0 ? `unsubscribe ${this.stringUtilsService.pluraliseWithCount(unsubscribing, "existing member")}` : null
      ].filter(item => !!item).join(" and ");
      return `The ${this.list?.name} setting is saved. It applies to new members from now on. Apply it to existing members too? This would ${wording}.`;
    }
  }

  progressMessage(): string {
    return this.notifyTarget?.alertMessage || "Saving subscription changes";
  }

  keptUnsubscribedMessage(): string {
    const members = this.stringUtilsService.pluraliseWithCount(this.retrospectivePreview?.keptUnsubscribedCount, "member");
    return this.nothingToApply()
      ? `${members} with an unsubscribe on record will be left unsubscribed. An unsubscribe is never overridden, so they can only be subscribed again individually from Member Admin.`
      : `${members} with an unsubscribe on record will be left unsubscribed, and are not counted above.`;
  }

  retrospectiveApplyTitle(): string {
    const members = this.stringUtilsService.pluraliseWithCount(this.retrospectivePreview?.changes?.length, "existing member");
    return this.retrospectiveBusy ? `Applying to ${members}` : `Apply to ${members}`;
  }

  async applyToExistingMembers(): Promise<void> {
    this.retrospectiveBusy = true;
    this.notify.hide();
    try {
      const changedMembers = this.mailListUpdaterService.applyRetrospective(this.retrospectivePreview);
      await this.mailListUpdaterService.saveAndSyncChanges(this.notify, changedMembers, this.members);
      this.notify.success({
        title: "List subscriptions",
        message: `Updated ${this.stringUtilsService.pluraliseWithCount(changedMembers.length, "member")} on ${this.list?.name}`
      });
      this.retrospectivePreview = null;
    } catch (error) {
      this.logger.error("applyToExistingMembers failed", error);
      this.notify.error({title: "List subscriptions", message: error});
    } finally {
      this.retrospectiveBusy = false;
    }
  }

  declineRetrospectiveApply(): void {
    this.notify.success({
      title: "List subscriptions",
      message: `${this.list?.name} setting saved. Existing members were left unchanged.`
    });
    this.retrospectivePreview = null;
  }

  private offerRetrospectiveApply(): void {
    const preview = this.mailListUpdaterService.retrospectivePreview(this.list, this.listSetting(), this.members);
    const worthReporting = preview.changes.length > 0 || preview.keptUnsubscribedCount > 0;
    this.retrospectivePreview = worthReporting ? preview : null;
    this.logger.info("offerRetrospectiveApply for", this.list?.name, "changes:", preview.changes.length,
      "kept unsubscribed:", preview.keptUnsubscribedCount);
  }

  memberSubscribableChange() {
    this.listSetting().memberSubscribable = !this.memberSubscribable();
    this.persistListSettings();
  }

  beginEdit() {
    this.listUpdateRequest = {listId: this.list.id, name: this.list.name, folderId: this.list.folderId};
    this.logger.info("beginEdit :", this.listUpdateRequest);
  }

  saveEdit() {
    this.logger.info("saveEdit :", this.listUpdateRequest);
    this.mailService.updateList(this.listUpdateRequest)
      .then(response => {
        this.listUpdateRequest = null;
        this.logger.info("updateList response:", response);
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_LISTS_CHANGED, response));
      })
      .catch(error => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.ERROR, error)));
  }

  cancelEdit() {
    this.listUpdateRequest = null;
  }

}
