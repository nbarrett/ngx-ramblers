import { Component, Input } from "@angular/core";
import { WALK_GRADES, WalkGrade } from "../../../models/walk.model";
import { RelatedLinkComponent } from "../../../modules/common/related-link/related-link.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
    selector: "app-walk-grading",
    template: `
    @if (walkGrade) {
      <div app-related-link placement="right" tooltip="Walk is graded as {{walkGrade.description}}">
        <img title class="grading-image"
          src="/assets/images/ramblers/gradings/{{walkGrade.image}}"
          alt="{{walkGrade.description}}"/>
        <div content>
          {{ grading }}
        </div>
      </div>
    }`,
    styleUrls: ["./walk-view.sass"],
    imports: [RelatedLinkComponent, TooltipDirective]
})

export class WalkGradingComponent {
  public grading: string;
  public walkGrade: WalkGrade;

  @Input("grading") set init(grading: string) {
    this.grading = grading;
    this.walkGrade = WALK_GRADES.find((grade) => grade.description.toLowerCase() === grading?.toLowerCase());
  }


}
