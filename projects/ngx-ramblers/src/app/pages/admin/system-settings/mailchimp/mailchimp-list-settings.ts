import { Component, Input, OnInit } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import { NgxLoggerLevel } from "ngx-logger";
import { MailchimpListCreateRequest } from "../../../../models/server-models";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { CustomMergeFieldTag, MailchimpConfig, MailchimpListingResponse, MergeFieldAddResponse } from "../../../../models/mailchimp.model";
import { Confirm } from "../../../../models/ui-actions";
import { BroadcastService } from "../../../../services/broadcast-service";
import { enumValues } from "../../../../services/enums";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../../services/mailchimp-config.service";
import { MailchimpLinkService } from "../../../../services/mailchimp/mailchimp-link.service";
import { MailchimpListService } from "../../../../services/mailchimp/mailchimp-list.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";

@Component({
  selector: "app-mailchimp-list-settings",
  templateUrl: "./mailchimp-list-settings.html",
})
export class MailchimpListSettingsComponent implements OnInit {
  private logger: Logger;
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

  constructor(
    private broadcastService: BroadcastService<any>,
    private mailchimpLinkService: MailchimpLinkService,
    private mailchimpListService: MailchimpListService,
    private stringUtils: StringUtilsService,
    private mailchimpConfigService: MailchimpConfigService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailchimpListMappingComponent", NgxLoggerLevel.OFF);
  }

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
