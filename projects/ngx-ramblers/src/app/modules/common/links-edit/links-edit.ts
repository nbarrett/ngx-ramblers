import { Component, Input, OnInit } from "@angular/core";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Link } from "../../../models/page.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { remove } from "lodash-es";

@Component({
  selector: "app-links-edit",
  templateUrl: "./links-edit.html",
})
export class LinksEditComponent implements OnInit {
  private logger: Logger;
  @Input() heading: string;
  @Input() links: Link[];

  faAdd = faAdd;

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(LinksEditComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed instance with page:", this.links);
  }

  createNew() {
    this.links.push({});
  }

  newEditInProgress(): boolean {
    return !!this.links.find(item => !item.title);
  }

  deleteLink(link: Link) {
    remove(this.links, link);
  }

}

