import { Component, inject, Input } from "@angular/core";
import { WalkGrade } from "../../../models/walk.model";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { WalkDisplayService } from "../walk-display.service";

@Component({
    selector: "app-walk-grading",
    template: `
      @if (walkGrade?.code) {
        <div app-related-link placement="right" tooltip="Walk is graded as {{walkGrade?.description}}">
          <img title class="grading-image"
               src="/assets/images/ramblers/gradings/{{walkGrade?.image}}"
               alt="{{walkGrade?.description}}"/>
          <div content>
            {{ grading }}
          </div>
        </div>
      }`,
    styleUrls: ["./walk-view.sass"],
  imports: [RelatedLinkComponent, TooltipDirective]
})

export class WalkGradingComponent {
  private walkDisplayService: WalkDisplayService = inject(WalkDisplayService);
  public grading: string;
  public walkGrade: WalkGrade;
  private logger: Logger = inject(LoggerFactory).createLogger("WalkGradingComponent", NgxLoggerLevel.ERROR);

  @Input("grading") set init(grading: string) {
    this.grading = grading;
    this.walkGrade = this.walkDisplayService.walkGradeFrom(grading);
    this.logger.info("grading:", grading, "walkGrade:", this.walkGrade);
  }


}
