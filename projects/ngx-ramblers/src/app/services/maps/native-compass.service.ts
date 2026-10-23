import { inject, Injectable, InjectionToken, NgZone, signal } from "@angular/core";
import { Capacitor, PluginListenerHandle, registerPlugin } from "@capacitor/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NativeCompassEvent, NativeCompassHeading, NativeCompassPlugin } from "../../models/native-compass.model";
import { LoggerFactory } from "../logger-factory.service";

export const NATIVE_COMPASS = new InjectionToken<NativeCompassPlugin>("NativeCompass", {
  providedIn: "root", factory: () => registerPlugin<NativeCompassPlugin>("NativeCompass")
});

@Injectable({providedIn: "root"})
export class NativeCompassService {
  readonly calibrationRecommended = signal(false);
  private zone = inject(NgZone);
  private compass = inject(NATIVE_COMPASS);
  private logger = inject(LoggerFactory).createLogger("NativeCompassService", NgxLoggerLevel.ERROR);
  private listener: PluginListenerHandle | null = null;
  private receive: ((heading: number) => void) | null = null;
  private session = 0;
  private active = false;
  private lastCalibration: boolean | null = null;

  supported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  }

  start(receive: (heading: number) => void): void {
    if (this.supported()) {
      this.receive = receive;
      this.active = true;
      this.session += 1;
      void this.listenAndStart(this.session);
    }
  }

  stop(): void {
    this.receive = null;
    this.active = false;
    this.session += 1;
    this.calibrationRecommended.set(false);
    this.lastCalibration = null;
    const listener = this.listener;
    this.listener = null;
    if (this.supported()) {
      void listener?.remove();
      void this.compass.stop().catch(error => this.logger.error("Native compass stop failed", error));
    }
  }

  private currentSession(session: number): boolean {
    return this.active && session === this.session;
  }

  private async abandonListener(listener: PluginListenerHandle | null): Promise<void> {
    if (listener && listener !== this.listener) {
      await listener.remove();
    }
  }

  private async listenAndStart(session: number): Promise<void> {
    try {
      const listener = this.listener || await this.compass.addListener(NativeCompassEvent.HEADING, payload => this.publish(payload));
      if (this.currentSession(session)) {
        this.listener = listener;
        await this.compass.start();
        if (!this.currentSession(session) && !this.active) {
          await this.compass.stop();
        }
      } else {
        await this.abandonListener(listener);
      }
    } catch (error) {
      this.logger.error("Native compass start failed", error);
    }
  }

  private publish(payload: NativeCompassHeading): void {
    if (Number.isFinite(payload?.heading) && this.receive) {
      const calibration = payload.calibrationRecommended === true;
      this.receive(payload.heading);
      if (calibration !== this.lastCalibration) {
        this.lastCalibration = calibration;
        this.zone.run(() => this.calibrationRecommended.set(calibration));
      }
    }
  }
}
