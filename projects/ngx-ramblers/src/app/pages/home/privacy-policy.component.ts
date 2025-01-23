import { Component, OnInit } from "@angular/core";
import { UrlService } from "../../services/url.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageComponent } from "../../page/page.component";
import { MarkdownEditorComponent } from "../../markdown-editor/markdown-editor.component";

@Component({
    selector: "app-privacy-policy-us",
    templateUrl: "./privacy-policy.component.html",
    imports: [PageComponent, MarkdownEditorComponent]
})
export class PrivacyPolicyComponent implements OnInit {
  private logger: Logger;

  constructor(private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PrivacyPolicyComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
  }

}
