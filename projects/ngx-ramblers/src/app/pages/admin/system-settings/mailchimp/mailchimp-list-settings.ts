import { Component, inject, Input, OnInit } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import { NgxLoggerLevel } from "ngx-logger";
import { MailchimpListCreateRequest } from "../../../../models/server-models";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import {
  CustomMergeFieldTag,
  MailchimpConfig,
  MailchimpListingResponse,
  MergeFieldAddResponse
} from "../../../../models/mailchimp.model";
import { Confirm } from "../../../../models/ui-actions";
import { BroadcastService } from "../../../../services/broadcast-service";
import { enumValues } from "../../../../functions/enums";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../../services/mailchimp-config.service";
import { MailchimpLinkService } from "../../../../services/mailchimp/mailchimp-link.service";
import { MailchimpListService } from "../../../../services/mailchimp/mailchimp-list.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { MailchimpCampaignDefaultsComponent } from "./mailchimp-campaign-defaults";

@Component({
    selector: "app-mailchimp-list-settings",
    template: `
    @if (mailchimpListingResponse?.lists) {
      <div class="col-sm-12">
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
                <select id="{{listType}}-list"
                  [(ngModel)]="mailchimpConfig.lists[listType]"
                  name="listId"
                  (ngModelChange)="listChange($event)"
                  class="form-control input-sm flex-grow-1 mr-2">
                  @for (list of mailchimpListingResponse.lists; track list) {
                    <option
                      [ngValue]="list.id">{{ list.name }}
                    </option>
                  }
                </select>
                <input type="submit" value="View"
                  (click)="viewList(currentListId())"
                  [disabled]="listEditOrDeleteDisabled()"
                  [ngClass]="listEditOrDeleteDisabled() ? 'disabled-button-form button-bottom-aligned': 'button-form blue-confirm button-bottom-aligned'">
                @if (confirm.noneOutstanding()) {
                  <input type="submit" value="Delete"
                    (click)="deleteList(currentListId())"
                    [disabled]="listEditOrDeleteDisabled()"
                    [ngClass]="listEditOrDeleteDisabled() ? 'disabled-button-form button-bottom-aligned': 'button-form button-confirm button-bottom-aligned'">
                }
                @if (confirm.deleteConfirmOutstanding()) {
                  <input type="submit" value="Confirm Delete"
                    (click)="confirmDeleteList(currentListId())"
                    [disabled]="listEditOrDeleteDisabled()"
                    [ngClass]="listEditOrDeleteDisabled() ? 'disabled-button-form button-bottom-aligned': 'button-form button-confirm button-bottom-aligned'">
                  <input type="submit" value="Cancel Delete"
                    (click)="confirm.clear()"
                    [disabled]="listEditOrDeleteDisabled()"
                    [ngClass]="listEditOrDeleteDisabled() ? 'disabled-button-form button-bottom-aligned': 'button-form amber-confirm button-bottom-aligned'">
                }
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
          @if (listConfigType==='new-list') {
            <div class="col-sm-12">
              <div class="form-group">
                <label for="list-name">List Name</label>
                <input [(ngModel)]="listCreateRequest.name" type="text" class="form-control input-sm"
                  id="list-name"
                  placeholder="The Name of the list to create">
              </div>
              <div class="form-group">
                <label for="permission-reminder">Permission Reminder</label>
                <input [(ngModel)]="listCreateRequest.permission_reminder" type="text" class="form-control input-sm"
                  id="permission-reminder"
                  placeholder="This text tells list subscribers how they were added to the list">
                <small class="form-text text-muted">This text tells list subscribers how they were added to the list</small>
              </div>
              <div class="custom-control custom-checkbox">
                <input [(ngModel)]="listCreateRequest.email_type_option"
                  type="checkbox" class="custom-control-input" id="email-type-option">
                <label class="custom-control-label"
                  for="email-type-option">Allow Different Email Types
                </label>
                <small class="form-text text-muted">Whether the list supports multiple formats for emails. When set to true,
                  subscribers can choose whether they want to receive HTML or plain-text emails. When set to false,
                  subscribers
                will receive HTML emails, with a plain-text alternative backup.</small>
              </div>
              <div class="custom-control custom-checkbox">
                <input [(ngModel)]="listCreateRequest.double_optin"
                  type="checkbox" class="custom-control-input" id="double-opt-in">
                <label class="custom-control-label"
                  for="double-opt-in">Require Double Opt-in
                </label>
                <small class="form-text text-muted">Whether or not to require the subscriber to confirm subscription via
                email</small>
              </div>
              <app-mailchimp-campaign-defaults [campaignDefaults]="listCreateRequest.campaign_defaults">
              </app-mailchimp-campaign-defaults>
              <div class="form-group">
                <input type="submit" value="Create List"
                  (click)="createList()"
                  [disabled]="listCreateDisabled()"
                  [ngClass]="listCreateDisabled() ? 'disabled-button-form button-bottom-aligned': 'button-form blue-confirm button-bottom-aligned'">
              </div>
            </div>
          }
        </div>
      </div>
    }`,
    imports: [FormsModule, NgClass, MailchimpCampaignDefaultsComponent]
})
export class MailchimpListSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpListSettingsComponent", NgxLoggerLevel.ERROR);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private mailchimpLinkService = inject(MailchimpLinkService);
  private mailchimpListService = inject(MailchimpListService);
  private stringUtils = inject(StringUtilsService);
  private mailchimpConfigService = inject(MailchimpConfigService);
  @Input()
  mailchimpConfig: MailchimpConfig;
  @Input()
  mailchimpListingResponse: MailchimpListingResponse;
  @Input()
  notify: AlertInstance;
  @Input()
  notReady: boolean;
  @Input()
  label: string;
  @Input()
  listType: string;
  public listConfigType: string;
  public listCreateRequest: MailchimpListCreateRequest;
  public confirm: Confirm = new Confirm();

  ngOnInit() {
    const listId = this?.mailchimpConfig?.lists[this.listType];
    this.logger.debug("constructed with listType", this.listType, "listId:", listId);
    this.setListConfigType();
  }

  viewList(id: string) {
    if (!id) {
      this.notify.error({
        title: "View Mailchimp List",
        message: "Please select a list from the drop-down before choosing view"
      });
    } else {
      this.notify.hide();
      const webId = this.mailchimpListingResponse.lists.find(item => item.id === id)?.web_id;
      this.logger.debug("viewList:id", id, "web_id", webId);
      return window.open(`${this.mailchimpLinkService.listView(webId)}`, "_blank");
    }
  }

  deleteList(id: string) {
    if (!id) {
      this.notify.error({
        title: "View Mailchimp List",
        message: "Please select a list from the drop-down before choosing delete"
      });
    } else {
      this.confirm.toggleOnDeleteConfirm();
    }
  }

  confirmDeleteList(id: string) {
    this.notify.hide();
    this.mailchimpListService.delete(this.listType)
      .then(response => {
        this.listChange(null);
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAILCHIMP_LISTS_CHANGED, response.id));
      }).catch(error => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.ERROR, error)))
      .finally(() => this.confirm.clear());
  }

  listChange(listId: string) {
    this.mailchimpConfig.lists[this.listType] = listId;
    this.logger.debug("listChange:listId:", listId, "this.mailchimpConfig.lists:", this.mailchimpConfig.lists);
  }

  selectListConfigType() {
    this.logger.debug("listConfigType:", this.listConfigType, "listType:", this.listType);
    switch (this.listConfigType) {
      case "no-list":
        this.listChange(null);
        break;
      case "existing-list":
        this.listChange(this.currentListId());
        break;
      case "new-list":
        this.listChange(null);
        this.listCreateRequest = this.mailchimpConfigService.createMailchimpListCreateRequest(this.mailchimpConfig.contactDefaults, this.mailchimpConfig.campaignDefaults);
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
    return isEmpty(this.listCreateRequest?.name);
  }

  currentListId() {
    return this.mailchimpConfig?.lists[this.listType];
  }

  createList() {
    this.mailchimpListService.create(this.listCreateRequest)
      .then(listAddResponse => {
        this.listChange(listAddResponse.id);
        this.setListConfigType();
        return this.mailchimpConfigService.saveConfig(this.mailchimpConfig).then(response => {
          return Promise.all(enumValues(CustomMergeFieldTag).map(tag => this.mailchimpListService.addMergeField(this.listType, {
            tag,
            public: false,
            required: false,
            name: this.stringUtils.asTitle(tag),
            type: "text"
          })))
            .then((mergeFieldAddResponses: MergeFieldAddResponse[]) => {
              this.logger.info("mergeFieldAddResponses:", mergeFieldAddResponses);
              this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAILCHIMP_LISTS_CHANGED, listAddResponse.id));
            });
        });
      }).catch(error => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.ERROR, error)));
  }
}
