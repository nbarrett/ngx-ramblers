import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ExternalSystems, rgbColourCloudy } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { SvgComponent } from "../../modules/common/svg/svg";

@Component({
    selector: "app-social-media-links",
    template: `
    <ul
      class="icon-container d-inline-flex justify-content-between align-items-center list-unstyled w-100 mt-3 mb-5 mb-lg-3">
      @if (externalSystems?.facebook) {
        <li class="mb-0" placement="top"
          [tooltip]="'View our Facebook page (opens a new browser tab)'"><a [href]="externalSystems?.facebook?.groupUrl"
          target="_blank"
          class="d-block p-1">
          <app-svg icon="i-facebook" width="24" height="24" [colour]="colour"/>
          <span class="visually-hidden">
            Visit our Facebook page (opens a new browser tag)
          </span>
        </a>
      </li>
    }
    @if (externalSystems?.twitter) {
      <li class="mb-0" placement="top"
        [tooltip]="'View our Twitter page (opens a new browser tab)'"><a [href]="externalSystems?.twitter"
        target="_blank"
        class="d-block p-1">
        <app-svg icon="i-twitter" width="24" height="24" [colour]="colour"/>
        <span class="visually-hidden">
          Visit our Twitter page (opens a new browser tag)
        </span>
      </a></li>
    }
    @if (externalSystems?.linkedIn) {
      <li class="mb-0" placement="top"
        [tooltip]="'View our Linked in page (opens a new browser tab)'"><a [href]="externalSystems?.linkedIn"
        target="_blank"
        class="d-block p-1">
        <app-svg icon="i-linkedin-in" width="24" height="24" [colour]="colour"/>
        <span class="visually-hidden">
          Visit our Linkedin page (opens a new browser tag)
        </span>
      </a></li>
    }
    @if (externalSystems?.youtube) {
      <li class="mb-0" placement="top"
        [tooltip]="'View our Youtube page (opens a new browser tab)'"><a [href]="externalSystems?.youtube"
        target="_blank" class="d-block p-1">
        <app-svg icon="i-youtube" width="24" height="24" [colour]="colour"/>
        <span class="visually-hidden">
          Visit our Youtube page (opens a new browser tag)
        </span>
      </a></li>
    }
    @if (externalSystems?.instagram) {
      <li class="mb-0" placement="top"
        [tooltip]="'View our Instagram page (opens a new browser tab)'"><a
        [href]="externalSystems?.instagram?.groupUrl" target="_blank"
        class="d-block p-1">
        <app-svg icon="i-instagram" width="24" height="24" [colour]="colour"/>
        <span class="visually-hidden">
          Visit our Instagram page (opens a new browser tag)
        </span>
      </a></li>
    }
    @if (externalSystems?.meetup) {
      <li class="mb-0" placement="top"
        [tooltip]="'View the '+ externalSystems?.meetup?.groupName + ' Meetup page (opens a new browser tab)'"><a
        [href]="externalSystems.meetup.groupUrl+'/'+externalSystems.meetup.groupName" target="_blank"
        class="d-block p-1">
        <app-svg icon="i-meetup" width="24" height="24" [colour]="colour"/>
        <span class="visually-hidden">
          Visit our {{ externalSystems?.meetup?.groupName }} Meetup page (opens a new browser tag)
        </span>
      </a></li>
    }
    </ul>`,
    styleUrls: ["./footer-icons.sass"],
    imports: [TooltipDirective, SvgComponent]
})
export class SocialMediaLinksComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialMediaLinksComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  public externalSystems: ExternalSystems;
  private subscriptions: Subscription[] = [];
  @Input()
  colour: string = rgbColourCloudy;
  @Input() width: number;

  ngOnInit(): void {
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.externalSystems = item.externalSystems));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
