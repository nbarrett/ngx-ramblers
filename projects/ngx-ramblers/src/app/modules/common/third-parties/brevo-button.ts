import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-brevo-button",
  template: `
    <div class="form-inline">
      <img title class="related-links-image"
           src="/assets/images/local/brevo.ico"
           alt="{{title}}"/>
      <a *ngIf="!disabled" tooltip="Click to {{title}}"
         target="_blank"
         class="ml-2"
         [href]="href">
        {{ title }}
      </a>
      <div *ngIf="disabled" class="disabled ml-2">{{title}}</div>
    </div>`
})

export class BrevoButtonComponent implements OnInit {

  private logger: Logger;
  public disabled: boolean;
  @Input() href: string;
  @Input() title: string;
  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BrevoButtonComponent, NgxLoggerLevel.INFO);
  }

  ngOnInit(): void {
    this.logger.info("initialised with href", this.href, "title:", this.title, "disabled:", this.disabled);
  }
}
