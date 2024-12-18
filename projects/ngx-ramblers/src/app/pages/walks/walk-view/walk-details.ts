import { Component, Input, OnInit } from "@angular/core";
import {
  faListCheck,
  faPeopleGroup,
  faPersonWalkingArrowLoopLeft,
  faPersonWalkingDashedLineArrowRight,
  faRulerHorizontal,
  faRulerVertical
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayedWalk } from "../../../models/walk.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AscentValidationService } from "../../../services/walks/ascent-validation.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-walk-details",
  template: `
    <div class="event-panel rounded">
      <h1>
        <fa-icon class="{{display.eventType(displayedWalk.walk)}}"
                 tooltip="{{stringUtils.asTitle(displayedWalk.walk.eventType)}}" adaptivePosition
                 [icon]="display.isWalk(displayedWalk.walk)? displayedWalk.showEndpoint? faPersonWalkingDashedLineArrowRight: faPersonWalkingArrowLoopLeft: faPeopleGroup"/>
        <fa-icon [icon]=""
                 class="fa-icon mr-2"/>
        {{ display.isWalk(displayedWalk.walk) ? displayedWalk.walk.walkType : null }}
        {{ display.eventTypeTitle(displayedWalk.walk) }}
        {{ display.isWalk(displayedWalk.walk) ? 'Starting Point &' : '' }} Details
      </h1>
      <ng-container *ngIf="!display.shouldShowFullDetails(displayedWalk)">
        <div class="col-sm-12">
          <p>{{ displayedWalk?.latestEventType?.description }}</p>
        </div>
      </ng-container>
      <div *ngIf="display.shouldShowFullDetails(displayedWalk)" class="row">
        <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
          <div title>
            <app-copy-icon [value]="displayedWalk?.walk?.start_location?.postcode"
                           [elementName]="elementNameStart('Postcode')"/>
            {{ elementNameStart('Postcode') }}
          </div>
          <div content>
            <a tooltip="Click to locate postcode {{displayedWalk?.walk?.start_location?.postcode}} on Google Maps"
               [href]="googleMapsService.urlForPostcode(displayedWalk?.walk?.start_location?.postcode)" target="_blank">
              {{ displayedWalk?.walk?.start_location?.postcode }}</a>
          </div>
        </div>
        <div app-related-link [mediaWidth]="walkDetailsMediaWidth"
             *ngIf="display.gridReferenceFrom(displayedWalk.walk.start_location)"
             class="col-sm-6">
          <div title>
            <app-copy-icon [value]="display.gridReferenceFrom(displayedWalk.walk.start_location)"
                           [elementName]="elementNameStart('Grid Ref')"></app-copy-icon>
            Grid Ref
          </div>
          <div content>
            <a content
               [href]="display.gridReferenceLink(display.gridReferenceFrom(displayedWalk.walk.start_location))"
               tooltip="Click to locate grid reference {{display.gridReferenceFrom(displayedWalk.walk.start_location)}} on UK Grid Reference Finder"
               target="_blank">{{ display.gridReferenceFrom(displayedWalk.walk.start_location) }}</a></div>

        </div>
        <ng-container *ngIf="displayedWalk.showEndpoint">
          <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
            <div title>
              <app-copy-icon [value]="displayedWalk?.walk?.end_location?.postcode"
                             [elementName]="'Finish Postcode'"/>
              {{ elementNameFinish('Postcode') }}
            </div>
            <div content>
              <a
                tooltip="Click to locate finish postcode {{displayedWalk?.walk?.end_location?.postcode}} on Google Maps"
                [href]="googleMapsService.urlForPostcode(displayedWalk?.walk?.end_location?.postcode)" target="_blank">
                {{ displayedWalk?.walk?.end_location?.postcode }}</a>
            </div>
          </div>
          <div app-related-link [mediaWidth]="walkDetailsMediaWidth"
               *ngIf="display.gridReferenceFrom(displayedWalk?.walk?.end_location)"
               class="col-sm-6">
            <div title>
              <app-copy-icon [value]="display.gridReferenceFrom(displayedWalk?.walk?.end_location)"
                             [elementName]="'Finish Grid reference'"/>
              Grid Ref
            </div>
            <div content>
              <a content
                 [href]="display.gridReferenceLink(display.gridReferenceFrom(displayedWalk?.walk?.end_location))"
                 tooltip="Click to locate finish grid reference {{display.gridReferenceFrom(displayedWalk?.walk?.end_location)}} on UK Grid Reference Finder"
                 target="_blank">{{ display.gridReferenceFrom(displayedWalk?.walk?.end_location) }}</a></div>
          </div>
        </ng-container>
        <div *ngIf="displayedWalk.walk.distance" app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
          <div title>
            <fa-icon [icon]="faRulerHorizontal" class="fa-icon mr-1"/>
            Distance
            <strong class="ml-1">{{ distanceValidationService.walkDistances(displayedWalk.walk) }}</strong>
          </div>
        </div>
        <div *ngIf="displayedWalk.walk.grade" app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
          <div title>
            <fa-icon [icon]="faListCheck" class="fa-icon mr-1"/>
            Grade
            <strong class="ml-1">{{ displayedWalk.walk.grade }}</strong>
          </div>
        </div>
        <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6" *ngIf="displayedWalk.walk.ascent">
          <div title>
            <fa-icon [icon]="faRulerVertical" class="fa-icon mr-3"/>
            Ascent
            <strong class="ml-1">{{ ascentValidationService.walkAscents(displayedWalk.walk) }}</strong>
          </div>
        </div>
        <div *ngIf="displayedWalk?.walk?.startLocation"
             class="col-sm-12 mt-1">{{ displayedWalk?.walk?.startLocation }}
        </div>
        <div *ngIf="displayedWalk?.walk?.organiser" class="col-sm-12 mt-1 list-tick-medium">
          <p markdown>**Organiser**: {{ displayedWalk.walk.organiser }}</p>
        </div>
        <div *ngIf="displayedWalk?.walk?.additionalDetails" class="col-sm-12 mt-1 list-tick-medium">
          <p markdown>**Additional Details**: {{ displayedWalk.walk.additionalDetails }}</p>
        </div>
      </div>
    </div>`
})

export class WalkDetailsComponent implements OnInit {

  constructor(
    public googleMapsService: GoogleMapsService,
    public distanceValidationService: DistanceValidationService,
    public ascentValidationService: AscentValidationService,
    public display: WalkDisplayService,
    protected stringUtils: StringUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkDetailsComponent", NgxLoggerLevel.OFF);
  }
  private logger: Logger;
  @Input()
  public displayedWalk: DisplayedWalk;
  public walkDetailsMediaWidth = 70;
  protected readonly faPersonWalkingDashedLineArrowRight = faPersonWalkingDashedLineArrowRight;
  protected readonly faPersonWalkingArrowLoopLeft = faPersonWalkingArrowLoopLeft;
  protected readonly faRulerHorizontal = faRulerHorizontal;
  protected readonly faRulerVertical = faRulerVertical;
  protected readonly faListCheck = faListCheck;

  protected readonly faPeopleGroup = faPeopleGroup;

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
