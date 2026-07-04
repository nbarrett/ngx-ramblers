import debug from "debug";
import { monitorEventLoopDelay } from "perf_hooks";
import { getHeapStatistics } from "v8";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";

const debugLog = debug(envConfig.logNamespace("memory-watchdog"));
debugLog.enabled = true;

const BYTES_PER_MB = 1048576;
const NANOS_PER_MS = 1e6;

function numberFromEnv(variable: Environment, fallback: number): number {
  const raw = envConfig.value(variable);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function startMemoryWatchdog(): void {
  if (envConfig.value(Environment.MEMORY_WATCHDOG_ENABLED) === "false") {
    debugLog("memory watchdog disabled via MEMORY_WATCHDOG_ENABLED=false");
    return;
  }
  const intervalMs = numberFromEnv(Environment.MEMORY_WATCHDOG_INTERVAL_MS, 20000);
  const heapPercentLimit = numberFromEnv(Environment.MEMORY_WATCHDOG_HEAP_PERCENT, 90);
  const rssMbLimit = numberFromEnv(Environment.MEMORY_WATCHDOG_RSS_MB, 470);
  const loopLagMsLimit = numberFromEnv(Environment.MEMORY_WATCHDOG_LOOP_LAG_MS, 8000);
  const consecutiveTrips = numberFromEnv(Environment.MEMORY_WATCHDOG_TRIPS, 2);
  const heapLimitMb = getHeapStatistics().heap_size_limit / BYTES_PER_MB;

  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  let trips = 0;
  const timer = setInterval(() => {
    const memory = process.memoryUsage();
    const heapUsedMb = memory.heapUsed / BYTES_PER_MB;
    const rssMb = memory.rss / BYTES_PER_MB;
    const heapPercent = heapLimitMb > 0 ? (heapUsedMb / heapLimitMb) * 100 : 0;
    const loopLagMs = loopDelay.max / NANOS_PER_MS;
    loopDelay.reset();

    const breaches = [
      heapPercent >= heapPercentLimit ? `heap ${heapPercent.toFixed(0)}% (${heapUsedMb.toFixed(0)}/${heapLimitMb.toFixed(0)}MB)` : null,
      rssMb >= rssMbLimit ? `rss ${rssMb.toFixed(0)}MB` : null,
      loopLagMs >= loopLagMsLimit ? `loopLag ${loopLagMs.toFixed(0)}ms` : null
    ].filter(Boolean);

    if (breaches.length > 0) {
      trips += 1;
      debugLog(`WARNING trip ${trips}/${consecutiveTrips}: ${breaches.join(", ")} (rss ${rssMb.toFixed(0)}MB, heap ${heapPercent.toFixed(0)}%, loopLag ${loopLagMs.toFixed(0)}ms)`);
      if (trips >= consecutiveTrips) {
        console.error(`[memory-watchdog] restarting: ${breaches.join(", ")} — exiting so Fly restarts a fresh machine (heap ${heapUsedMb.toFixed(0)}/${heapLimitMb.toFixed(0)}MB, rss ${rssMb.toFixed(0)}MB, loopLag ${loopLagMs.toFixed(0)}ms).`);
        clearInterval(timer);
        process.exit(1);
      }
    } else if (trips > 0) {
      trips = 0;
    }
  }, intervalMs);
  timer.unref();
  debugLog(`memory watchdog started: interval ${intervalMs}ms, heap>=${heapPercentLimit}%, rss>=${rssMbLimit}MB, loopLag>=${loopLagMsLimit}ms, trips=${consecutiveTrips}, heapLimit=${heapLimitMb.toFixed(0)}MB`);
}
