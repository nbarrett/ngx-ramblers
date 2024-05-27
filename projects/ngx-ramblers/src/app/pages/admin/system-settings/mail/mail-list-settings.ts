import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { Confirm } from "../../../../models/ui-actions";
import { BroadcastService } from "../../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import {
  ListCreateResponse,
  ListInfo,
  ListSetting,
  ListUpdateRequest,
  MailMessagingConfig
} from "../../../../models/mail.model";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { MailService } from "projects/ngx-ramblers/src/app/services/mail/mail.service";
import { faCancel, faEdit, faSave } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-mail-list-settings",
  template: `
    <div *ngIf="mailMessagingConfig?.brevo?.lists?.lists" class="row align-items-start mt-3">
      <div class="col-2">
        <b>{{ mailMessagingConfig?.brevo?.lists?.lists.indexOf(list) + 1 }}: {{ list.name }}</b>
        <app-badge-button *ngIf="!listUpdateRequest" class="ml-2" [icon]="faEdit" caption="Edit"
                          (click)="beginEdit()"></app-badge-button>
      </div>
      <div class="col-2">
        <div>Total Subscribers: {{ list.totalSubscribers }}</div>
      </div>
      <div class="col-2">
        <div>Unique Subscribers: {{ list.uniqueSubscribers }}</div>
      </div>
      <div class="col-2">
        <div class="custom-control custom-checkbox">
          <input [checked]="autoSubscribeNewMembers()"
                 (change)="autoSubscribeNewMembersChange()"
                 type="checkbox" class="custom-control-input" id="auto-subscribe-new-members-{{list.id}}">
          <label class="custom-control-label"
                 for="auto-subscribe-new-members-{{list.id}}">Auto-subscribe new members
          </label>
        </div>
      </div>
      <div class="col-sm-4">
        <app-brevo-button button [title]="'View'" *ngIf="confirm.noneOutstanding()"
                          (click)="viewList(list.id)"
                          [disabled]="listEditOrDeleteDisabled()"/>
        <app-brevo-button class="ml-2" button [title]="'Delete'" *ngIf="confirm.noneOutstanding()"
                          (click)="deleteList(list.id)"
                          [disabled]="listEditOrDeleteDisabled()"/>
        <ng-container *ngIf="localConfirm.deleteConfirmOutstanding()">
          <app-brevo-button button [title]="'Confirm Delete'"
                            (click)="confirmDeleteList(list.id)"
                            [disabled]="listEditOrDeleteDisabled()"/>
          <app-brevo-button class="ml-2" button [title]="'Cancel Delete'"
                            (click)="cancelDelete()"
                            [disabled]="listEditOrDeleteDisabled()"/>
        </ng-container>
      </div>
    </div>
    <ng-container *ngIf="listUpdateRequest">
      <app-list-editor [listCreateRequest]="listUpdateRequest"/>
      <app-badge-button class="ml-2" [icon]="faSave" caption="Save" (click)="saveEdit()"></app-badge-button>
      <app-badge-button class="ml-2" [icon]="faCancel" caption="Cancel" (click)="cancelEdit()"></app-badge-button>
    </ng-container>
    <hr/>`
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
  @Input() notReady: boolean;
  @Input() confirm: Confirm;
  public localConfirm: Confirm = new Confirm();
  public listUpdateResponse: ListCreateResponse;
  public listUpdateRequest: ListUpdateRequest;
  protected readonly faEdit = faEdit;
  protected readonly faSave = faSave;
  protected readonly faCancel = faCancel;

  ngOnInit() {
    this.logger.info("constructed with list", this.list);
  }

  deleteList(id: number) {
    if (!this.listEditOrDeleteDisabled()) {
      if (!id) {
        this.notify.error({
          title: "Delete Mail List",
          message: "Please select a list from the drop-down before choosing delete"
        });
      } else {
        this.localConfirm.toggleOnDeleteConfirm();
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
    return this.notReady || !this.list.id;
  }

  cancelDelete() {
    this.localConfirm.clear();
    this.confirm.clear();
  }

  autoSubscribeNewMembers() {
    return this.listSetting()?.autoSubscribeNewMembers;
  }

  private listSetting(): ListSetting {
    return this.mailMessagingConfig?.mailConfig?.listSettings?.find(item => item.id === this.list.id);
  }

  autoSubscribeNewMembersChange() {
    this.listSetting().autoSubscribeNewMembers = !this.autoSubscribeNewMembers();
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
