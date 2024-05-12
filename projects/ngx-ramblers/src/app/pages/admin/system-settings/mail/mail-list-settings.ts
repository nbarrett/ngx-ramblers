import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { Confirm } from "../../../../models/ui-actions";
import { BroadcastService } from "../../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import {
  FoldersListResponse,
  ListCreateRequest,
  ListCreateResponse,
  ListsResponse,
  MailConfig
} from "../../../../models/mail.model";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { MailService } from "projects/ngx-ramblers/src/app/services/mail/mail.service";
import isEmpty from "lodash-es/isEmpty";

@Component({
  selector: "app-mail-list-settings",
  template: `
    <div *ngIf="listsResponse?.lists" class="col-sm-12">
      <div class="form-group">
        <label for="{{listType}}-list">{{ label }}</label>
        <div class="col-sm-12">
          <div class="form-inline">
            <form>
              <div class="custom-control custom-radio custom-control-inline">
                <input id="{{listType}}-existing-list"
                       type="radio"
                       class="custom-control-input"
                       [(ngModel)]="listConfigType"
                       name="existing-list"
                       (change)="selectListConfigType()"
                       value="existing-list"/>
                <label class="custom-control-label" for="{{listType}}-existing-list">Existing List:
                </label>
              </div>
              <select *ngIf="mailConfig.lists" id="{{listType}}-list"
                      [(ngModel)]="mailConfig.lists[listType]"
                      name="listId"
                      (ngModelChange)="listChange($event)"
                      class="form-control input-sm flex-grow-1 mr-2">
                <option *ngFor="let list of listsResponse.lists"
                        [ngValue]="list.id">{{ list.name }}
                </option>
              </select>
              <app-brevo-button button [title]="'View'" *ngIf="confirm.noneOutstanding()"
                                (click)="viewList(currentListId())"
                                [disabled]="listEditOrDeleteDisabled()"/>
              <app-brevo-button class="ml-2" button [title]="'Delete'" *ngIf="confirm.noneOutstanding()"
                                (click)="deleteList(currentListId())"
                                [disabled]="listEditOrDeleteDisabled()"/>
              <ng-container *ngIf="confirm.deleteConfirmOutstanding()">
                <app-brevo-button class="ml-2" button [title]="'Confirm Delete'"
                                  (click)="confirmDeleteList(currentListId())"
                                  [disabled]="listEditOrDeleteDisabled()"/>
                <app-brevo-button class="ml-2" button [title]="'Cancel Delete'"
                                  (click)="confirm.clear()"
                                  [disabled]="listEditOrDeleteDisabled()"/>
              </ng-container>
              <div class="custom-control custom-radio custom-control-inline ml-2">
                <input id="{{listType}}-no-list"
                       type="radio"
                       class="custom-control-input"
                       [(ngModel)]="listConfigType"
                       (change)="selectListConfigType()"
                       name="no-list"
                       value="no-list"/>
                <label class="custom-control-label" for="{{listType}}-no-list">
                  No List</label>
              </div>
              <div class="custom-control custom-radio custom-control-inline">
                <input id="{{listType}}-new-list"
                       type="radio"
                       class="custom-control-input"
                       [(ngModel)]="listConfigType"
                       (change)="selectListConfigType()"
                       name="new-list"
                       value="new-list"/>
                <label class="custom-control-label" for="{{listType}}-new-list">
                  Create new List</label>
              </div>
            </form>
          </div>
        </div>
        <ng-container *ngIf="listConfigType==='new-list'">
          <div class="row align-items-end mt-2">
            <div class="col-sm-4">
              <div class="form-group">
                <label for="list-name">List Name</label>
                <input [(ngModel)]="listCreateRequest.name" type="text" class="form-control input-sm"
                       id="list-name"
                       placeholder="The Name of the list to create">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="{{listType}}-folder">Folder Name</label>
                <select *ngIf="foldersResponse" id="{{listType}}-folder"
                        [(ngModel)]="listCreateRequest.folderId"
                        name="folderId"
                        (ngModelChange)="folderChange($event)"
                        class="form-control input-sm flex-grow-1 mr-2">
                  <option *ngFor="let folder of foldersResponse.folders"
                          [ngValue]="folder.id">{{ folder.name }}
                  </option>
                </select>
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <input type="submit" value="Create List"
                       (click)="createList()"
                       [disabled]="listCreateDisabled()"
                       [ngClass]="listCreateDisabled() ? 'disabled-button-form button-bottom-aligned': 'button-form blue-confirm button-bottom-aligned'">
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>`
})
export class MailListSettingsComponent implements OnInit {
  private logger: Logger;
  @Input() mailConfig: MailConfig;
  @Input() listsResponse: ListsResponse;
  @Input() foldersResponse: FoldersListResponse;
  @Input() notify: AlertInstance;
  @Input() notReady: boolean;
  @Input() label: string;
  @Input() listType: string;
  public listConfigType: string;
  public listCreateResponse: ListCreateResponse;
  public confirm: Confirm = new Confirm();
  public listCreateRequest: ListCreateRequest;

