import { pruneSpeakerTimeline, speakersInWindow } from "./meeting-speakers";
import { MeetingSpeakerEvent } from "../models/video-meeting.model";

describe("speakersInWindow", () => {
  const timeline: MeetingSpeakerEvent[] = [
    {at: 0, participantId: "a", name: "Nick"},
    {at: 10_000, participantId: "b", name: "Rachel"},
    {at: 25_000, participantId: "a", name: "Nick"},
    {at: 28_000, participantId: "c", name: "Tim"}
  ];

  it("orders the people who spoke in the window by how long they spoke", () => {
    expect(speakersInWindow(timeline, 10_000, 30_000)).toEqual(["Rachel", "Nick", "Tim"]);
  });

  it("includes whoever was already speaking when the window opened", () => {
    expect(speakersInWindow(timeline, 5_000, 9_000)).toEqual(["Nick"]);
  });

  it("returns nobody when the timeline is empty or the window is before any event", () => {
    expect(speakersInWindow([], 0, 20_000)).toEqual([]);
    expect(speakersInWindow(timeline, -20_000, -1)).toEqual([]);
  });
});

describe("pruneSpeakerTimeline", () => {
  it("keeps the last event before the cut-off so the current speaker is not lost", () => {
    const timeline: MeetingSpeakerEvent[] = [
      {at: 0, participantId: "a", name: "Nick"},
      {at: 5_000, participantId: "b", name: "Rachel"},
      {at: 30_000, participantId: "c", name: "Tim"}
    ];
    expect(pruneSpeakerTimeline(timeline, 20_000)).toEqual([
      {at: 5_000, participantId: "b", name: "Rachel"},
      {at: 30_000, participantId: "c", name: "Tim"}
    ]);
  });
});
