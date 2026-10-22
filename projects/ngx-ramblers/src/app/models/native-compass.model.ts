import { PluginListenerHandle } from "@capacitor/core";

export enum NativeCompassEvent {
  HEADING = "heading"
}

export interface NativeCompassHeading {
  heading: number;
  calibrationRecommended?: boolean;
}

export interface NativeCompassPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(event: NativeCompassEvent.HEADING, listener: (payload: NativeCompassHeading) => void): Promise<PluginListenerHandle>;
}
