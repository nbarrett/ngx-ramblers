import { describe, expect, it } from "vitest";
import { audioRms, downsampleAudio, encodeWav, MEETING_AUDIO_HIGHPASS_HZ, MEETING_AUDIO_MIN_RMS } from "./meeting-audio-recorder";

describe("meeting audio signal chain", () => {

  it("keeps a high-pass so clothing rustle and rumble are cut before transcription", () => {
    expect(MEETING_AUDIO_HIGHPASS_HZ).toEqual(80);
  });

});

describe("audioRms", () => {

  it("is zero for silence and empty buffers", () => {
    expect(audioRms(new Float32Array(0))).toEqual(0);
    expect(audioRms(new Float32Array(16))).toEqual(0);
  });

  it("is above the speech floor for a loud tone", () => {
    const samples = Float32Array.from({length: 8}, () => 0.5);
    expect(audioRms(samples)).toBeGreaterThan(MEETING_AUDIO_MIN_RMS);
  });

  it("treats near-silent noise as below the speech floor", () => {
    const samples = Float32Array.from({length: 8}, () => 0.0001);
    expect(audioRms(samples)).toBeLessThan(MEETING_AUDIO_MIN_RMS);
  });

});

describe("downsampleAudio", () => {

  it("returns the original samples when the target rate is not lower", () => {
    const samples = Float32Array.from([0.25, 0.5, 0.75]);
    expect(Array.from(downsampleAudio(samples, 16000, 16000))).toEqual([0.25, 0.5, 0.75]);
  });

  it("shortens 48 kHz audio to 16 kHz", () => {
    const samples = Float32Array.from({length: 48}, (ignored, index) => index);
    expect(downsampleAudio(samples, 48000, 16000).length).toEqual(16);
  });

});

describe("encodeWav", () => {

  it("writes a wav blob", () => {
    const blob = encodeWav(Float32Array.from([0, 0.1, -0.1]), 16000);
    expect(blob.type).toEqual("audio/wav");
    expect(blob.size).toEqual(44 + 6);
  });

});
