import { MeetingSpeechRecognition, MeetingSpeechRecognitionEvent } from "../models/video-meeting.model";

export function createMeetingSpeechRecognition(win: Window): MeetingSpeechRecognition | null {
  const speechWindow = win as Window & {
    SpeechRecognition?: new () => MeetingSpeechRecognition;
    webkitSpeechRecognition?: new () => MeetingSpeechRecognition;
  };
  const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  if (!Recognition) {
    return null;
  } else {
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    return recognition;
  }
}

export function finalSpeechLines(event: MeetingSpeechRecognitionEvent): string[] {
  const results = event?.results;
  if (!results || !results.length) {
    return [];
  } else {
    return [...Array(results.length).keys()]
      .map(index => results[index])
      .filter(result => result?.isFinal)
      .map(result => (result[0]?.transcript || "").trim())
      .filter(line => !!line);
  }
}
