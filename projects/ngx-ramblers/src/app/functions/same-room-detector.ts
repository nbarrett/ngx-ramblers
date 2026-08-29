import { isNumber } from "es-toolkit/compat";
import { BeaconDetectionOptions, SameRoomDetector, SameRoomDetectorOptions } from "../models/video-meeting.model";

export const SAME_ROOM_BEACON_HZ = 18500;
const FFT_SIZE = 4096;
const DETECT_INTERVAL_MS = 90;
const EMIT_BURST_MS = 120;
const EMIT_GUARD_MS = 300;
const HISTORY_LENGTH = 14;
const REQUIRED_HITS = 3;
const BEACON_DETECTION: BeaconDetectionOptions = {absoluteThresholdDb: -85, prominenceDb: 12};

export function beaconBinIndex(frequencyHz: number, sampleRate: number, fftSize: number): number {
  return Math.round(frequencyHz / (sampleRate / fftSize));
}

export function beaconDetected(magnitudesDb: Float32Array, binIndex: number, options: BeaconDetectionOptions): boolean {
  const at = (index: number): number => {
    const value = magnitudesDb[index];
    return isNumber(value) && isFinite(value) ? value : -140;
  };
  const peak = Math.max(at(binIndex - 1), at(binIndex), at(binIndex + 1));
  const floorBins = [binIndex - 9, binIndex - 8, binIndex - 7, binIndex + 7, binIndex + 8, binIndex + 9].map(at);
  const floor = floorBins.reduce((sum, value) => sum + value, 0) / floorBins.length;
  return peak >= options.absoluteThresholdDb && peak - floor >= options.prominenceDb;
}

export function sameRoomLikely(history: boolean[], requiredHits: number): boolean {
  return history.filter(Boolean).length >= requiredHits;
}

export function createSameRoomDetector(win: Window, options: SameRoomDetectorOptions): SameRoomDetector {
  const audioWindow = win as unknown as {AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext};
  const audioContextCtor: typeof AudioContext | undefined = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  const supported = !!audioContextCtor && !!win.navigator?.mediaDevices?.getUserMedia && !!win.performance?.now;
  const state = {
    context: null as AudioContext | null,
    stream: null as MediaStream | null,
    analyser: null as AnalyserNode | null,
    gain: null as GainNode | null,
    data: null as Float32Array<ArrayBuffer> | null,
    binIndex: 0,
    timer: 0,
    emitGuardUntil: 0,
    nextEmitAt: 0,
    history: [] as boolean[],
    running: false,
    prompted: false
  };

  const clock = (): number => win.performance.now();

  const emitBurst = (): void => {
    if (state.context && state.gain) {
      const start = state.context.currentTime;
      const end = start + EMIT_BURST_MS / 1000;
      state.gain.gain.cancelScheduledValues(start);
      state.gain.gain.setValueAtTime(0, start);
      state.gain.gain.linearRampToValueAtTime(0.04, start + 0.01);
      state.gain.gain.setValueAtTime(0.04, end - 0.01);
      state.gain.gain.linearRampToValueAtTime(0, end);
      state.emitGuardUntil = clock() + EMIT_BURST_MS + EMIT_GUARD_MS;
    }
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
    state.gain = null;
    state.data = null;
    state.history = [];
  };

  const tick = (): void => {
    if (state.running) {
      const currentTime = clock();
      if (currentTime >= state.nextEmitAt) {
        emitBurst();
        state.nextEmitAt = currentTime + 1500 + Math.random() * 2000;
      }
      if (currentTime >= state.emitGuardUntil && state.analyser && state.data) {
        state.analyser.getFloatFrequencyData(state.data);
        const hit = beaconDetected(state.data, state.binIndex, BEACON_DETECTION);
        state.history = [...state.history, hit].slice(-HISTORY_LENGTH);
        if (!state.prompted && sameRoomLikely(state.history, REQUIRED_HITS)) {
          state.prompted = true;
          options.onDetected();
        }
      }
    }
  };

  const start = async (): Promise<boolean> => {
    let started = false;
    if (supported && !state.running) {
      try {
        const context = new audioContextCtor();
        const stream = await win.navigator.mediaDevices.getUserMedia({
          audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}
        });
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0;
        context.createMediaStreamSource(stream).connect(analyser);
        const oscillator = context.createOscillator();
        oscillator.frequency.value = SAME_ROOM_BEACON_HZ;
        const gain = context.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        state.context = context;
        state.stream = stream;
        state.analyser = analyser;
        state.gain = gain;
        state.data = new Float32Array(analyser.frequencyBinCount);
        state.binIndex = beaconBinIndex(SAME_ROOM_BEACON_HZ, context.sampleRate, FFT_SIZE);
        state.nextEmitAt = clock() + Math.random() * 1500;
        state.running = true;
        state.timer = win.setInterval(tick, DETECT_INTERVAL_MS);
        started = true;
      } catch (error) {
        stop();
        started = false;
      }
    }
    return started;
  };

  return {start, stop};
}
