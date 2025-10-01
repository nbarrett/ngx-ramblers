import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Link } from "../../../models/page.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { remove } from "es-toolkit/compat";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { LinkEditComponent } from "../link-edit/link-edit";

@Component({
    selector: "app-links-edit",
    template: `
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">{{ heading }} ({{ links.length }})</div>
        <div class="col-sm-12">
          @if (!newEditInProgress()) {
            <div class="badge-button mb-2" (click)="createNew()"
                 delay=500 tooltip="Add new link">
              <fa-icon [icon]="faAdd"></fa-icon>
              <span>add link</span>
            </div>
          }
          <div class="col-sm-12">
            <div class="row g-2">
              <div class="col-md-3">
                <label>Web Url</label>
              </div>
              <div class="col-md-3">
                <label>Title</label>
              </div>
              <div class="col-md-3">
                <label>Actions</label>
              </div>
              <div class="col-md-3">
                <label>Link Preview</label>
              </div>
            </div>
            @for (link of links; track link.href) {
              <app-link-edit [link]="link" [links]="links" (delete)="deleteLink($event)"/>
            }
          </div>
        </div>
        <ng-content/>
      </div>
    `,
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

