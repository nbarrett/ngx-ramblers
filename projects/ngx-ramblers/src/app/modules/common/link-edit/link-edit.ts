import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faClose, faDownLong, faUpLong } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Link } from "../../../models/page.model";
import { move } from "../../../functions/arrays";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { NumberUtilsService } from "../../../services/number-utils.service";

@Component({
    selector: "app-link-edit",
    templateUrl: "./link-edit.html",
    imports: [FormsModule, TooltipDirective, FontAwesomeModule, NgClass]
})
export class LinkEditComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("LinkEditComponent", NgxLoggerLevel.ERROR);
  private numberUtilsService: NumberUtilsService = inject(NumberUtilsService);
  @Input() link: Link;
  @Input() links: Link[];
  @Output() delete: EventEmitter<Link> = new EventEmitter();
  uniqueId: string = this.numberUtilsService.generateUid();
  faClose = faClose;
  faDownLong = faDownLong;
  faUpLong = faUpLong;

  uniqueIdFor(prefix: string) {
    const uniqueIdFor = `${prefix}-${this.uniqueId}`;
    this.logger.debug("uniqueIdFor:", prefix, "returning:", uniqueIdFor);
    return uniqueIdFor;
  }

  ngOnInit() {
    this.logger.debug("constructed", this.uniqueId, "instance with link:", this.link);
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
