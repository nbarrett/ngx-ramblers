import { Component, Input, OnInit } from "@angular/core";
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Walk, WalkViewMode } from "../models/walk.model";
import { WalkDisplayService } from "../pages/walks/walk-display.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
    selector: "app-walk-panel-expander",
    template: `
    <div class="form-inline" [ngClass]="display.walkMode(walk)">
      @if (expandable) {
        <fa-icon (click)="expand()"
          placement="auto" [tooltip]="expandAction" [icon]="faCaretUp"
        class="markdown-preview-icon fa-2x"></fa-icon>
      }
      @if (collapsable) {
        <fa-icon placement="auto" [tooltip]="collapseAction"
          (click)="collapse()" [icon]="faCaretDown"
        class="fa-2x markdown-preview-icon ml-1"></fa-icon>
      }
    </div>`,
    styleUrls: ["./walk-panel-expander.sass"],
    imports: [NgClass, FontAwesomeModule, TooltipDirective]
})
export class WalkPanelExpanderComponent implements OnInit {

  public modes = WalkViewMode;
  faCaretUp = faCaretUp;
  faCaretDown = faCaretDown;

  @Input()
  walk: Walk;

  @Input()
  expandAction: string;
  @Input()
  collapseAction: string;

  @Input("expandable") set expandableValue(expandable: boolean) {
    this.expandable = coerceBooleanProperty(expandable);
  }

  @Input("collapsable") set collapsableValue(collapsable: boolean) {
    this.collapsable = coerceBooleanProperty(collapsable);
  }

  public collapsable: boolean;
  public expandable: boolean;
  private logger: Logger;

  constructor(public display: WalkDisplayService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkPanelExpanderComponent", NgxLoggerLevel.ERROR);
  }

  ngOnInit() {
    const viewMode = this.display.walkMode(this.walk);
    this.logger.info("ngOnInit: viewMode", viewMode);
    if (!this.collapseAction) {
      this.collapseAction = "collapse";
    }
    if (!this.expandAction) {
      this.expandAction = "expand";
    }
  }

  expand() {
    const viewMode = this.display.walkMode(this.walk);
    this.logger.info("expanding walk from current mode", viewMode);
    switch (viewMode) {
      case WalkViewMode.LIST:
        this.display.view(this.walk);
        break;
      case WalkViewMode.VIEW:
        this.display.toggleExpandedViewFor(this.walk, WalkViewMode.EDIT);
        break;
      case WalkViewMode.VIEW_SINGLE:
        this.display.editFullscreen(this.walk);
        break;
      case WalkViewMode.EDIT:
        this.display.editFullscreen(this.walk);
        break;
    }
  }

  collapse() {
    const viewMode = this.display.walkMode(this.walk);
    this.logger.info("collapsing walk from current mode", viewMode);
    if (viewMode === WalkViewMode.VIEW) {
      this.display.list(this.walk);
    } else if (viewMode === WalkViewMode.VIEW_SINGLE) {
      this.display.list(this.walk);
    } else if (viewMode === WalkViewMode.EDIT) {
      this.display.view(this.walk);
    } else if (viewMode === WalkViewMode.EDIT_FULL_SCREEN) {
      this.display.closeEditView(this.walk);
    }
  }
}
