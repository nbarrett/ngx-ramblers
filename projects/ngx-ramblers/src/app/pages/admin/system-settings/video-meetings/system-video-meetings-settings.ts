import { Component, inject, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { View } from "../../../../models/content-text.model";
import { SystemConfig } from "../../../../models/system.model";
import {
  VIDEO_MEETINGS_GUEST_INSTRUCTIONS_CONTENT_CATEGORY,
  VIDEO_MEETINGS_GUEST_INSTRUCTIONS_CONTENT_NAME
} from "../../../../models/video-meeting.model";
import { ContentTextEditor } from "../../../../modules/common/tiptap-editor/content-text-editor";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";

@Component({
  selector: "app-system-video-meetings-settings",
  imports: [FormsModule, ContentTextEditor],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Video Meetings</div>
      @if (systemConfigInternal?.videoMeetings) {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-sm-6">
              <div class="form-group">
                <label for="video-meetings-brand">Meeting brand name</label>
                <input [(ngModel)]="systemConfigInternal.videoMeetings.brandName"
                       id="video-meetings-brand"
                  type="text" class="form-control input-sm"
                  placeholder="Ramblers Video Meetings">
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                The name your group's meetings are branded with. Everything else about video meetings - whether
                they are switched on, the host, the room prefix and the join defaults - is set once for the whole
                estate in Global Settings, so it is the same for every group.
              </div>
            </div>
          </div>
          <div class="row">
            <div class="col-sm-6">
              <div class="form-group">
                <label>Guest joining instructions</label>
                <app-content-text-editor standalone
                                         [category]="guestInstructionsCategory"
                                         [name]="guestInstructionsName"
                                         description="Guest joining instructions"
                                         [initialView]="View.EDIT"/>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                Included in guest invite emails and meeting invitations. Empty fields load the standard wording. Use default to restore it, then save in the editor toolbar.
              </div>
            </div>
          </div>
        </div>
      }
    </div>`
})
export class SystemVideoMeetingsSettings implements OnInit {

  protected systemConfigInternal: SystemConfig;
  protected readonly View = View;
  protected readonly guestInstructionsCategory = VIDEO_MEETINGS_GUEST_INSTRUCTIONS_CONTENT_CATEGORY;
  protected readonly guestInstructionsName = VIDEO_MEETINGS_GUEST_INSTRUCTIONS_CONTENT_NAME;
  private systemConfigService = inject(SystemConfigService);
  private logger = inject(LoggerFactory).createLogger("SystemVideoMeetingsSettings", NgxLoggerLevel.ERROR);

  @Input({alias: "config", required: true}) set configValue(systemConfig: SystemConfig) {
    this.handleConfigChange(systemConfig);
  }

  ngOnInit() {
    this.logger.info("constructed:", this.systemConfigInternal?.videoMeetings);
  }

  handleConfigChange(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (this.systemConfigInternal && !this.systemConfigInternal.videoMeetings) {
      this.systemConfigInternal.videoMeetings = this.systemConfigService.videoMeetingsDefaults();
    }
    this.logger.info("handleConfigChange:videoMeetings:", this.systemConfigInternal?.videoMeetings);
  }
}
