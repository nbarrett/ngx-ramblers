import { Component, inject, Input, OnInit } from "@angular/core";
import { faPeopleGroup } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { ExtendedGroupEvent, GroupEvent } from "../../../models/group-event.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
    selector: "app-event-group",
    template: `@if (groupDisplayName) {
      <div [class]="compact ? 'mt-1' : 'mb-3'">
        @if (!compact) {
          <h1>Group</h1>
        }
        <div>
          <fa-icon [icon]="faPeopleGroup" class="fa-icon me-2"></fa-icon>
          @if (groupUrl) {
            <a target="_blank" [href]="groupUrl" [tooltip]="'Visit ' + groupDisplayName">{{ groupDisplayName }}</a>
          } @else {
            <span>{{ groupDisplayName }}</span>
          }
        </div>
      </div>
    }
    `,
    imports: [FontAwesomeModule, TooltipDirective]
})

export class EventGroupComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("EventGroupComponent", NgxLoggerLevel.ERROR);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  @Input() displayedWalk: DisplayedWalk;
  @Input() groupEvent: ExtendedGroupEvent;
  @Input() compact = false;
  faPeopleGroup = faPeopleGroup;
  groupUrl: string | null = null;
  groupDisplayName = "";

  ngOnInit() {
    const resolved = this.resolvedGroupEvent();
    if (!resolved?.group_code) {
      return;
    }
    const groupCode = resolved.group_code;
    this.groupDisplayName = resolved.group_name ? `${resolved.group_name} (${groupCode})` : groupCode;

    this.ramblersWalksAndEventsService.groupNotifications().subscribe(item => {
      const matched = item.response?.find(g => g.group_code === groupCode);
      if (matched) {
        this.groupUrl = matched.url;
        if (!resolved.group_name && matched.name) {
          this.groupDisplayName = `${matched.name} (${groupCode})`;
        }
      }
      this.logger.info("group lookup for", groupCode, "matched:", matched);
    });
  }

  resolvedGroupEvent(): GroupEvent {
    return this.groupEvent?.groupEvent || this.displayedWalk?.walk?.groupEvent;
  }
}
