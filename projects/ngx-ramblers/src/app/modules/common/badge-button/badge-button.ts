import { Component, inject, Input } from "@angular/core";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass, NgStyle } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-badge-button,[app-badge-button]",
    template: `
      <div [ngClass]="{'badge-button': !inline, 'inline-button':inline, 'disabled' : disabled,
              'me-0': noRightMargin, 'badge-button-active': active, 'w-100': fullWidth, 'float-end': alignRight}"
        delay=500 tooltip="{{tooltip? null: caption}}" [ngStyle]="{'height.px': height}">
        @if (!iconPositionRight) {
          <fa-icon [icon]="icon"></fa-icon>
        }
        @if (caption) {
          <span>{{caption}}</span>
        }
        <ng-content/>
        @if (iconPositionRight) {
          <fa-icon class="ms-2" [icon]="icon"></fa-icon>
        }
      </div>`,
    imports: [NgClass, TooltipDirective, NgStyle, FontAwesomeModule]
})

export class BadgeButtonComponent {
  siteEditService = inject(SiteEditService);
  actions = inject(PageContentActionsService);


  @Input() public tooltip: string;
  @Input() public caption: string;
  @Input() public height: number;

  @Input("iconPositionRight") set iconPositionRightValue(value: boolean) {
    this.iconPositionRight = coerceBooleanProperty(value);
  }

  @Input("alignRight") set alignRightValue(value: boolean) {
    this.alignRight = coerceBooleanProperty(value);
  }

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("noRightMargin") set noRightMarginValue(value: boolean) {
    this.noRightMargin = coerceBooleanProperty(value);
  }

  @Input("inline") set inlineValue(value: boolean) {
    this.inline = coerceBooleanProperty(value);
  }

  @Input("fullWidth") set fullwidthValue(value: boolean) {
    this.fullWidth = coerceBooleanProperty(value);
  }

  @Input("active") set activeValue(value: boolean) {
    this.active = coerceBooleanProperty(value);
  }

  @Input() public icon: IconDefinition;

  public alignRight: boolean;
  public disabled: boolean;
  public active: boolean;
  public noRightMargin: boolean;
  public fullWidth: boolean;
  public inline: boolean;
  public iconPositionRight: boolean;

}

