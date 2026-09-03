import { isArray, isObject, isString } from "es-toolkit/compat";
import { MeetingCurrentDevices, MeetingDevice, MeetingDeviceLists, MicLevelMeter, MicLevelMeterOptions } from "../models/video-meeting.model";

const SAMPLE_INTERVAL_MS = 100;
const FFT_SIZE = 1024;
const LEVEL_GAIN = 4;
export const SILENT_MICROPHONE_SAMPLES = 100;
export const SILENT_MICROPHONE_PEAK = 0.02;

export function micLevelFromSamples(samples: Uint8Array): number {
  if (!samples?.length) {
    return 0;
  } else {
    const sumOfSquares = samples.reduce((sum, sample) => {
      const centred = (sample - 128) / 128;
      return sum + centred * centred;
    }, 0);
    const rms = Math.sqrt(sumOfSquares / samples.length);
    return Math.min(1, rms * LEVEL_GAIN);
  }
}

export function microphoneLooksSilent(levels: number[], requiredSamples: number, peakThreshold: number): boolean {
  if (levels.length < requiredSamples) {
    return false;
  } else {
    const recent = levels.slice(-requiredSamples);
    return Math.max(...recent) < peakThreshold;
  }
}

export function recentLevels(levels: number[], level: number, keep: number): number[] {
  return [...levels, level].slice(-keep);
}

function deviceFrom(item: unknown): MeetingDevice | null {
  const record = isObject(item) ? item as { [key: string]: unknown } : {};
  const deviceId = isString(record["deviceId"]) ? record["deviceId"] : "";
  if (deviceId) {
    return {deviceId, label: isString(record["label"]) ? record["label"] : ""};
  } else {
    return null;
  }
}

function devicesFrom(items: unknown): MeetingDevice[] {
  return (isArray(items) ? items : []).map(deviceFrom).filter(device => !!device);
}

export function meetingDeviceLists(available: unknown): MeetingDeviceLists {
  const record = isObject(available) ? available as { [key: string]: unknown } : {};
  return {
    audioInput: devicesFrom(record["audioInput"]),
    audioOutput: devicesFrom(record["audioOutput"]),
    videoInput: devicesFrom(record["videoInput"])
  };
}

export function meetingCurrentDevices(current: unknown): MeetingCurrentDevices {
  const record = isObject(current) ? current as { [key: string]: unknown } : {};
  return {
    audioInput: deviceFrom(record["audioInput"]),
    audioOutput: deviceFrom(record["audioOutput"]),
    videoInput: deviceFrom(record["videoInput"])
  };
}

export function deviceLabel(device: MeetingDevice | null, fallback: string): string {
  return device?.label?.trim() || fallback;
}

export function createMicLevelMeter(win: Window, options: MicLevelMeterOptions): MicLevelMeter {
  const audioWindow = win as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const audioContextCtor: typeof AudioContext | undefined = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  const supported = !!audioContextCtor && !!win.navigator?.mediaDevices?.getUserMedia;
  const state = {
    context: null as AudioContext | null,
    stream: null as MediaStream | null,
    analyser: null as AnalyserNode | null,
    data: null as Uint8Array<ArrayBuffer> | null,
    timer: 0,
    running: false
  };

  const stop = (): void => {
    state.running = false;
    if (state.timer) {
      win.clearInterval(state.timer);
      state.timer = 0;
    }
    state.stream?.getTracks().forEach(track => track.stop());
    if (state.context) {
      void state.context.close().catch(() => undefined);
    }
    state.context = null;
    state.stream = null;
    state.analyser = null;
    state.data = null;
  };

  const tick = (): void => {
    if (state.running && state.analyser && state.data) {
      state.analyser.getByteTimeDomainData(state.data);
      options.onLevel(micLevelFromSamples(state.data));
    }
  };

  const start = async (): Promise<boolean> => {
    if (supported && !state.running) {
      try {
        const audio: MediaTrackConstraints = options.deviceId ? {deviceId: {exact: options.deviceId}} : {};
        const stream = await win.navigator.mediaDevices.getUserMedia({audio});
        const context = new audioContextCtor();
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        context.createMediaStreamSource(stream).connect(analyser);
        state.context = context;
        state.stream = stream;
        state.analyser = analyser;
        state.data = new Uint8Array(analyser.fftSize);
        state.running = true;
        state.timer = win.setInterval(tick, SAMPLE_INTERVAL_MS);
        return true;
      } catch (error) {
        stop();
        return false;
      }
    } else {
      return state.running;
    }
  };

  return {start, stop};
}
