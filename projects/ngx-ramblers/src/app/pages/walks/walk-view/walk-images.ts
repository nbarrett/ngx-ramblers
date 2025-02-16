import { Component, inject, Input } from "@angular/core";
import { DisplayedWalk } from "../../../models/walk.model";
import { BasicMedia } from "../../../models/ramblers-walks-manager";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { SvgComponent } from "../../../modules/common/svg/svg";
import { NgClass } from "@angular/common";
import { CardImageComponent } from "../../../modules/common/card/image/card-image";

@Component({
    selector: "app-walk-images",
    template: `
    <div class="pointer" [tooltip]="imageSource()?.alt" [placement]="'bottom'">
      @if (displayedWalk?.walk?.media?.length > 1) {
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
      }
      <div [ngClass]="displayedWalk?.walk?.media?.length > 1 ? 'mt-2': 'mt-3'">
        <app-card-image fixedHeight [imageSource]="imageSource()?.url"/>
      </div>
    </div>`,
    styleUrls: ["./walk-view.sass"],
    imports: [TooltipDirective, SvgComponent, NgClass, CardImageComponent]
})

export class WalkImagesComponent {
  mediaQueryService = inject(MediaQueryService);


  @Input() displayedWalk: DisplayedWalk;
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
    return this.mediaQueryService.basicMediaFrom(this.displayedWalk.walk)[this.imageIndex];
  }

  next() {
    if (this.imageIndex < this.displayedWalk?.walk?.media?.length - 1) {
      this.imageIndex++;
    }
  }

}
