import { inject, Injectable, InjectionToken, NgZone } from "@angular/core";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NativeRouteBatch, NativeRouteError, NativeRouteEvent, NativeRouteFailure, NativeRoutePosition, NativeRouteRecorderPlugin } from "../../models/native-route.model";
import { LoggerFactory } from "../logger-factory.service";

export const NATIVE_ROUTE_RECORDER = new InjectionToken<NativeRouteRecorderPlugin>("NativeRouteRecorder", {
  providedIn: "root", factory: () => registerPlugin<NativeRouteRecorderPlugin>("NativeRouteRecorder")
});

@Injectable({providedIn: "root"})
export class NativeRouteRecorderService {
  private zone = inject(NgZone);
  private recorder = inject(NATIVE_ROUTE_RECORDER);
  private logger = inject(LoggerFactory).createLogger("NativeRouteRecorderService", NgxLoggerLevel.ERROR);
  private operations = Promise.resolve();
  private listening: Promise<void> | null = null;
  private sessionId: string | null = null;
  private after = 0;
  private generation = 0;
  private receive: ((position: NativeRoutePosition) => void) | null = null;
  private fail: ((failure: NativeRouteFailure) => void) | null = null;

  supported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeRouteRecorder");
  }

  nativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  start(sessionId: string, reset: boolean, after: number, receive: (position: NativeRoutePosition) => void,
        fail: (failure: NativeRouteFailure) => void): void {
    this.sessionId = sessionId;
    const generation = ++this.generation;
    this.after = after;
    this.receive = receive;
    this.fail = fail;
    this.enqueue(async () => {
      if (this.generation === generation) {
        await this.listen();
        await this.recorder.start({sessionId, reset});
        await this.drain(sessionId, generation);
      }
    }, failure => {
      if (this.generation === generation) {
        fail(failure);
      }
    });
  }

  resume(): void {
    const sessionId = this.sessionId;
    const generation = this.generation;
    if (sessionId) {
      const fail = this.fail;
      this.enqueue(() => this.drain(sessionId, generation), failure => {
        if (this.generation === generation) {
          fail?.(failure);
        }
      });
    }
  }

  async flush(): Promise<boolean> {
    const sessionId = this.sessionId;
    const generation = this.generation;
    const result = {success: true};
    if (sessionId) {
      this.enqueue(() => this.drain(sessionId, generation), failure => {
        result.success = false;
        if (this.generation === generation) {
          this.fail?.(failure);
        }
      });
      await this.operations;
    }
    return result.success;
  }

  stop(): void {
    if (this.supported()) {
      this.sessionId = null;
      this.generation++;
      this.receive = null;
      this.fail = null;
      this.enqueue(() => this.recorder.stop(), null);
    }
  }

  private enqueue(operation: () => Promise<void>, fail: ((failure: NativeRouteFailure) => void) | null): void {
    this.operations = this.operations.then(operation).catch(error => {
      this.logger.error("Native location operation failed", error);
      this.zone.run(() => fail?.({code: error?.code === NativeRouteError.DENIED ? NativeRouteError.DENIED : NativeRouteError.UNAVAILABLE,
        message: error?.message || "Location recording could not continue."}));
    });
  }

  private listen(): Promise<void> {
    if (!this.listening) {
      this.listening = Promise.all([
        this.recorder.addListener(NativeRouteEvent.POSITIONS, () => this.resume()),
        this.recorder.addListener(NativeRouteEvent.ERROR, failure => this.zone.run(() => this.fail?.(failure)))
      ]).then(() => null).catch(error => {
        this.listening = null;
        throw error;
      });
    }
    return this.listening;
  }

  private async drain(sessionId: string, generation: number): Promise<void> {
    const batch: NativeRouteBatch = await this.recorder.positions({sessionId, after: this.after});
    if (this.generation === generation && this.sessionId === sessionId && batch.sessionId === sessionId) {
      this.zone.run(() => batch.positions.forEach(position => {
        if (position.timestamp > this.after) {
          this.receive?.(position);
          this.after = position.timestamp;
        }
      }));
    }
  }
}
