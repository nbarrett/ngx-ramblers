import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { ListCreateRequest, MailMessagingConfig, NotificationConfig } from "../../../../models/mail.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { Subscription } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
  selector: "app-list-editor",
  template: `
    <div class="row">
      <div class="col-sm-6">
        <div class="form-group">
          <label for="list-name">List Name</label>
          <input [(ngModel)]="listCreateRequest.name" type="text" class="form-control input-sm"
            id="list-name"
            placeholder="The Name of the list to create">
        </div>
      </div>
      <div class="col-sm-6">
        <div class="form-group">
          <label for="folder">Folder Name</label>
          @if (mailMessagingConfig?.brevo?.folders) {
            <select id="folder"
              [(ngModel)]="listCreateRequest.folderId"
              name="folderId"
              class="form-control input-sm flex-grow-1 mr-2">
              @for (folder of mailMessagingConfig?.brevo?.folders?.folders; track folder) {
                <option
                  [ngValue]="folder.id">{{ folder.name }}
                </option>
              }
            </select>
          }
        </div>
      </div>
    </div>`,
  standalone: false
})
export class MailListEditorComponent implements OnInit, OnDestroy {
  public mailMessagingConfig: MailMessagingConfig;
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  private subscriptions: Subscription[] = [];
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailListEditorComponent", NgxLoggerLevel.OFF);
  public notificationConfig: NotificationConfig;
  @Input() public listCreateRequest: ListCreateRequest;

  ngOnInit() {
    this.logger.off("ngOnInit")
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
