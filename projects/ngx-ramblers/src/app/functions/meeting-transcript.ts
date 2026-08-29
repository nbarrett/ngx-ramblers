import { MeetingTranscriptLine } from "../models/video-meeting.model";

export function dedupeIncomingLines(previousText: string | null, incoming: string[]): string[] {
  return (incoming || [])
    .map(line => (line || "").trim())
    .filter(line => !!line)
    .reduce((accumulator: string[], line) => {
      const last = accumulator.length ? accumulator[accumulator.length - 1] : (previousText || "").trim();
      return line === last ? accumulator : [...accumulator, line];
    }, []);
}

export function transcriptLineLabel(line: MeetingTranscriptLine): string {
  const author = (line?.authorName || "").trim();
  const text = (line?.text || "").trim();
  return text && author ? `${author}: ${text}` : text;
}

export function joinTranscriptLines(lines: MeetingTranscriptLine[]): string {
  return (lines || [])
    .map(transcriptLineLabel)
    .filter(label => !!label)
    .join("\n");
}
