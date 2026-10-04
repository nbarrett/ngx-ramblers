import { PluginListenerHandle } from "@capacitor/core";

export enum NativeRouteEvent {
  POSITIONS = "positions",
  ERROR = "locationError"
}

export enum NativeRouteError {
  DENIED = "permission-denied",
  UNAVAILABLE = "unavailable"
}

export interface NativeRoutePosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  timestamp: number;
}

export interface NativeRouteBatch {
  sessionId: string;
  positions: NativeRoutePosition[];
}

export interface NativeRouteFailure {
  code: NativeRouteError;
  message: string;
}

export interface NativeRouteRecorderPlugin {
  start(options: {sessionId: string; reset: boolean}): Promise<void>;
  stop(): Promise<void>;
  positions(options: {sessionId: string; after: number}): Promise<NativeRouteBatch>;
  addListener(event: NativeRouteEvent.POSITIONS, listener: () => void): Promise<PluginListenerHandle>;
  addListener(event: NativeRouteEvent.ERROR, listener: (failure: NativeRouteFailure) => void): Promise<PluginListenerHandle>;
}

export interface NativeWalkingWindow extends Window {
  ngxNativeSiteUrl?: string;
}
