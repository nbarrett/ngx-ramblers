import { Component, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ImageTagDataService } from "../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { UrlService } from "../services/url.service";

@Component({
  selector: "app-carousel-story-navigator",
  templateUrl: "./carousel-story-navigator.component.html",
  styleUrls: ["./carousel-story-navigator.component.sass"]

})
export class CarouselStoryNavigatorComponent implements OnInit {
  private logger: Logger;

  constructor(public imageTagDataService: ImageTagDataService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CarouselStoryNavigatorComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

}
