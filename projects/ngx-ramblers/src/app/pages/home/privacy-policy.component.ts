import { Component, inject, OnInit } from "@angular/core";
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

  private logger: Logger = inject(LoggerFactory).createLogger("PrivacyPolicyComponent", NgxLoggerLevel.ERROR);

  ngOnInit() {
    this.logger.debug("ngOnInit");
  }

}
