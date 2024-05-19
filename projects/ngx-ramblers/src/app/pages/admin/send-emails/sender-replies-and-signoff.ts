import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MailMessagingConfig, NotificationConfig } from "../../../models/mail.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: " app-sender-replies-and-sign-off",
  template: `
    <div class="row">
      <div class="col-sm-12">
        <div class="form-group">
          <label for="sender">Sender</label>
          <select [(ngModel)]="notificationConfig.senderRole"
                  id="sender"
                  class="form-control input-sm">
            <option *ngFor="let role of mailMessagingConfig.committeeReferenceData.committeeMembers()"
                    [ngValue]="role.type">{{ role.nameAndDescription }}
            </option>
          </select>
        </div>
      </div>
      <div class="col-sm-12">
        <div class="form-group">
          <label for="reply-to">Reply To</label>
          <select [(ngModel)]="notificationConfig.replyToRole"
                  id="reply-to"
                  class="form-control input-sm">
            <option *ngFor="let role of mailMessagingConfig.committeeReferenceData.committeeMembers()"
                    [ngValue]="role.type">{{ role.nameAndDescription }}
            </option>
          </select>
        </div>
      </div>
      <div *ngIf="!omitCC" class="col-sm-12">
        <div class="form-group">
          <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                                           [label]="'CC Roles'"
                                           [roles]="notificationConfig.ccRoles"
                                           (rolesChange)="this.notificationConfig.ccRoles = $event.roles;"/>
        </div>
      </div>
      <div *ngIf="!omitSignOff" class="col-sm-12">
        <div class="form-group">
          <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                                           [label]="'Sign Off Email With Roles'"
                                           [roles]="notificationConfig.signOffRoles"
                                           (rolesChange)="this.notificationConfig.signOffRoles = $event.roles;"/>
        </div>
      </div>
    </div>`
})

export class SenderRepliesAndSignoffComponent implements OnInit {

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumGalleryComponent", NgxLoggerLevel.OFF);
  public omitSignOff: boolean;
  public omitCC: boolean;

  @Input() public notificationConfig: NotificationConfig;
  @Input() public mailMessagingConfig: MailMessagingConfig;

  @Input("omitSignOff") set omitSignOffValue(omitSignOff: boolean) {
    this.omitSignOff = coerceBooleanProperty(omitSignOff);
  }

  @Input("omitCC") set omitCCValue(omitCC: boolean) {
    this.omitCC = coerceBooleanProperty(omitCC);
  }

  ngOnInit() {
    this.logger.info("constructed notificationConfig", this.notificationConfig, "mailMessagingConfig:", this.mailMessagingConfig);
  }
}
