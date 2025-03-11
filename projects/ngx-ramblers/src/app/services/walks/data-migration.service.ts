import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../logger-factory.service";
import { Walk } from "../../models/walk.model";
import { WalksService } from "./walks.service";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { StringUtilsService } from "../string-utils.service";
import { DataQueryOptions } from "../../models/api-request.model";

@Injectable({
  providedIn: "root"
})
export class DataMigrationService {

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  protected walksService: WalksService = inject(WalksService);
  protected stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private display: WalkDisplayService = inject(WalkDisplayService);
  private logger = this.loggerFactory.createLogger("DataMigrationService", NgxLoggerLevel.ERROR);
  private migrateActive = true;
  private saveActive = true;

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

  public async migrateWalkLocations(walks: Walk[]): Promise<any> {
    if (this.display.walkPopulationLocal() && this.migrateActive) {
      this.logger.info("migrating walk locations");
      const pendingMigrationWalks: Walk[] = walks.filter(walk => walk.postcode && !walk?.start_location);
      this.logger.info("Given",this.stringUtilsService.pluraliseWithCount(walks.length, "walk location"), "walks:", walks, this.stringUtilsService.pluraliseWithCount(pendingMigrationWalks.length, "walk location"), "require updating:", pendingMigrationWalks);
      if (pendingMigrationWalks.length > 0) {
        const postMigrationWalks: Walk[] = pendingMigrationWalks.map(walk => {
          walk.start_location = {
            description: walk.nearestTown || walk.startLocation,
            grid_reference_10: walk.gridReference,
            grid_reference_6: null,
            grid_reference_8: null,
            latitude: null,
            longitude: null,
            postcode: walk.postcode,
            w3w: walk.startLocationW3w,
          };
          walk.end_location = {
            description: null,
            grid_reference_10: walk.gridReferenceFinish,
            grid_reference_6: null,
            grid_reference_8: null,
            latitude: null,
            longitude: null,
            postcode: walk.postcodeFinish,
            w3w: null,
          };
          return walk;
        });
        return Promise.all(postMigrationWalks.map(migratedWalk => {
          return this.saveActive ? this.walksService.createOrUpdate(migratedWalk) : Promise.resolve(migratedWalk);
        })).then((savedMigratedWalks) => this.logger.info("Migrated walk locations", savedMigratedWalks));
      } else {
        this.logger.info("No walk locations require migrating");
        return Promise.resolve();
      }
    } else {
      this.logger.info("Walk location migration not required for:", walks);
      return Promise.resolve();
    }
  }
}
