import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { faClose, faDownLong, faUpLong } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Link } from "../../../models/page.model";
import { move } from "../../../functions/arrays";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

let uniqueId = 0;

@Component({
  selector: "app-link-edit",
  templateUrl: "./link-edit.html",
  standalone: false
})
export class LinkEditComponent implements OnInit {
  private logger: Logger;
  @Input() link: Link;
  @Input() links: Link[];
  @Output() delete: EventEmitter<Link> = new EventEmitter();

  faClose = faClose;
  faDownLong = faDownLong;
  faUpLong = faUpLong;

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(LinkEditComponent, NgxLoggerLevel.OFF);
  }

  uniqueIdFor(prefix: string) {
    const uniqueIdFor = `${prefix}-${uniqueId}`;
    this.logger.debug("uniqueIdFor:", prefix, "returning:", uniqueIdFor);
    return uniqueIdFor;
  }

  ngOnInit() {
    uniqueId = uniqueId++;
    this.logger.debug("constructed", uniqueId, "instance with link:", this.link);
  }

  deleteLink() {
    this.delete.next(this.link);
  }

  private move(currentIndex: number, indexIncrease: number): void {
    const toIndex = currentIndex + indexIncrease;
    this.logger.info("before:move", this.links, "currentIndex:", currentIndex, "toIndex:", toIndex);
    this.links = move(this.links, currentIndex, toIndex);
    this.logger.info("after:move", this.links);
  }

  moveUp() {
    const currentIndex = this.links.indexOf(this.link);
    if (currentIndex > 0) {
      this.move(currentIndex, -1);
      this.logger.info("moved up item with index", currentIndex, "to", currentIndex + 1, "for item", this.link, "in total of", this.links.length, "links");
    } else {
      this.logger.warn("cant move up item", currentIndex);
    }
  }

  moveDown() {
    const currentIndex = this.links.indexOf(this.link);
    if (currentIndex < this.links.length - 1) {
      this.move(currentIndex, 1);
      this.logger.info("moved down item with index", currentIndex, "to", currentIndex - 1, "for item", this.link, "in total of", this.links.length, "links");
    } else {
      this.logger.warn("cant move down item", currentIndex);
    }
  }

  buttonClass(enabledIf: any) {
    return !!enabledIf ? "badge-button" : "badge-button disabled";
  }
}
