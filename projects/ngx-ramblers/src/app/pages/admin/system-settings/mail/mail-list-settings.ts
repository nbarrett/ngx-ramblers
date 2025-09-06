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

@Component({
    selector: "app-mail-list-settings",
    template: `
    @if (mailMessagingConfig?.brevo?.lists?.lists) {
      <hr/>
      <div class="row mt-3">
        <div class="col">
          @if (!listUpdateRequest) {
            <h5>{{ mailMessagingConfig?.brevo?.lists?.lists.indexOf(list) + 1 }}: {{ list.name }}</h5>
            Subscribers: {{ list.uniqueSubscribers }}
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
              type="checkbox" class="form-check-input" id="auto-subscribe-new-members-{{list.id}}">
          </div>
        </div>
        <div class="col">
          <div class="form-check">
            <input [checked]="requiresMemberEmailMarketingConsent()"
              (change)="requiresMemberEmailMarketingConsentChange()"
              [disabled]="!memberSubscribable()"
              type="checkbox" class="form-check-input"
              id="requires-member-email-marketing-consent-{{list.id}}">
            <label class="form-check-label"
              for="requires-member-email-marketing-consent-{{list.id}}">Only Auto-subscribe members that have given email
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
    }`,
    imports: [MailListEditorComponent, BrevoButtonComponent]
})
export class MailListSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailListSettingsComponent", NgxLoggerLevel.ERROR);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private mailLinkService = inject(MailLinkService);
  private mailService = inject(MailService);
  @Input() mailMessagingConfig: MailMessagingConfig;
  @Input() list: ListInfo;
  @Input() notify: AlertInstance;
  public confirm: Confirm = new Confirm();
  public listUpdateRequest: ListUpdateRequest;

  ngOnInit() {
    this.logger.info("constructed with list", this.list);
  }

  notReady() {
    return !!this.listUpdateRequest || !(this?.mailMessagingConfig?.mailConfig);
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
    return this.mailMessagingConfig?.mailConfig?.listSettings?.find(item => item.id === this.list.id);
  }

  autoSubscribeNewMembersChange() {
    this.listSetting().autoSubscribeNewMembers = !this.autoSubscribeNewMembers();
  }

  requiresMemberEmailMarketingConsentChange() {
    this.listSetting().requiresMemberEmailMarketingConsent = !this.requiresMemberEmailMarketingConsent();
  }

  memberSubscribableChange() {
    this.listSetting().memberSubscribable = !this.memberSubscribable();
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
