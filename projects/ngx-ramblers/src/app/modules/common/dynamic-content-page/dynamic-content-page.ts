import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { PageComponent } from "../../../page/page.component";
import { DynamicContentComponent } from "../dynamic-content/dynamic-content";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
    selector: "app-dynamic-content-page",
  template: `
    <app-page>
      <app-dynamic-content/>
    </app-page>
  `,
    styleUrls: ["./dynamic-content-page.sass"],
    imports: [PageComponent, DynamicContentComponent]
})
export class DynamicContentPageComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentPageComponent", NgxLoggerLevel.ERROR);

  ngOnInit() {
    this.logger.info("ngOnInit");
  }

  ngOnDestroy(): void {
  }

}
