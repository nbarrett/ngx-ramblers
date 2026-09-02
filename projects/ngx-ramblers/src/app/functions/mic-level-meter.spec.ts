import { deviceLabel, meetingCurrentDevices, meetingDeviceLists, micLevelFromSamples, microphoneLooksSilent, recentLevels } from "./mic-level-meter";

describe("mic level meter", () => {

  it("reports zero for digital silence and a positive level for a signal", () => {
    expect(micLevelFromSamples(new Uint8Array([128, 128, 128, 128]))).toEqual(0);
    expect(micLevelFromSamples(new Uint8Array([]))).toEqual(0);
    expect(micLevelFromSamples(new Uint8Array([0, 255, 0, 255]))).toEqual(1);
    const quiet = micLevelFromSamples(new Uint8Array([126, 130, 127, 129]));
    expect(quiet).toBeGreaterThan(0);
    expect(quiet).toBeLessThan(0.1);
  });

  it("only calls the microphone silent once enough samples have all stayed under the threshold", () => {
    expect(microphoneLooksSilent([0, 0, 0], 5, 0.02)).toEqual(false);
    expect(microphoneLooksSilent([0, 0.01, 0, 0.005, 0], 5, 0.02)).toEqual(true);
    expect(microphoneLooksSilent([0, 0, 0.3, 0, 0], 5, 0.02)).toEqual(false);
    expect(microphoneLooksSilent([0.5, 0, 0, 0, 0, 0], 5, 0.02)).toEqual(true);
  });

  it("keeps only the most recent levels", () => {
    expect(recentLevels([0.1, 0.2, 0.3], 0.4, 3)).toEqual([0.2, 0.3, 0.4]);
  });

  it("maps Jitsi device lists and ignores entries without an id", () => {
    const lists = meetingDeviceLists({
      audioInput: [{deviceId: "mic-1", label: "Headset"}, {label: "no id"}],
      audioOutput: [{deviceId: "spk-1", label: "Speakers"}],
      videoInput: null
    });
    expect(lists.audioInput).toEqual([{deviceId: "mic-1", label: "Headset"}]);
    expect(lists.audioOutput).toEqual([{deviceId: "spk-1", label: "Speakers"}]);
    expect(lists.videoInput).toEqual([]);
    const current = meetingCurrentDevices({audioInput: {deviceId: "mic-1", label: "Headset"}});
    expect(current.audioInput).toEqual({deviceId: "mic-1", label: "Headset"});
    expect(current.videoInput).toBeNull();
    expect(deviceLabel(current.audioInput, "Microphone")).toEqual("Headset");
    expect(deviceLabel(null, "Microphone")).toEqual("Microphone");
  });
});
