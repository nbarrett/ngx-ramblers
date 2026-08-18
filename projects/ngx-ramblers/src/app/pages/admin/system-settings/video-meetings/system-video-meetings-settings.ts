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
                <div class="custom-control custom-checkbox">
                  <input type="checkbox" class="custom-control-input" id="video-meetings-enabled"
                         [(ngModel)]="systemConfigInternal.videoMeetings.enabled">
                  <label class="custom-control-label" for="video-meetings-enabled">Enable video meetings</label>
                </div>
              </div>
              <div class="form-group">
                <label for="video-meetings-host">Self-hosted Jitsi host URL (optional)</label>
                <input [(ngModel)]="systemConfigInternal.videoMeetings.hostUrl" id="video-meetings-host"
                       type="text" class="form-control input-sm" placeholder="Leave blank to use the free meet.jit.si">
              </div>
              <div class="form-group">
                <label for="video-meetings-prefix">Room name prefix</label>
                <input [(ngModel)]="systemConfigInternal.videoMeetings.roomPrefix" id="video-meetings-prefix"
                       type="text" class="form-control input-sm" placeholder="ngx">
              </div>
              <div class="form-group">
                <label for="video-meetings-brand">Meeting brand name</label>
                <input [(ngModel)]="systemConfigInternal.videoMeetings.brandName" id="video-meetings-brand"
                       type="text" class="form-control input-sm" placeholder="Ramblers Video Meetings">
              </div>
              <div class="form-group">
                <div class="custom-control custom-checkbox">
                  <input type="checkbox" class="custom-control-input" id="video-meetings-notes"
                         [(ngModel)]="systemConfigInternal.videoMeetings.enableNotes">
                  <label class="custom-control-label" for="video-meetings-notes">Show the shared notes panel</label>
                </div>
                <div class="custom-control custom-checkbox">
                  <input type="checkbox" class="custom-control-input" id="video-meetings-lobby"
                         [(ngModel)]="systemConfigInternal.videoMeetings.enableLobby">
                  <label class="custom-control-label" for="video-meetings-lobby">Show the pre-join lobby screen</label>
                </div>
                <div class="custom-control custom-checkbox">
                  <input type="checkbox" class="custom-control-input" id="video-meetings-audio-muted"
                         [(ngModel)]="systemConfigInternal.videoMeetings.startWithAudioMuted">
                  <label class="custom-control-label" for="video-meetings-audio-muted">Start with microphone muted</label>
                </div>
                <div class="custom-control custom-checkbox">
                  <input type="checkbox" class="custom-control-input" id="video-meetings-video-muted"
                         [(ngModel)]="systemConfigInternal.videoMeetings.startWithVideoMuted">
                  <label class="custom-control-label" for="video-meetings-video-muted">Start with camera off</label>
                </div>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                Video meetings are open-source Jitsi, built into the site. Leave the host URL blank and meetings run on
                the free <code>meet.jit.si</code> instance. That public service now asks the first person to sign in
                with Google or GitHub to start the room — that is Jitsi's login, not NGX. Set a host URL to point at
                your own self-hosted Jitsi instead.
              </div>
              <div class="form-group">
                When your own host is configured with a JWT app id and secret (server environment variables
                <code>JITSI_JWT_APP_ID</code> and <code>JITSI_JWT_APP_SECRET</code>), member identity is asserted
                cryptographically and committee members become moderators automatically.
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
