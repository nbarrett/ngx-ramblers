import { keys } from "es-toolkit/compat";
import { MeetingSpeakerEvent } from "../models/video-meeting.model";

export function speakersInWindow(timeline: MeetingSpeakerEvent[], from: number, to: number): string[] {
  const ordered = [...(timeline || [])].filter(event => !!event?.name).sort((left, right) => left.at - right.at);
  const talkTime = ordered.reduce((totals: Record<string, number>, event, index) => {
    const next = ordered[index + 1];
    const start = Math.max(event.at, from);
    const end = Math.min(next ? next.at : to, to);
    const overlap = Math.max(0, end - start);
    return overlap > 0 ? {...totals, [event.name]: (totals[event.name] || 0) + overlap} : totals;
  }, {});
  return keys(talkTime).sort((left, right) => talkTime[right] - talkTime[left]);
}

export function pruneSpeakerTimeline(timeline: MeetingSpeakerEvent[], keepFrom: number): MeetingSpeakerEvent[] {
  const ordered = [...(timeline || [])].sort((left, right) => left.at - right.at);
  const lastBefore = ordered.filter(event => event.at < keepFrom).slice(-1);
  return [...lastBefore, ...ordered.filter(event => event.at >= keepFrom)];
}
