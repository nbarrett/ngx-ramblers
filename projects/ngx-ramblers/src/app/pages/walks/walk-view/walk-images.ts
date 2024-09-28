import { Component, Input } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { BasicMedia } from "../../../models/ramblers-walks-manager";

@Component({
  selector: "app-walk-images",
  template: `
    <div class="pointer">
      <ng-container *ngIf="displayedWalk?.walk?.media?.length > 1">
        <app-svg colour="rgb(155, 200, 171)" (click)="back()"
                 [disabled]="backDisabled()"
                 height="20"
                 icon="i-back-round"/>
        <span class="sr-only">Previous slide</span>
        <span class="px-2">Image {{ imageIndex + 1 }} of {{ displayedWalk?.walk?.media?.length }}</span>
        <app-svg colour="rgb(155, 200, 171)" (click)="next()"
                 [disabled]="forwardDisabled()"
                 height="20"
                 icon="i-forward-round"/>
        <span class="sr-only">Next slide</span>
      </ng-container>
      <div [ngClass]="displayedWalk?.walk?.media?.length > 1 ? 'mt-2': 'mt-3'">
        <app-card-image fixedHeight [imageSource]="imageSource()?.url"/>
      </div>
    </div>`,
  styleUrls: ["./walk-view.sass"],
})

export class WalkImagesComponent {

  @Input() displayedWalk: DisplayedWalk;
  private logger: Logger;

  constructor(
    public committeeQueryService: CommitteeQueryService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkImagesComponent", NgxLoggerLevel.INFO);
  }

  protected imageIndex = 0;

  back() {
    if (this.imageIndex > 0) {
      this.imageIndex--;
    }

  }

  backDisabled() {
    return this.imageIndex === 0;
  }

  forwardDisabled() {
    return this.imageIndex >= this.displayedWalk?.walk?.media?.length - 1;
  }

  imageSource(): BasicMedia {
    return this.committeeQueryService.imagesFromWalk(this.displayedWalk.walk)[this.imageIndex];
  }

  next() {
    if (this.imageIndex < this.displayedWalk?.walk?.media?.length - 1) {
      this.imageIndex++;
    }
  }
}
