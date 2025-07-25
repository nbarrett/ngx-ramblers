import { Component, inject, Input, OnInit } from "@angular/core";
import {
  faPeopleGroup,
  faPersonWalkingArrowLoopLeft,
  faPersonWalkingDashedLineArrowRight,
  faRulerHorizontal,
  faRulerVertical
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayedWalk, WalkType } from "../../../models/walk.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AscentValidationService } from "../../../services/walks/ascent-validation.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { WalkGradingComponent } from "./walk-grading";
import { MarkdownComponent } from "ngx-markdown";
import { enumValueForKey } from "../../../functions/enums";

@Component({
    selector: "app-walk-details",
    template: `
      <div class="event-panel rounded">
        <h1>
          <fa-icon class="{{display.eventType(displayedWalk.walk)}}"
                   tooltip="{{stringUtils.asTitle(displayedWalk.walk?.groupEvent?.item_type)}}" adaptivePosition
                   [icon]="display.isWalk(displayedWalk.walk)? displayedWalk.showEndpoint? faPersonWalkingDashedLineArrowRight: faPersonWalkingArrowLoopLeft: faPeopleGroup"/>
          <fa-icon [icon]=""
                   class="fa-icon mr-2"/>
          {{ display.isWalk(displayedWalk.walk) ? enumValueForKey(WalkType, displayedWalk.walk?.groupEvent?.shape) : null }}
          {{ display.eventTypeTitle(displayedWalk.walk) }}
          {{ display.isWalk(displayedWalk.walk) ? 'Starting Point &' : '' }} Details
        </h1>
        <div class="row">
          <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
            <div title>
              <app-copy-icon [value]="displayedWalk?.walk?.groupEvent?.start_location?.postcode"
                             [elementName]="elementNameStart('Postcode')"/>
              {{ elementNameStart('Postcode') }}
            </div>
            <div content>
              <a
                tooltip="Click to locate postcode {{displayedWalk?.walk?.groupEvent?.start_location?.postcode}} on Google Maps"
                [href]="googleMapsService.urlForPostcode(displayedWalk?.walk?.groupEvent?.start_location?.postcode)"
                target="_blank">
                {{ displayedWalk?.walk?.groupEvent?.start_location?.postcode }}</a>
            </div>
          </div>
          @if (display.gridReferenceFrom(displayedWalk.walk?.groupEvent?.start_location)) {
            <div app-related-link [mediaWidth]="walkDetailsMediaWidth"
                 class="col-sm-6">
              <div title>
                <app-copy-icon [value]="display.gridReferenceFrom(displayedWalk.walk?.groupEvent?.start_location)"
                               [elementName]="elementNameStart('Grid Ref')"></app-copy-icon>
                Grid Ref
              </div>
              <div content>
                <a content
                   [href]="display.gridReferenceLink(display.gridReferenceFrom(displayedWalk.walk?.groupEvent?.start_location))"
                   tooltip="Click to locate grid reference {{display.gridReferenceFrom(displayedWalk.walk?.groupEvent?.start_location)}} on UK Grid Reference Finder"
                   target="_blank">{{ display.gridReferenceFrom(displayedWalk.walk?.groupEvent?.start_location) }}</a>
              </div>
            </div>
          }
          @if (displayedWalk.showEndpoint) {
            <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
              <div title>
                <app-copy-icon [value]="displayedWalk?.walk?.groupEvent?.end_location?.postcode"
                               [elementName]="'Finish Postcode'"/>
                {{ elementNameFinish('Postcode') }}
              </div>
              <div content>
                <a
                  tooltip="Click to locate finish postcode {{displayedWalk?.walk?.groupEvent?.end_location?.postcode}} on Google Maps"
                  [href]="googleMapsService.urlForPostcode(displayedWalk?.walk?.groupEvent?.end_location?.postcode)"
                  target="_blank">
                  {{ displayedWalk?.walk?.groupEvent?.end_location?.postcode }}</a>
              </div>
            </div>
            @if (display.gridReferenceFrom(displayedWalk?.walk?.groupEvent?.end_location)) {
              <div app-related-link [mediaWidth]="walkDetailsMediaWidth"
                   class="col-sm-6">
                <div title>
                  <app-copy-icon [value]="display.gridReferenceFrom(displayedWalk?.walk?.groupEvent?.end_location)"
                                 [elementName]="'Finish Grid reference'"/>
                  Grid Ref
                </div>
                <div content>
                  <a content
                     [href]="display.gridReferenceLink(display.gridReferenceFrom(displayedWalk?.walk?.groupEvent?.end_location))"
                     tooltip="Click to locate finish grid reference {{display.gridReferenceFrom(displayedWalk?.walk?.groupEvent?.end_location)}} on UK Grid Reference Finder"
                     target="_blank">{{ display.gridReferenceFrom(displayedWalk?.walk?.groupEvent?.end_location) }}</a>
                </div>
              </div>
            }
          }
          @if (displayedWalk.walk?.groupEvent?.distance_miles) {
            <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
              <div title>
                <fa-icon [icon]="faRulerHorizontal" class="fa-icon mr-1"/>
                Distance
                <strong class="ml-1">{{ distanceValidationService.walkDistances(displayedWalk.walk) }}</strong>
              </div>
            </div>
          }
          @if (displayedWalk.walk?.groupEvent?.difficulty) {
            <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
              <div title>
                <strong>
                  <app-walk-grading [grading]="displayedWalk.walk?.groupEvent?.difficulty.code"/>
                </strong>
              </div>
            </div>
          }
          @if (displayedWalk.walk?.groupEvent?.ascent_feet) {
            <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
              <div title>
                <fa-icon [icon]="faRulerVertical" class="fa-icon mr-3"/>
                Ascent
                <strong class="ml-1">{{ ascentValidationService.walkAscents(displayedWalk.walk) }}</strong>
              </div>
            </div>
          }
          @if (displayedWalk?.walk?.groupEvent?.start_location?.description) {
            <div class="col-sm-12 mt-2 list-tick-medium">
              <p markdown>**Start Location**</p>
              <p markdown>{{ displayedWalk?.walk?.groupEvent?.start_location?.description }}</p>
            </div>
          }
          @if (displayedWalk?.walk?.groupEvent?.event_organiser?.name) {
            <div class="col-sm-12 mt-1 list-tick-medium">
              <p markdown>**Organiser**: {{ displayedWalk.walk?.groupEvent?.event_organiser.name }}</p>
            </div>
          }
          @if (displayedWalk?.walk?.groupEvent?.additional_details) {
            <div class="col-sm-12 mt-1 list-tick-medium">
              <p markdown>**Additional Details** {{ displayedWalk.walk?.groupEvent?.additional_details }}</p>
            </div>
          }
        </div>
      </div>`,
    imports: [FontAwesomeModule, TooltipDirective, RelatedLinkComponent, CopyIconComponent, WalkGradingComponent, MarkdownComponent]
})

export class WalkDetailsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkDetailsComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  distanceValidationService = inject(DistanceValidationService);
  ascentValidationService = inject(AscentValidationService);
  display = inject(WalkDisplayService);
  protected stringUtils = inject(StringUtilsService);
  @Input()
  public displayedWalk: DisplayedWalk;
  public walkDetailsMediaWidth = 70;
  protected readonly faPersonWalkingDashedLineArrowRight = faPersonWalkingDashedLineArrowRight;
  protected readonly faPersonWalkingArrowLoopLeft = faPersonWalkingArrowLoopLeft;
  protected readonly faRulerHorizontal = faRulerHorizontal;
  protected readonly faRulerVertical = faRulerVertical;
  protected readonly faPeopleGroup = faPeopleGroup;
  protected readonly enumValueForKey = enumValueForKey;
  protected readonly WalkType = WalkType;

  ngOnInit() {
    this.logger.info("ngOnInit", this.displayedWalk);
  }

  elementNameStart(elementName: string) {
    return `${this.displayedWalk.showEndpoint ? "Start " : ""}${elementName}`;
  }

  elementNameFinish(elementName: string) {
    return `${this.displayedWalk.showEndpoint ? "Finish " : ""}${elementName}`;
  }
}
