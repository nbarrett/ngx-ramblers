import { Component, inject, Input, OnInit } from "@angular/core";
import { faPeopleGroup } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { RamblersGroupsApiResponse } from "../../../models/ramblers-walks-manager";
import { GroupEvent } from "../../../models/group-event.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
    selector: "app-event-group",
    template: `@if (true) {
      @if (resolvedGroupEvent()?.group_code) {
        <div class="mb-2">
          <h1>Group</h1>
          <div>
            <div class="row">
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <fa-icon title tooltip="contact {{resolvedGroupEvent()?.group_name}}"
                         [icon]="faPeopleGroup"
                         class="fa-icon me-1 pointer"></fa-icon>
                <a content target="_blank"
                   [href]="urlFor(resolvedGroupEvent()?.group_code)">{{ resolvedGroupEvent()?.group_name + " (" + resolvedGroupEvent()?.group_code + ")" }}</a>
              </div>
            </div>
          </div>
        </div>
      }
    }
    `,
    imports: [RelatedLinkComponent, FontAwesomeModule, TooltipDirective]
})

export class EventGroupComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("EventGroupComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  display = inject(WalkDisplayService);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  @Input()
  public displayedWalk: DisplayedWalk;
  @Input()
  public groupEvent: ExtendedGroupEvent;
  faPeopleGroup = faPeopleGroup;
  private groups: RamblersGroupsApiResponse[] = [];

  ngOnInit() {
    this.ramblersWalksAndEventsService.groupNotifications().subscribe(item => this.groups = item.response);
  }

  resolvedGroupEvent(): GroupEvent {
    return this.groupEvent?.groupEvent || this.displayedWalk?.walk?.groupEvent;
  }

  urlFor(groupCode: string): string {
    const ramblersGroupsApiResponse = this.groups?.find(item => item.group_code === groupCode);
    this.logger.info("given groupCode:", groupCode, "returned:", ramblersGroupsApiResponse);
    return ramblersGroupsApiResponse?.url;
  }
}
