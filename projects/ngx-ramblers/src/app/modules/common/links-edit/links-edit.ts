import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Link } from "../../../models/page.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { remove } from "lodash-es";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { LinkEditComponent } from "../link-edit/link-edit";

@Component({
    selector: "app-links-edit",
    templateUrl: "./links-edit.html",
    imports: [TooltipDirective, FontAwesomeModule, LinkEditComponent]
})
export class LinksEditComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("LinksEditComponent", NgxLoggerLevel.ERROR);
  @Input() heading: string;
  @Input() links: Link[];

  faAdd = faAdd;

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

