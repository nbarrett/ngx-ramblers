import { isString } from "es-toolkit/compat";

const AMERICAN_TO_BRITISH: [string, string][] = [
  ["acknowledgment", "acknowledgement"],
  ["acknowledgments", "acknowledgements"],
  ["afterward", "afterwards"],
  ["aging", "ageing"],
  ["aluminum", "aluminium"],
  ["apologize", "apologise"],
  ["apologized", "apologised"],
  ["apologizes", "apologises"],
  ["apologizing", "apologising"],
  ["authorization", "authorisation"],
  ["authorize", "authorise"],
  ["authorized", "authorised"],
  ["authorizes", "authorises"],
  ["authorizing", "authorising"],
  ["behavior", "behaviour"],
  ["behaviors", "behaviours"],
  ["caliber", "calibre"],
  ["canceled", "cancelled"],
  ["canceling", "cancelling"],
  ["catalog", "catalogue"],
  ["catalogs", "catalogues"],
  ["center", "centre"],
  ["centered", "centred"],
  ["centering", "centring"],
  ["centers", "centres"],
  ["color", "colour"],
  ["colored", "coloured"],
  ["colorful", "colourful"],
  ["coloring", "colouring"],
  ["colors", "colours"],
  ["cozy", "cosy"],
  ["criticize", "criticise"],
  ["criticized", "criticised"],
  ["criticizes", "criticises"],
  ["criticizing", "criticising"],
  ["defense", "defence"],
  ["defenses", "defences"],
  ["dialog", "dialogue"],
  ["dialogs", "dialogues"],
  ["emphasize", "emphasise"],
  ["emphasized", "emphasised"],
  ["emphasizes", "emphasises"],
  ["emphasizing", "emphasising"],
  ["enroll", "enrol"],
  ["enrollment", "enrolment"],
  ["favor", "favour"],
  ["favored", "favoured"],
  ["favoring", "favouring"],
  ["favorite", "favourite"],
  ["favorites", "favourites"],
  ["favors", "favours"],
  ["fiber", "fibre"],
  ["flavor", "flavour"],
  ["flavored", "flavoured"],
  ["flavors", "flavours"],
  ["fueled", "fuelled"],
  ["fueling", "fuelling"],
  ["fulfill", "fulfil"],
  ["fulfillment", "fulfilment"],
  ["gray", "grey"],
  ["grayed", "greyed"],
  ["graying", "greying"],
  ["grays", "greys"],
  ["harbor", "harbour"],
  ["harbors", "harbours"],
  ["honor", "honour"],
  ["honorable", "honourable"],
  ["honored", "honoured"],
  ["honoring", "honouring"],
  ["honors", "honours"],
  ["humor", "humour"],
  ["judgment", "judgement"],
  ["judgments", "judgements"],
  ["labeled", "labelled"],
  ["labeling", "labelling"],
  ["labor", "labour"],
  ["labored", "laboured"],
  ["labors", "labours"],
  ["learned", "learnt"],
  ["liter", "litre"],
  ["liters", "litres"],
  ["maneuver", "manoeuvre"],
  ["maneuvers", "manoeuvres"],
  ["memorize", "memorise"],
  ["memorized", "memorised"],
  ["memorizing", "memorising"],
  ["modeled", "modelled"],
  ["modeling", "modelling"],
  ["mustache", "moustache"],
  ["neighbor", "neighbour"],
  ["neighborhood", "neighbourhood"],
  ["neighboring", "neighbouring"],
  ["neighbors", "neighbours"],
  ["offense", "offence"],
  ["offenses", "offences"],
  ["organization", "organisation"],
  ["organizational", "organisational"],
  ["organizations", "organisations"],
  ["organize", "organise"],
  ["organized", "organised"],
  ["organizes", "organises"],
  ["organizing", "organising"],
  ["pajamas", "pyjamas"],
  ["plow", "plough"],
  ["realize", "realise"],
  ["realized", "realised"],
  ["realizes", "realises"],
  ["realizing", "realising"],
  ["recognize", "recognise"],
  ["recognized", "recognised"],
  ["recognizes", "recognises"],
  ["recognizing", "recognising"],
  ["rumor", "rumour"],
  ["rumored", "rumoured"],
  ["rumors", "rumours"],
  ["signaled", "signalled"],
  ["signaling", "signalling"],
  ["skeptic", "sceptic"],
  ["skillful", "skilful"],
  ["specialization", "specialisation"],
  ["specialize", "specialise"],
  ["specialized", "specialised"],
  ["specializes", "specialises"],
  ["specializing", "specialising"],
  ["standardize", "standardise"],
  ["standardized", "standardised"],
  ["summarize", "summarise"],
  ["summarized", "summarised"],
  ["summarizes", "summarises"],
  ["summarizing", "summarising"],
  ["theater", "theatre"],
  ["theaters", "theatres"],
  ["toward", "towards"],
  ["traveled", "travelled"],
  ["traveler", "traveller"],
  ["travelers", "travellers"],
  ["traveling", "travelling"],
  ["analyze", "analyse"],
  ["analyzed", "analysed"],
  ["analyzes", "analyses"],
  ["analyzing", "analysing"],
  ["unlearned", "unlearnt"],
  ["willful", "wilful"]
];

function withMatchingCase(source: string, replacement: string): string {
  if (!source) {
    return replacement;
  } else if (source === source.toUpperCase()) {
    return replacement.toUpperCase();
  } else if (source[0] === source[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  } else {
    return replacement;
  }
}

function startsSentence(text: string, offset: number): boolean {
  const preceding = text.slice(0, offset);
  return !preceding.trim() || /[.!?:]\s*$|\n\s*$/.test(preceding);
}

function looksLikeProperNoun(text: string, match: string, offset: number): boolean {
  return match[0] === match[0].toUpperCase()
    && match !== match.toUpperCase()
    && !startsSentence(text, offset);
}

export function toBritishEnglish(text: string): string {
  if (!isString(text) || !text) {
    return text || "";
  } else {
    return AMERICAN_TO_BRITISH.reduce((output, [american, british]) => {
      const pattern = new RegExp(`\\b${american}\\b`, "gi");
      return output.replace(pattern, (match, offset: number) =>
        looksLikeProperNoun(output, match, offset) ? match : withMatchingCase(match, british));
    }, text);
  }
}
