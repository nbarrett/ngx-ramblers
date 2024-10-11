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
            <app-copy-icon [value]="displayedWalk.walk.postcode"
                           [elementName]="elementNameStart('Postcode')"></app-copy-icon>
            {{ elementNameStart('Postcode') }}
          </div>
          <div content>
            <span>{{ displayedWalk.walk.location }}</span>
            <a tooltip="Click to locate postcode {{displayedWalk.walk.postcode}} on Google Maps"
               [href]="googleMapsService.urlForPostcode(displayedWalk.walk.postcode)" target="_blank">
              {{ displayedWalk.walk.postcode }}</a>
          </div>
        </div>
        <div app-related-link [mediaWidth]="walkDetailsMediaWidth" *ngIf="displayedWalk.walk.gridReference"
             class="col-sm-6">
          <div title>
            <app-copy-icon [value]="displayedWalk.walk.gridReference"
                           [elementName]="elementNameStart('Grid Ref')"></app-copy-icon>
            {{ elementNameStart('Grid Ref') }}
          </div>
          <div content>
            <a content
               [href]="display.gridReferenceLink(displayedWalk.walk.gridReference)"
               tooltip="Click to locate grid reference {{displayedWalk.walk.gridReference}} on UK Grid Reference Finder"
               target="_blank">{{ displayedWalk.walk.gridReference }}</a></div>

        </div>
        <ng-container *ngIf="displayedWalk.showEndpoint">
          <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
            <div title>
              <app-copy-icon [value]="displayedWalk.walk.postcodeFinish"
                             [elementName]="'Finish Postcode'"></app-copy-icon>
              {{ elementNameFinish('Postcode') }}
            </div>
            <div content>
              <a tooltip="Click to locate finish postcode {{displayedWalk.walk.postcodeFinish}} on Google Maps"
                 [href]="googleMapsService.urlForPostcode(displayedWalk.walk.postcodeFinish)" target="_blank">
                {{ displayedWalk.walk.postcode }}</a>
            </div>
          </div>
          <div app-related-link [mediaWidth]="walkDetailsMediaWidth" *ngIf="displayedWalk.walk.gridReferenceFinish"
               class="col-sm-6">
            <div title>
              <app-copy-icon [value]="displayedWalk.walk.gridReferenceFinish"
                             [elementName]="'Finish Grid reference'"></app-copy-icon>
              {{ elementNameFinish('Grid Ref') }}
            </div>
            <div content>
              <a content
                 [href]="display.gridReferenceLink(displayedWalk.walk.gridReferenceFinish)"
                 tooltip="Click to locate finish grid reference {{displayedWalk.walk.gridReferenceFinish}} on UK Grid Reference Finder"
                 target="_blank">{{ displayedWalk.walk.gridReferenceFinish }}</a></div>
          </div>
        </ng-container>
        <div *ngIf="displayedWalk.walk.distance" app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
          <div title>
            <fa-icon [icon]="faRulerHorizontal" class="fa-icon mr-1"></fa-icon>
            Distance
            <strong class="ml-1">{{ distanceValidationService.walkDistances(displayedWalk.walk) }}</strong>
          </div>
        </div>
        <div *ngIf="displayedWalk.walk.grade" app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6">
          <div title>
            <fa-icon [icon]="faListCheck" class="fa-icon mr-1"></fa-icon>
            Grade
            <strong class="ml-1">{{ displayedWalk.walk.grade }}</strong>
          </div>
        </div>
        <div app-related-link [mediaWidth]="walkDetailsMediaWidth" class="col-sm-6" *ngIf="displayedWalk.walk.ascent">
          <div title>
            <fa-icon [icon]="faRulerVertical" class="fa-icon mr-3"></fa-icon>
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
