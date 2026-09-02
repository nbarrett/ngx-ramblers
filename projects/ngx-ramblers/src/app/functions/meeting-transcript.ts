import { isArray, isObject, isString } from "es-toolkit/compat";
import { MeetingTranscriptLine } from "../models/video-meeting.model";
import { toBritishEnglish } from "./british-english";

const TRANSCRIPT_REFUSAL = /no (clear )?speech|indistinct|unable to transcribe|can'?t (provide|transcribe)|no speech in the audio|appears to be silent|can'?t provide a transcription|looks like there was no speech|collection of indistinct/i;
const TRANSCRIPT_FILLER = /^(uh|um|er|ah|mm|hmm)([,\s]+(uh|um|er|ah|mm|hmm))+$/i;
const TRANSCRIPT_STUTTER = /^([\w']+)(?:\s+\1){2,}$/i;
const TRANSCRIPT_TIMECODE = /^[\d:.]+$/;
const TRANSCRIPT_ASR_ARTIFACT = /^(thanks?( you)? for watching|please (like and )?subscribe|don'?t forget to subscribe|see you (in the )?next (time|video)|subtitles by [\w\s.]+|transcription by [\w\s.]+)[.!\s]*$/i;
const WAV_HEADER_BYTES = 44;
const WAV_BYTES_PER_SECOND = 16000 * 2;
export const MEETING_TRANSCRIBE_MAX_WORDS_PER_SECOND = 7;

export function transcriptionWordLimit(audioBytes: number): number {
  const seconds = Math.max(1, Math.floor(Math.max(0, audioBytes - WAV_HEADER_BYTES) / WAV_BYTES_PER_SECOND));
  return Math.max(12, seconds * MEETING_TRANSCRIBE_MAX_WORDS_PER_SECOND);
}

export function transcriptionExceedsAudio(text: string, audioBytes: number): boolean {
  const speech = (text || "").split(/\r?\n/).map(line => transcriptSpeechText(line)).join(" ");
  const words = speech.trim().split(/\s+/).filter(word => !!word).length;
  return words > transcriptionWordLimit(audioBytes);
}

const GENERIC_SPEAKER_LABEL = /^(unknown|speaker \d+)$/i;

function looksLikeSpeakerName(label: string, known: string[]): boolean {
  const words = label.split(/\s+/).filter(word => !!word);
  const knownName = known.some(name => name.toLowerCase() === label.toLowerCase());
  const capitalised = words.length > 0 && words.length <= 3 && words.every(word => /^[A-Z]/.test(word));
  return knownName || GENERIC_SPEAKER_LABEL.test(label) || capitalised;
}

function speakerLabel(text: string, known: string[]): string {
  const value = (text || "").trim();
  const labelled = /^([A-Za-z][A-Za-z0-9.'’\- ]{0,59}?):\s+\S.*$/.exec(value);
  const label = labelled ? labelled[1].trim() : "";
  return label && looksLikeSpeakerName(label, known) ? label : "";
}

export const UNKNOWN_SPEAKER = "Unknown";

export function unlabelledSpeaker(recorderName: string, participants: string[], speakers: string[]): string {
  const recorder = (recorderName || "").trim();
  const heard = (speakers || []).map(name => (name || "").trim()).filter(name => !!name);
  const others = (participants || [])
    .map(name => (name || "").trim())
    .filter(name => !!name && name.toLowerCase() !== recorder.toLowerCase());
  if (heard.length) {
    return heard[0];
  } else if (others.length || !recorder) {
    return UNKNOWN_SPEAKER;
  } else {
    return recorder;
  }
}

export function speakerLabelledLines(text: string, recorderName: string, participants: string[], speakers: string[] = []): {authorName: string; text: string}[] {
  const recorder = (recorderName || "").trim();
  const known = [recorder, ...(participants || []), ...(speakers || [])].map(name => (name || "").trim()).filter(name => !!name);
  const fallback = unlabelledSpeaker(recorder, participants, speakers);
  return (text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => !!line)
    .map(line => {
      const label = speakerLabel(line, known);
      const matched = known.find(name => name.toLowerCase() === label.toLowerCase());
      const speech = label ? transcriptSpeechText(line) : line;
      return {authorName: matched || label || fallback, text: toBritishEnglish(speech)};
    })
    .filter(line => isUsableTranscriptText(line.text));
}

export function textFromGenerateContent(data: unknown): string {
  if (!isObject(data)) {
    return "";
  } else {
    const candidates = (data as {candidates?: unknown}).candidates;
    if (!isArray(candidates) || !candidates.length || !isObject(candidates[0])) {
      return "";
    } else {
      const content = (candidates[0] as {content?: unknown}).content;
      const parts = isObject(content) ? (content as {parts?: unknown}).parts : null;
      if (!isArray(parts)) {
        return "";
      } else {
        return parts.reduce((text: string, part: unknown) => {
          if (isObject(part) && isString((part as {text?: unknown}).text)) {
            return `${text}${(part as {text: string}).text}`;
          } else {
            return text;
          }
        }, "").trim();
      }
    }
  }
}

export function dedupeIncomingLines(previousText: string | null, incoming: string[]): string[] {
  return (incoming || [])
    .map(line => toBritishEnglish((line || "").trim()))
    .filter(line => isUsableTranscriptText(line))
    .reduce((accumulator: string[], line) => {
      const last = accumulator.length ? accumulator[accumulator.length - 1] : toBritishEnglish(previousText || "").trim();
      return line === last ? accumulator : [...accumulator, line];
    }, []);
}

export function transcriptSpeechText(text: string): string {
  const value = (text || "").trim();
  const labelled = /^[^:]+:\s+(.+)$/.exec(value);
  return labelled ? labelled[1].trim() : value;
}

export function isUsableTranscriptText(text: string): boolean {
  const speech = transcriptSpeechText(text);
  if (!speech) {
    return false;
  } else {
    const parentheticalOnly = /^[([].*[)\]]$/.test(speech);
    const timecodeOnly = TRANSCRIPT_TIMECODE.test(speech.replace(/\s+/g, ""));
    const fillerOnly = TRANSCRIPT_FILLER.test(speech);
    const stutterOnly = TRANSCRIPT_STUTTER.test(speech);
    const refusal = TRANSCRIPT_REFUSAL.test(speech);
    const asrArtifact = TRANSCRIPT_ASR_ARTIFACT.test(speech);
    return !(parentheticalOnly || timecodeOnly || fillerOnly || stutterOnly || refusal || asrArtifact);
  }
}

export function usableTranscriptText(transcript: string): string {
  return (transcript || "")
    .split(/\r?\n/)
    .map(line => toBritishEnglish(line.trim()))
    .filter(line => isUsableTranscriptText(line))
    .join("\n");
}

export function transcriptLineLabel(line: MeetingTranscriptLine): string {
  const author = (line?.authorName || "").trim();
  const text = toBritishEnglish((line?.text || "").trim());
  return text && author ? `${author}: ${text}` : text;
}

function transcriptLineKey(line: MeetingTranscriptLine): string {
  return `${(line?.authorName || "").trim()}|${(line?.text || "").trim()}`;
}

export function dedupeTranscriptLines(lines: MeetingTranscriptLine[]): MeetingTranscriptLine[] {
  return (lines || []).reduce((accumulator: MeetingTranscriptLine[], line) => {
    const previous = accumulator.length ? accumulator[accumulator.length - 1] : null;
    const adjacentRepeat = previous ? transcriptLineKey(previous) === transcriptLineKey(line) : false;
    return isUsableTranscriptText((line?.text || "").trim()) && !adjacentRepeat
      ? [...accumulator, line]
      : accumulator;
  }, []);
}

export function joinTranscriptLines(lines: MeetingTranscriptLine[]): string {
  return dedupeTranscriptLines(lines)
    .map(transcriptLineLabel)
    .filter(label => !!label)
    .join("\n");
}

export function transcriptTimeSpan(lines: MeetingTranscriptLine[]): {startedAt: number | null; endedAt: number | null} {
  const timed = (lines || []).filter(line => line?.at > 0);
  if (!timed.length) {
    return {startedAt: null, endedAt: null};
  } else {
    return {startedAt: timed[0].at, endedAt: timed[timed.length - 1].at};
  }
}
