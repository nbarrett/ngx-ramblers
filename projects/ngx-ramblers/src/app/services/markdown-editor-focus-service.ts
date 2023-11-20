import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class MarkdownEditorFocusService {
  private logger: Logger;

  private focussedEditorInstance: object[] = [];

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MarkdownEditorFocusService, NgxLoggerLevel.OFF);
  }

  setFocusTo(editorInstance: object) {
    if (!this.hasFocus(editorInstance)) {
      this.logger.info("setting focus on:", editorInstance);
      this.focussedEditorInstance.push(editorInstance);
    }

  }

  hasFocus(editorInstance: object): boolean {
    return this.focussedEditorInstance.includes(editorInstance);
  }

  clearFocus(editorInstance: object) {
    this.logger.info("clearing focus on:", editorInstance);
    this.focussedEditorInstance = this.focussedEditorInstance.filter(item => item !== editorInstance);
  }
}
