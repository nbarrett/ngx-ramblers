import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { BookingConfig, BOOKING_EVENT_TYPES } from "../../models/booking-config.model";
import { ConfigKey } from "../../models/config.model";
import { WalksConfig } from "../../models/walk-notification.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class BookingConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("BookingConfigService", NgxLoggerLevel.ERROR);
  private config = inject(ConfigService);
  private broadcastService = inject<BroadcastService<BookingConfig>>(BroadcastService);
  private subject = new ReplaySubject<BookingConfig>();
  private cachedBookingConfig: BookingConfig;

  constructor() {
    this.refresh();
  }

  async refresh() {
    this.logger.info("refresh query:started");
    const cachedBookingConfig = await this.getConfig();
    this.cacheAndNotify(cachedBookingConfig);
  }

  private cacheAndNotify(bookingConfig: BookingConfig) {
    this.cachedBookingConfig = this.normalise(bookingConfig);
    this.logger.info("notifying bookingConfig subscribers with:", this.cachedBookingConfig);
    this.subject.next(this.cachedBookingConfig);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.BOOKING_CONFIG_LOADED, this.cachedBookingConfig));
  }

  private async getConfig(): Promise<BookingConfig> {
    const [bookingConfig, walksConfig] = await Promise.all([
      this.config.queryConfig<BookingConfig>(ConfigKey.BOOKING, null),
      this.config.queryConfig<WalksConfig>(ConfigKey.WALKS, null)
    ]);
    const legacyBookingConfig = (walksConfig as WalksConfig & { booking?: BookingConfig })?.booking || null;
    return this.mergeWithLegacy(bookingConfig, legacyBookingConfig);
  }

  saveConfig(config: BookingConfig) {
    return this.config.saveConfig<BookingConfig>(ConfigKey.BOOKING, this.normalise(config)).then((savedConfig: any) => this.cacheAndNotify(savedConfig.value));
  }

  bookingConfig(): BookingConfig {
    return this.cachedBookingConfig;
  }

  events(): Observable<BookingConfig> {
    return this.subject.pipe(shareReplay());
  }

  private normalise(config: BookingConfig): BookingConfig {
    return {
      ...this.default(),
      ...config,
      enabledForEventTypes: config?.enabledForEventTypes?.length > 0 ? config.enabledForEventTypes : BOOKING_EVENT_TYPES
    };
  }

  private mergeWithLegacy(config: BookingConfig | null, legacyConfig: BookingConfig | null): BookingConfig {
    const defaults = this.default();
    const merged = {
      ...defaults,
      ...legacyConfig,
      ...config
    };
    return {
      ...merged,
      enabled: config?.enabled ?? legacyConfig?.enabled ?? defaults.enabled,
      defaultMaxCapacity: config?.defaultMaxCapacity || legacyConfig?.defaultMaxCapacity || defaults.defaultMaxCapacity,
      defaultMaxGroupSize: config?.defaultMaxGroupSize || legacyConfig?.defaultMaxGroupSize || defaults.defaultMaxGroupSize,
      defaultMemberPriorityDays: config?.defaultMemberPriorityDays || legacyConfig?.defaultMemberPriorityDays || defaults.defaultMemberPriorityDays,
      enabledForEventTypes: config?.enabledForEventTypes?.length > 0
        ? config.enabledForEventTypes
        : legacyConfig?.enabledForEventTypes?.length > 0
          ? legacyConfig.enabledForEventTypes
          : BOOKING_EVENT_TYPES
    };
  }

  default(): BookingConfig {
    return {
      enabled: false,
      enabledForEventTypes: BOOKING_EVENT_TYPES,
      defaultMaxCapacity: 0,
      defaultMaxGroupSize: 3,
      defaultMemberPriorityDays: 0
    };
  }
}
