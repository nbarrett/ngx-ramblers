import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../logger-factory.service";
import { Walk } from "../../models/walk.model";
import { WalksService } from "./walks.service";
import { StringUtilsService } from "../string-utils.service";
import { DataQueryOptions } from "../../models/api-request.model";

@Injectable({
  providedIn: "root"
})
export class DataMigrationService {

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  protected walksService: WalksService = inject(WalksService);
  protected stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private logger = this.loggerFactory.createLogger("DataMigrationService", NgxLoggerLevel.ERROR);

  public async updateOsMapsRoute(): Promise<Walk[]> {
    const criteria = {osMapsRoute: {$regex: "https://osmaps.ordnancesurvey.co.uk"}};
    const update = [
      {
        $set: {
          osMapsRoute: {
            $replaceOne: {
              input: "$osMapsRoute",
              find: "https://osmaps.ordnancesurvey.co.uk",
              replacement: "https://explore.osmaps.com"
            }
          }
        }
      }
    ];
    const dataQueryOptions: DataQueryOptions = {criteria, update};
    this.logger.info("updateOsMapsRoute called with dataQueryOptions:", dataQueryOptions);
    try {
      const updatedWalks = await this.walksService.updateMany(dataQueryOptions);
      this.logger.info("updateOsMapsRoute: updated documents:", updatedWalks);
      return updatedWalks;
    } catch (error) {
      this.logger.error("updateOsMapsRoute: error:", error);
      throw error;
    }
  }

}
