import { MeetingAudioRecorder, MeetingAudioRecorderOptions } from "../models/video-meeting.model";

const TARGET_SAMPLE_RATE = 16000;
export const MEETING_AUDIO_MIN_RMS = 0.008;
export const MEETING_AUDIO_HIGHPASS_HZ = 80;

export function downsampleAudio(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate || !samples.length) {
    return samples;
  } else {
    const ratio = fromRate / toRate;
    const length = Math.floor(samples.length / ratio);
    return Float32Array.from({length}, (ignored, index) => samples[Math.floor(index * ratio)]);
  }
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string): void => {
    text.split("").forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
  });
  return new Blob([view], {type: "audio/wav"});
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  const merged = new Float32Array(total);
  const cursor = {offset: 0};
  chunks.forEach(part => {
    merged.set(part, cursor.offset);
    cursor.offset += part.length;
  });
  return merged;
}

export function audioRms(samples: Float32Array): number {
  return samples.length
    ? Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
    : 0;
}

export function createMeetingAudioRecorder(win: Window, options: MeetingAudioRecorderOptions): MeetingAudioRecorder {
  const audioWindow = win as unknown as {AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext};
  const audioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  const supported = !!audioContextCtor && !!win.navigator?.mediaDevices?.getUserMedia;
  const state = {
    context: null as AudioContext | null,
    stream: null as MediaStream | null,
    source: null as MediaStreamAudioSourceNode | null,
    processor: null as ScriptProcessorNode | null,
    highpass: null as BiquadFilterNode | null,
    chunks: [] as Float32Array[],
    timer: 0,
    running: false
  };

  const flush = (): void => {
    const collected = state.chunks;
    state.chunks = [];
    if (collected.length && state.context) {
      const downsampled = downsampleAudio(mergeChunks(collected), state.context.sampleRate, TARGET_SAMPLE_RATE);
      if (downsampled.length && audioRms(downsampled) >= MEETING_AUDIO_MIN_RMS) {
        options.onChunk(encodeWav(downsampled, TARGET_SAMPLE_RATE));
      }
    }
  };

  const stop = (): void => {
    if (state.running) {
      flush();
    }
    state.running = false;
    if (state.timer) {
      win.clearInterval(state.timer);
      state.timer = 0;
    }
    try {
      state.processor?.disconnect();
      state.highpass?.disconnect();
      state.source?.disconnect();
    } catch {
      state.processor = null;
    }
    state.stream?.getTracks().forEach(track => track.stop());
    if (state.context) {
      void state.context.close().catch(() => undefined);
    }
    state.context = null;
    state.stream = null;
    state.source = null;
    state.processor = null;
    state.highpass = null;
    state.chunks = [];
  };

  const start = async (): Promise<boolean> => {
    let started = false;
    if (supported && !state.running) {
      try {
        const context = new audioContextCtor();
        state.context = context;
        if (context.state === "suspended") {
          await context.resume();
        }
        const stream = await win.navigator.mediaDevices.getUserMedia({
          audio: {echoCancellation: false, noiseSuppression: true, autoGainControl: true}
        });
        state.stream = stream;
        const source = context.createMediaStreamSource(stream);
        const highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = MEETING_AUDIO_HIGHPASS_HZ;
        const processor = context.createScriptProcessor(4096, 1, 1);
        const mute = context.createGain();
        mute.gain.value = 0;
        processor.onaudioprocess = event => {
          if (state.running) {
            state.chunks.push(Float32Array.from(event.inputBuffer.getChannelData(0)));
          }
        };
        source.connect(highpass);
        highpass.connect(processor);
        processor.connect(mute);
        mute.connect(context.destination);
        state.source = source;
        state.highpass = highpass;
        state.processor = processor;
        state.running = true;
        state.timer = win.setInterval(() => flush(), options.chunkMs);
        started = true;
      } catch {
        stop();
        started = false;
      }
    }
    return started;
  };

  return {start, stop};
}
