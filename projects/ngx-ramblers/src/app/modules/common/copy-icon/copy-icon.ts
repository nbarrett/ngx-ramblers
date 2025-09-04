import { Component, inject, Input, OnInit } from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { ClipboardService } from "../../../services/clipboard.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-copy-icon",
    template: `
      @if (justCopied()) {
        <fa-icon container="body" [tooltip]="justCopied()? tooltipPostCopy:null"
                 [icon]="icon"
                 class="fa-icon fa-icon-copied mr-1 pointer"></fa-icon>
      } @else {
        <fa-icon container="body" [tooltip]="tooltipPreCopy"
                 (click)="copyToClipboard(value)" [icon]="icon"
                 class="fa-icon mr-1 pointer"></fa-icon>
      }
      <ng-content/>
    `,
    imports: [FontAwesomeModule, TooltipDirective]
})

export class CopyIconComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CopyIconComponent", NgxLoggerLevel.ERROR);
  private clipboardService = inject(ClipboardService);

  @Input("elementName") set acceptChangesFrom(elementName: string) {
    this.logger.debug("elementName:input", elementName);
    this.elementName = elementName;
    this.initialiseTooltips();
  }

  @Input()
  disabled: boolean;
  @Input()
  value: string;
  @Input()
  icon: IconDefinition;
  elementName: string;

  public tooltipPreCopy: string;
  public tooltipPostCopy: string;
  public copied: boolean;

  ngOnInit() {
    this.logger.debug("initialised with elementName", this.elementName, "value:", this.value);
    this.initialiseTooltips();
    this.icon = this.icon || faCopy;
  }

  private initialiseTooltips() {
    if (!this.disabled) {
      this.tooltipPreCopy = `Copy ${this.elementName} to clipboard`;
      this.tooltipPostCopy = `${this.elementName} has been copied to clipboard!`;
    }
  }

  copyToClipboard(text: string) {
    if (!this.disabled) {
      this.clipboardService.copyToClipboard(text);
      this.copied = true;
    }
  }

  justCopied(): boolean {
    return this.copied && this.clipboardService.clipboardText() === this.value;
  }

  hide(preClick: TooltipDirective, postClick: TooltipDirective) {
    this.logger.debug("hiding both tooltips", preClick, postClick);
    postClick.hide();
    preClick.hide();
  }
}
