import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { PageComponent } from "../../../page/page.component";
import { WalkDisplayService } from "../walk-display.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-walk-create",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, FontAwesomeModule],
  template: `
    <app-page autoTitle>
      @if (accessDenied) {
        <div class="alert alert-warning">
          <fa-icon [icon]="faTriangleExclamation"/>
          <strong class="ms-2">Walk not created</strong>
          <div class="mt-2">Your membership record does not currently allow you to create a walk. Please contact your
            walks co-ordinator, who can either create the walk for you or give you access.
          </div>
        </div>
      }
    </app-page>
  `
})
export class WalkCreate implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkCreate", NgxLoggerLevel.ERROR);
  private display = inject(WalkDisplayService);
  public accessDenied = false;
  protected readonly faTriangleExclamation = faTriangleExclamation;

  async ngOnInit(): Promise<void> {
    this.accessDenied = !this.display.memberCanCreateWalk();
    this.logger.info("ngOnInit:accessDenied:", this.accessDenied);
    if (!this.accessDenied) {
      await this.display.addMemberLedWalk();
    }
  }
}
