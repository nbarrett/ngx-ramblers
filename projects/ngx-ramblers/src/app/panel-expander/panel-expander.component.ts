import { Component, Input, OnInit } from "@angular/core";
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Walk, WalkViewMode } from "../models/walk.model";
import { WalkDisplayService } from "../pages/walks/walk-display.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";

@Component({
  selector: "app-panel-expander",
  templateUrl: "./panel-expander.component.html",
  styleUrls: ["./panel-expander.component.sass"]
})
export class PanelExpanderComponent implements OnInit {

  public modes = WalkViewMode;
  faCaretUp = faCaretUp;
  faCaretDown = faCaretDown;

  @Input()
  walk: Walk;
  @Input()
  expandable: boolean;
  @Input()
  collapsable: boolean;
  @Input()
  expandAction: string;
  @Input()
  collapseAction: string;

  private logger: Logger;

  constructor(public display: WalkDisplayService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PanelExpanderComponent, NgxLoggerLevel.OFF);
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
    this.logger.debug("collapsing walk from current mode", viewMode);
    if (viewMode === WalkViewMode.VIEW) {
      this.display.list(this.walk);
    } else if (viewMode === WalkViewMode.EDIT) {
      this.display.view(this.walk);
    } else if (viewMode === WalkViewMode.EDIT_FULL_SCREEN) {
      this.display.closeEditView(this.walk);
    }
  }
}
