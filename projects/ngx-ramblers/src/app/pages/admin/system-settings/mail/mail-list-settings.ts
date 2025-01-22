import { Confirm } from "../../../../models/ui-actions";
import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { BroadcastService } from "../../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { ListInfo, ListSetting, ListUpdateRequest, MailMessagingConfig } from "../../../../models/mail.model";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { MailService } from "projects/ngx-ramblers/src/app/services/mail/mail.service";

@Component({
  selector: "app-mail-list-settings",
  template: `
    <ng-container *ngIf="mailMessagingConfig?.brevo?.lists?.lists">
      <hr/>
      <div class="row mt-3">
        <div class="col">
          <ng-container *ngIf="!listUpdateRequest">
            <h5>{{ mailMessagingConfig?.brevo?.lists?.lists.indexOf(list) + 1 }}: {{ list.name }}</h5>
            Subscribers: {{ list.uniqueSubscribers }}
          </ng-container>
          <ng-container *ngIf="listUpdateRequest">
            <app-list-editor [listCreateRequest]="listUpdateRequest"/>
            <app-brevo-button button title="Save" (click)="saveEdit()"/>
            <app-brevo-button button class="ml-2" title="Cancel" (click)="cancelEdit()"/>
          </ng-container>
        </div>
        <div class="col-auto">
          <div class="float-right">
            <div *ngIf="confirm.noneOutstanding()">
              <app-brevo-button button *ngIf="!listUpdateRequest" title="Edit"
                                (click)="beginEdit()"/>
              <app-brevo-button class="ml-2" button title="View"
                                (click)="viewList(list.id)"
                                [disabled]="listEditOrDeleteDisabled()"/>
              <app-brevo-button class="ml-2" button [title]="'Delete'"
                                (click)="deleteList(list.id)"
                                [disabled]="listEditOrDeleteDisabled()"/>
            </div>
            <ng-container *ngIf="confirm.deleteConfirmOutstanding()">
              <app-brevo-button button [title]="'Confirm'"
                                (click)="confirmDeleteList(list.id)"
                                [disabled]="listEditOrDeleteDisabled()"/>
              <app-brevo-button class="ml-2" button [title]="'Cancel'"
                                (click)="cancelDelete()"
                                [disabled]="listEditOrDeleteDisabled()"/>
            </ng-container>
          </div>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col">
          <div class="custom-control custom-checkbox">
            <input [checked]="autoSubscribeNewMembers()"
                   (change)="autoSubscribeNewMembersChange()"
                   type="checkbox" class="custom-control-input" id="auto-subscribe-new-members-{{list.id}}">
            <label class="custom-control-label"
                   for="auto-subscribe-new-members-{{list.id}}">Auto-subscribe new members
            </label>
          </div>
        </div>
        <div class="col">
          <div class="custom-control custom-checkbox">
            <input [checked]="requiresMemberEmailMarketingConsent()"
                   (change)="requiresMemberEmailMarketingConsentChange()"
                   [disabled]="!autoSubscribeNewMembers()"
                   type="checkbox" class="custom-control-input"
                   id="requires-member-email-marketing-consent-{{list.id}}">
            <label class="custom-control-label"
                   for="requires-member-email-marketing-consent-{{list.id}}">Only Auto-subscribe members that have given email
              marketing consent via Ramblers Head Office Website
            </label>
          </div>
        </div>
        <div class="col">
          <div class="custom-control custom-checkbox">
            <input [checked]="memberSubscribable()"
                   (change)="memberSubscribableChange()"
                   type="checkbox" class="custom-control-input" id="self-subscribable-{{list.id}}">
            <label class="custom-control-label" for="self-subscribable-{{list.id}}">Member-subscribable</label>
          </div>
        </div>
      </div>
    </ng-container>`,
  standalone: false
})
export class MailListSettingsComponent implements OnInit {
  constructor(
    private broadcastService: BroadcastService<any>,
    private mailLinkService: MailLinkService,
    private mailService: MailService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailListSettingsComponent", NgxLoggerLevel.OFF);
  }

  private logger: Logger;
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
