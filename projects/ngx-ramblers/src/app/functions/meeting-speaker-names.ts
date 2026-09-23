export function givenName(name: string): string {
  return (name || "").trim().split(/\s+/).filter(word => !!word)[0] || "";
}

export function speakerAttendees(names: string[]): string[] {
  const seen: string[] = [];
  (names || []).forEach(name => {
    const trimmed = (name || "").trim();
    if (trimmed && !seen.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) {
      seen.push(trimmed);
    }
  });
  return seen;
}

export function givenNameIsUnique(name: string, attendees: string[]): boolean {
  const given = givenName(name).toLowerCase();
  if (!given) {
    return false;
  } else {
    const matches = speakerAttendees(attendees).filter(candidate => givenName(candidate).toLowerCase() === given);
    return matches.length <= 1;
  }
}

export function shortSpeakerName(name: string, attendees: string[]): string {
  const trimmed = (name || "").trim();
  const given = givenName(trimmed);
  if (!trimmed) {
    return "";
  } else if (given && givenNameIsUnique(trimmed, attendees.length ? attendees : [trimmed])) {
    return given;
  } else {
    return trimmed;
  }
}

export function matchKnownSpeaker(label: string, known: string[]): string {
  const needle = (label || "").trim();
  if (!needle) {
    return "";
  } else {
    const attendees = speakerAttendees(known);
    const exact = attendees.find(name => name.toLowerCase() === needle.toLowerCase());
    const givenExact = attendees.filter(name => givenName(name).toLowerCase() === needle.toLowerCase());
    const givenOfLabel = attendees.filter(name => givenName(name).toLowerCase() === givenName(needle).toLowerCase());
    if (exact) {
      return exact;
    } else if (givenExact.length === 1) {
      return givenExact[0];
    } else if (givenOfLabel.length === 1) {
      return givenOfLabel[0];
    } else {
      return "";
    }
  }
}

export function namesForTranscribePrompt(names: string[]): string[] {
  const attendees = speakerAttendees(names);
  return attendees.map(name => shortSpeakerName(name, attendees));
}
