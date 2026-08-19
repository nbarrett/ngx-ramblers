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
              <div class="form-check">
                <input [(ngModel)]="systemConfigInternal.videoMeetings.enabled"
                       type="checkbox" class="form-check-input"
                       id="video-meetings-enabled">
                <label class="form-check-label"
                       for="video-meetings-enabled">Enable video meetings
                </label>
              </div>
              <div class="form-group">
                <label for="video-meetings-host">Meeting host URL (optional)</label>
                <input [(ngModel)]="systemConfigInternal.videoMeetings.hostUrl"
                       id="video-meetings-host"
                  type="text" class="form-control input-sm"
                  placeholder="Leave blank to use the public rooms">
              </div>
              <div class="form-group">
                <label for="video-meetings-prefix">Room name prefix</label>
                <input [(ngModel)]="systemConfigInternal.videoMeetings.roomPrefix"
                       id="video-meetings-prefix"
                  type="text" class="form-control input-sm"
                  placeholder="ngx">
              </div>
              <div class="form-group">
                <label for="video-meetings-brand">Meeting brand name</label>
                <input [(ngModel)]="systemConfigInternal.videoMeetings.brandName"
                       id="video-meetings-brand"
                  type="text" class="form-control input-sm"
                  placeholder="Ramblers Video Meetings">
              </div>
              <div class="form-check">
                <input [(ngModel)]="systemConfigInternal.videoMeetings.enableNotes"
                       type="checkbox" class="form-check-input"
                       id="video-meetings-notes">
                <label class="form-check-label"
                       for="video-meetings-notes">Show the shared notes panel
                </label>
              </div>
              <div class="form-check">
                <input [(ngModel)]="systemConfigInternal.videoMeetings.enableLobby"
                       type="checkbox" class="form-check-input"
                       id="video-meetings-lobby">
                <label class="form-check-label"
                       for="video-meetings-lobby">Show the pre-join lobby screen
                </label>
              </div>
              <div class="form-check">
                <input [(ngModel)]="systemConfigInternal.videoMeetings.startWithAudioMuted"
                       type="checkbox" class="form-check-input"
                       id="video-meetings-audio-muted">
                <label class="form-check-label"
                       for="video-meetings-audio-muted">Start with microphone muted
                </label>
              </div>
              <div class="form-check">
                <input [(ngModel)]="systemConfigInternal.videoMeetings.startWithVideoMuted"
                       type="checkbox" class="form-check-input"
                       id="video-meetings-video-muted">
                <label class="form-check-label"
                       for="video-meetings-video-muted">Start with camera off
                </label>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                Leave the host URL blank and rooms open on the public service. The first person signs in to start
                the room. Set a host URL to run meetings on this site.
              </div>
              <div class="form-group">
                When your own host is configured with a signed login, members join as themselves
                and committee members become moderators automatically.
              </div>
              <div class="form-group">
                The shared notes panel saves notes to this group, not the meeting, so they are still available afterwards.
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
