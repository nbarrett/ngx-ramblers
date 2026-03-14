import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { BookingConfig } from "../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import { WalksConfig } from "../../../projects/ngx-ramblers/src/app/models/walks-config.model";
import { queryKey } from "../mongo/controllers/config";

const debugLog = debug(envConfig.logNamespace("booking-config"));
debugLog.enabled = false;

function mergeWithLegacyBookingConfig(config: BookingConfig | null, walksConfig: WalksConfig | null): BookingConfig | null {
  const legacyConfig = (walksConfig as WalksConfig & { booking?: BookingConfig })?.booking || null;
  if (!config && !legacyConfig) {
    return null;
  }
  return {
    enabled: config?.enabled ?? legacyConfig?.enabled ?? false,
    enabledForEventTypes: config?.enabledForEventTypes?.length > 0
      ? config.enabledForEventTypes
      : legacyConfig?.enabledForEventTypes?.length > 0
        ? legacyConfig.enabledForEventTypes
        : null,
    defaultMaxCapacity: config?.defaultMaxCapacity || legacyConfig?.defaultMaxCapacity || 0,
    defaultMaxGroupSize: config?.defaultMaxGroupSize || legacyConfig?.defaultMaxGroupSize || 3,
    defaultMemberPriorityDays: config?.defaultMemberPriorityDays || legacyConfig?.defaultMemberPriorityDays || 0,
    emailTemplates: config?.emailTemplates || null,
    reminderDaysBefore: config?.reminderDaysBefore || null
  };
}

export async function loadBookingConfig(): Promise<BookingConfig | null> {
  try {
    const [configDoc, legacyWalksConfigDoc] = await Promise.all([
      queryKey(ConfigKey.BOOKING),
      queryKey(ConfigKey.WALKS)
    ]);
    return mergeWithLegacyBookingConfig(configDoc?.value as BookingConfig || null, legacyWalksConfigDoc?.value as WalksConfig || null);
  } catch (error) {
    debugLog("failed to load booking config:", error);
    return null;
  }
}