  constructor(
    private broadcastService: BroadcastService<any>,
    private mailLinkService: MailLinkService,
    private mailService: MailService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailListSettingsComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    if (!this.mailConfig.lists) {
      this.mailConfig.lists = {general: null, walks: null, socialEvents: null};
    }
    const listId = this?.mailConfig?.lists && this.listType && this?.mailConfig?.lists[this.listType];
    this.logger.info("constructed with listType", this.listType, "listId:", listId);
    this.setListConfigType();
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

  deleteList(id: number) {
    if (!this.listEditOrDeleteDisabled()) {
      if (!id) {
      this.notify.error({
        title: "Delete Mail List",
        message: "Please select a list from the drop-down before choosing delete"
      });
    } else {
      this.confirm.toggleOnDeleteConfirm();
      }
    }
  }

  confirmDeleteList(id: number) {
    if (!this.listEditOrDeleteDisabled()) {
    this.notify.hide();
    this.mailService.deleteList(id)
      .then(response => {
        this.noListChange();
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_LISTS_CHANGED, response));
      }).catch(error => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.ERROR, error)))
      .finally(() => this.confirm.clear());
    }
  }

  listChange(listId: number) {
    if (this.listType && listId) {
      this.mailConfig.lists[this.listType] = listId;
      this.listConfigType = "existing-list";
    }
    this.logger.info("listChange:listId:", listId, "this.mailConfig.lists:", this.mailConfig.lists);
  }

  noListChange() {
    if (this.listType) {
      this.mailConfig.lists[this.listType] = null;
    }
    this.logger.info("noListChange:this.mailConfig.lists:", this.mailConfig.lists);
  }

  folderChange(folderId: number) {
    this.logger.info("folderChange:folderId:", folderId, "listCreateRequest:", this.listCreateRequest);
  }

  async selectListConfigType() {
    this.logger.info("listConfigType:", this.listConfigType, "listType:", this.listType);
    switch (this.listConfigType) {
      case "no-list":
        this.noListChange();
        break;
      case "existing-list":
        this.listChange(this.currentListId());
        break;
      case "new-list":
        this.listChange(null);
        this.listCreateRequest = {name: "", folderId: 0};
        break;
    }
  }

  private setListConfigType() {
    if (this.currentListId()) {
      this.listConfigType = "existing-list";
    } else {
      this.listConfigType = "no-list";
    }
  }

  listEditOrDeleteDisabled() {
    return this.notReady || !this.currentListId();
  }

  listCreateDisabled() {
    return isEmpty(this.listCreateRequest?.name) || !this.listCreateRequest?.folderId;
  }

  currentListId(): number {
    return this.mailConfig?.lists && this.listType && this.mailConfig?.lists[this.listType];
  }

  createList() {
    this.mailService.createList(this.listCreateRequest)
      .then(response => {
        this.listCreateResponse = response;
        this.logger.info("createList response:", this.listCreateResponse);
        this.listChange(response.id);
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_LISTS_CHANGED, response));
      })
      .catch(error => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.ERROR, error)));
  }
}
