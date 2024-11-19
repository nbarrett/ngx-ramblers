import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../logger-factory.service";
import { Walk } from "../../models/walk.model";
import { WalksService } from "./walks.service";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { StringUtilsService } from "../string-utils.service";

@Injectable({
  providedIn: "root"
})
export class DataMigrationService {

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  protected walksService: WalksService = inject(WalksService);
  protected stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private display: WalkDisplayService = inject(WalkDisplayService);
  private logger = this.loggerFactory.createLogger("DataMigrationService", NgxLoggerLevel.INFO);
  private migrateActive = false;

  public async migrateWalkLocations(walks: Walk[]): Promise<any> {
    if (this.display.walkPopulationLocal() && this.migrateActive) {
      this.logger.info("migrating walk locations");
      const migratedWalks: Walk[] = walks.filter(walk => !walk?.start_location).map(walk => {
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
      if (migratedWalks.length > 0) {
        this.logger.info(this.stringUtilsService.pluraliseWithCount(migratedWalks.length, "walk location"), "require updating:", walks);
        return Promise.all(migratedWalks.map(migratedWalk => this.walksService.createOrUpdate(migratedWalk))).then((savedMigratedWalks) => this.logger.info("Migrated walk locations", savedMigratedWalks));
      } else {
        this.logger.info("No walk location require migrating");
        return Promise.resolve();
      }
    } else {
      this.logger.info("Walk location migration not required");
      return Promise.resolve();
    }
  }
}
