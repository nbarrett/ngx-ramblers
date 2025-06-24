import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { GroupEvent } from "../models/group-event.model";
import { Metadata } from "../models/ramblers-walks-manager";
import { sortBy } from "../functions/arrays";

@Injectable({
  providedIn: "root"
})
export class FeaturesService {

  private logger: Logger = inject(LoggerFactory).createLogger("FeaturesService", NgxLoggerLevel.ERROR);

  public combinedFeatures(groupEvent: GroupEvent): Metadata[] {
    return (groupEvent?.facilities || []).concat(groupEvent?.transport || []).concat(groupEvent?.accessibility || []).sort(sortBy("description"));
  }

}
