import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../../../models/member.model";
import { WalkDataAudit } from "../../../../models/walk-data-audit.model";
import { WalkEvent } from "../../../../models/walk-event.model";
import { WalkNotification } from "../../../../models/walk-notification.model";
import { EventType } from "../../../../models/walk.model";
import { WalkDisplayService } from "../../../../pages/walks/walk-display.service";
import { GoogleMapsService } from "../../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AuditDeltaValuePipe } from "../../../../pipes/audit-delta-value.pipe";
import { ChangedItem } from "../../../../models/changed-item.model";
import { marked } from "marked";
import { ValueOrDefaultPipe } from "../../../../pipes/value-or-default.pipe";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { ExtendedGroupEvent } from "../../../../models/group-event.model";
import { StringUtilsService } from "../../../../services/string-utils.service";

@Component({
    selector: "app-walk-notification-details",
    template: `
    <table style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Walk Date:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk?.groupEvent?.start_date_time | displayDate }}</td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Start Time:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk?.groupEvent?.start_date_time | valueOrDefault }}</td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Description:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk?.groupEvent?.title | valueOrDefault }}</td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Walk Description:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px" [innerHTML]="renderMarked(walk.groupEvent.description)"></td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Distance:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk.groupEvent.distance_miles | valueOrDefault }}</td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Starting Location:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk.groupEvent.start_location?.description | valueOrDefault }}</td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Grade:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk.groupEvent.difficulty | valueOrDefault }}</td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Grid Ref:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
          <a [href]="'http://gridreferencefinder.com/?gr=' + display.gridReferenceFrom(walk.groupEvent.start_location)" target="_blank">
            {{ display.gridReferenceFrom(walk.groupEvent.start_location) | valueOrDefault }}</a></td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Postcode:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
          <a [href]="googleMapsService.urlForPostcode(walk.groupEvent.start_location?.postcode)" target="_blank">
            {{ walk.groupEvent.start_location?.postcode | valueOrDefault }}</a></td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Display Name:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk?.fields?.contactDetails?.displayName | valueOrDefault }}</td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Contact Email:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"><a [href]="'mailto:'+ walk?.fields?.contactDetails?.email"><span>{{ walk?.fields?.contactDetails?.email | valueOrDefault }}</span></a></td>
      </tr>
      <tr>
        <td style="width:25%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Contact Phone:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk?.fields?.contactDetails?.phone }}</td>
      </tr>
    </table>`,
    imports: [DisplayDatePipe, ValueOrDefaultPipe]
})
export class WalkNotificationDetailsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkNotificationDetailsComponent", NgxLoggerLevel.ERROR);
  private valueOrDefaultPipe = inject(ValueOrDefaultPipe);
  private auditDeltaValuePipe = inject(AuditDeltaValuePipe);
  googleMapsService = inject(GoogleMapsService);
  display = inject(WalkDisplayService);
  protected stringUtils = inject(StringUtilsService);
  public data: WalkNotification;
  public walk: ExtendedGroupEvent;
  public status: EventType;
  public event: WalkEvent;
  public walkDataAudit: WalkDataAudit;
  public validationMessages: string[];
  public reason: string;
  public members: Member[];

  @Input("data") set walkNotificationValue(data: WalkNotification) {
    this.data = data;
    this.initialiseData();
  }

  ngOnInit() {
    this.logger.info("ngOnInit:members ->", this.display.members);
    this.members = this.display.members;
    this.initialiseData();
  }

  private initialiseData() {
    this.logger.info("initialiseData:data ->", this.data);
    if (this.data) {
      this.walk = this.data.walk;
      this.status = this.data.status;
      this.event = this.data.event;
      this.walkDataAudit = this.data.walkDataAudit;
      this.walkDataAudit.changedItems = this.walkDataAudit.changedItems.map((changedItem: ChangedItem) => ({
        fieldName: changedItem.fieldName,
        previousValue: this.auditedValue(changedItem.previousValue, changedItem.fieldName),
        currentValue: this.auditedValue(changedItem.currentValue, changedItem.fieldName)
      }));
      this.validationMessages = this.data.validationMessages;
      this.reason = this.data.reason;
    }
  }

  renderMarked(markdownValue: string) {
    if (markdownValue) {
      const renderedMarkdown = marked(markdownValue.toString() || "");
      this.logger.info("renderMarked: markdownValue:", markdownValue, "renderedMarkdown:", renderedMarkdown);
      return renderedMarkdown;
    } else {
      return this.valueOrDefaultPipe.transform(markdownValue);
    }
  }

  auditedValue(previousValue: any, fieldName: string): string {
    const transformedValue = this.auditDeltaValuePipe.transform(previousValue, fieldName, this.members, "(none)");
    this.logger.info("audit:previousValue ->", previousValue, "fieldName ->", fieldName, "transformedValue:", transformedValue);
    return transformedValue?.toString();
  }

}
