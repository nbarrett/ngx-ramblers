import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { FileUtilsService } from "../file-utils.service";
import { UrlService } from "../services/url.service";
import { LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
    selector: "app-link",
    template: `<a [href]="href" target="{{target}}">{{ linkText }}</a>`
})
export class LinkComponent implements OnInit, OnChanges {

  @Input() name: string;
  @Input() text: string;
  @Input() subArea: string;
  @Input() id: string;
  @Input() area: string;
  @Input() target: string;
  @Input() relative: boolean;

  public href: string;

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("LinkComponent", NgxLoggerLevel.OFF);
  private urlService: UrlService = inject(UrlService);
  private fileUtils: FileUtilsService = inject(FileUtilsService);
  public linkText: string;

  ngOnInit() {
    this.updateLink();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.updateLink();
  }

  private updateLink() {
    this.target = this.target || "_blank";
    this.href = this.urlService.linkUrl({
      relative: this.relative,
      name: this.name,
      area: this.area,
      subArea: this.subArea,
      id: this.id
    });
    this.linkText = this.urlService.linkText({
      href: this.href,
      text: this.text,
      name: this.fileUtils.basename(this.name)
    });
    this.logger.info("updateLink", "name:", this.name, "text:", this.text, "subArea:", this.subArea, "id:", this.id, "area:", this.area, "target:", this.target, "relative:", this.relative, "href:", this.href, "-> linkText:", this.linkText);
  }
}
