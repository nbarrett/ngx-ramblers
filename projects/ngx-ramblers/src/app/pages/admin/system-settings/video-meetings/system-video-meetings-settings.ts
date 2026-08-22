import { Component, inject, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";

@Component({
  selector: "app-system-video-meetings-settings",
  imports: [FormsModule],
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
        </div>
      }
    </div>`
})
export class SystemVideoMeetingsSettings implements OnInit {

  protected systemConfigInternal: SystemConfig;
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
