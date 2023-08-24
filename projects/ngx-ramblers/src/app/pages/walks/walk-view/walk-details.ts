import { Component, Input, OnInit } from "@angular/core";
import { faListCheck, faPersonWalkingArrowLoopLeft, faPersonWalkingDashedLineArrowRight, faRulerVertical } from "@fortawesome/free-solid-svg-icons";
import { faRulerHorizontal } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayedWalk } from "../../../models/walk.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AscentValidationService } from "../../../services/walks/ascent-validation.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-walk-details",
  templateUrl: "./walk-details.html",
})

export class WalkDetailsComponent implements OnInit {
  private logger: Logger;
  @Input()
  public displayedWalk: DisplayedWalk;
  public walkDetailsMediaWidth = 70;
  protected readonly faPersonWalkingDashedLineArrowRight = faPersonWalkingDashedLineArrowRight;
  protected readonly faPersonWalkingArrowLoopLeft = faPersonWalkingArrowLoopLeft;
  protected readonly faRulerHorizontal = faRulerHorizontal;
  protected readonly faRulerVertical = faRulerVertical;
  protected readonly faListCheck = faListCheck;

  constructor(
    public googleMapsService: GoogleMapsService,
    public distanceValidationService: DistanceValidationService,
    public ascentValidationService: AscentValidationService,
    private memberLoginService: MemberLoginService,
    public display: WalkDisplayService,
    private dateUtils: DateUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkDetailsComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

  elementNameStart(elementName: string) {
    return `${this.displayedWalk.showEndpoint ? "Start " : ""}${elementName}`;
  }

  elementNameFinish(elementName: string) {
    return `${this.displayedWalk.showEndpoint ? "Finish " : ""}${elementName}`;
  }

}
