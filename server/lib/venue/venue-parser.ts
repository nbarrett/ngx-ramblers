import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { isEmpty, isString } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("venue-parser"));

export enum VenueTypeValue {
  CAR_PARK = "car park",
  CAFE = "cafe",
  RESTAURANT = "restaurant",
  HALL = "hall",
  CHURCH = "church",
  PUB = "pub",
  STATION = "station",
  OTHER = "other"
}

export const VENUE_TYPE_TERMS: Record<VenueTypeValue, string[]> = {
  [VenueTypeValue.CAR_PARK]: ["car park", "car-park", "carpark", "parking", "layby", "lay-by"],
  [VenueTypeValue.CAFE]: ["cafe", "café", "coffee", "tea room", "tearoom"],
  [VenueTypeValue.RESTAURANT]: ["restaurant", "bistro", "diner", "eatery", "kitchen"],
  [VenueTypeValue.PUB]: ["pub", "inn", "tavern", "arms", "head", "bell", "crown", "swan", "bull", "lion", "rose", "anchor", "oak", "fox", "bear", "eagle", "plough", "brewery", "ale", "beer", "robin", "horse", "hare", "stag", "hart", "dog", "cock", "hen", "pheasant", "falcon", "hawk", "raven", "magpie", "jackdaw", "pig", "boar", "lamb", "sheep", "goat", "badger", "otter", "deer", "buck", "elephant", "parrot", "dolphin", "hook", "hatchet", "chequers", "windmill", "vineyard", "angel", "duke", "halfway house", "three chimneys", "bedford"],
  [VenueTypeValue.HALL]: ["village hall", "community hall", "town hall", "memorial hall", "parish hall", "church hall", "hall", "centre", "center", "community"],
  [VenueTypeValue.CHURCH]: ["church", "chapel", "abbey", "cathedral", "priory", "minster"],
  [VenueTypeValue.STATION]: ["station", "railway", "rail", "train", "metro", "underground", "tube"],
  [VenueTypeValue.OTHER]: []
};

const WORD_BOUNDARY_TERMS = new Set(["church", "chapel", "abbey", "cathedral", "priory", "minster", "hall", "inn", "pub", "oak", "head", "bell", "crown", "swan", "bull", "lion", "rose", "anchor", "fox", "bear", "eagle", "robin", "horse", "hare", "stag", "hart", "dog", "cock", "hen", "pheasant", "falcon", "hawk", "raven", "magpie", "jackdaw", "pig", "boar", "lamb", "sheep", "goat", "badger", "otter", "deer", "buck", "elephant", "parrot", "dolphin", "hook", "hatchet", "chequers", "windmill", "vineyard", "angel", "duke", "bedford", "ale", "beer"]);

export interface ParsedVenue {
  name?: string;
  address1?: string;
  address2?: string;
  postcode?: string;
  type?: string;
  url?: string;
  phone?: string;
}

export interface VenueParseResult {
  venue: ParsedVenue;
  confidence: number;
  warnings: string[];
}

const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/gi;
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
const PHONE_REGEX = /(?:0\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\+44[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4})/gi;

export function inferVenueTypeFromName(name: string): VenueTypeValue {
  if (!name) {
    return VenueTypeValue.OTHER;
  }
  const nameLower = name.toLowerCase();
  const entries = Object.entries(VENUE_TYPE_TERMS) as [VenueTypeValue, string[]][];
  const foundEntry = entries.find(([, terms]) => {
    if (terms.length === 0) {
      return false;
    }
    return terms.some(term => {
      if (WORD_BOUNDARY_TERMS.has(term)) {
        const regex = new RegExp(`\\b${term}\\b`, "i");
        return regex.test(nameLower);
      }
      return nameLower.includes(term);
    });
  });
  return foundEntry ? foundEntry[0] : VenueTypeValue.OTHER;
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/,\s*UK\b/gi, "")
    .replace(/,\s*United Kingdom\b/gi, "")
    .trim();
}

function splitIntoLines(text: string): string[] {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

function extractPostcodes(text: string): string[] {
  const matches = text.match(UK_POSTCODE_REGEX) || [];
  return matches.map(postcode => normalizePostcode(postcode));
}

function normalizePostcode(postcode: string): string {
  const clean = postcode.toUpperCase().replace(/\s+/g, "");
  if (clean.length >= 5) {
    return clean.slice(0, -3) + " " + clean.slice(-3);
  }
  return clean;
}

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) || [];
  return matches.map(url => url.replace(/[.,;:!?]+$/, ""));
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return matches.map(phone => phone.replace(/[\s.-]+/g, " ").trim());
}

function cleanAddressLine(line: string): string {
  return line
    .replace(/^[-,.\s]+/, "")
    .replace(/[-,.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeConcatenatedNavItems(text: string): boolean {
  const separatorPattern = /\s*[-–—|•·]\s*/;
  const parts = text.split(separatorPattern).filter(p => p.trim().length > 0);
  if (parts.length < 2) {
    return false;
  }
  const navKeywords = [
    "home", "about", "contact", "menu", "menus", "gallery", "news", "events",
    "booking", "reservations", "privacy", "cookies", "terms", "sitemap",
    "faq", "help", "support", "blog", "shop", "cart", "login", "register",
    "allergies", "hygiene", "accessibility", "careers", "jobs", "press",
    "policy", "legal", "disclaimer", "subscribe", "newsletter", "social"
  ];
  const navMatches = parts.filter(part => {
    const partLower = part.toLowerCase().trim();
    return navKeywords.some(keyword => partLower.includes(keyword)) || partLower.length < 4;
  });
  return navMatches.length >= 2;
}

function looksLikeCallToAction(text: string): boolean {
  const ctaPatterns = [
    /^dine\s*with\s*us$/i,
    /^eat\s*with\s*us$/i,
    /^drink\s*with\s*us$/i,
    /^stay\s*with\s*us$/i,
    /^join\s*us$/i,
    /^visit\s*us$/i,
    /^come\s*and\s*(see|visit|join)/i,
    /^discover\s*(our|the|more)/i,
    /^explore\s*(our|the|more)/i,
    /^experience\s*(our|the)/i,
    /^enjoy\s*(our|the)/i,
    /^taste\s*(our|the)/i,
    /^try\s*(our|the)/i,
    /^view\s*(our|the)/i,
    /^see\s*(our|the|what|menu)/i,
    /^find\s*out\s*more/i,
    /^learn\s*more/i,
    /^read\s*more/i,
    /^click\s*here/i,
    /^book\s*(now|today|online|a\s*table)/i,
    /^reserve\s*(now|today|a\s*table)/i,
    /^order\s*(now|online|food)/i,
    /^call\s*(us|now|today)/i,
    /^contact\s*(us|now)/i,
    /^get\s*in\s*touch/i,
    /^enquire\s*(now|today)/i,
    /^make\s*a\s*(booking|reservation)/i,
    /^sign\s*up/i,
    /^subscribe/i,
    /^follow\s*us/i,
    /^connect\s*with\s*us/i,
    /^welcome\s*to\s*(our|the)/i,
    /see\s*menu.*book\s*a\s*table/i,
    /book\s*a\s*table.*see\s*menu/i,
    /^what'?s\s*on\??$/i
  ];
  return ctaPatterns.some(pattern => pattern.test(text.trim()));
}

function looksLikeMarketingCopy(text: string): boolean {
  const lower = text.toLowerCase();
  const marketingIndicators = [
    "explore the", "discover the", "experience the", "enjoy the",
    "offering", "offered at", "served at", "available at",
    "perfect for", "ideal for", "great for", "best for",
    "whether you", "if you're looking", "looking for",
    "we offer", "we serve", "we provide", "we have",
    "our menu", "our food", "our drinks", "our team",
    "award-winning", "award winning", "critically acclaimed",
    "voted", "rated", "reviewed", "recommended",
    "in the heart of", "in the centre of", "in the center of",
    "nestled in", "situated in", "located in",
    "a traditional", "an historic", "a historic", "an 18th", "a 19th", "a 17th", "a 16th",
    "century pub", "century inn", "century hotel",
    "country pub", "village pub", "local pub", "family pub", "gastropub",
    "welcoming", "friendly", "cosy", "cozy", "charming", "delightful",
    "come and", "why not", "join us",
    "take a look at", "check out our", "see our upcoming", "see upcoming",
    "raise a glass", "cheers to"
  ];
  if (marketingIndicators.some(indicator => lower.includes(indicator))) {
    return true;
  }
  if (text.length > 60 && (lower.includes(" and ") || lower.includes(", "))) {
    return true;
  }
  return false;
}

function looksLikeSocialMedia(text: string): boolean {
  const socialPatterns = [
    /^facebook$/i,
    /^twitter$/i,
    /^instagram$/i,
    /^linkedin$/i,
    /^youtube$/i,
    /^tiktok$/i,
    /^pinterest$/i,
    /^snapchat$/i,
    /^whatsapp$/i,
    /^tripadvisor$/i,
    /^trip\s*advisor$/i,
    /^yelp$/i,
    /^google\s*(maps?|reviews?|business)?$/i,
    /^follow\s*us\s*(on)?/i,
    /^like\s*us\s*(on)?/i,
    /^find\s*us\s*on/i,
    /^connect\s*(with\s*us)?/i,
    /^@\w+$/i,
    /^#\w+$/i
  ];
  return socialPatterns.some(pattern => pattern.test(text.trim()));
}

function looksLikeOpeningHours(text: string): boolean {
  const timePattern = /\b\d{1,2}[:.]\d{2}\s*[-–—to]\s*\d{1,2}[:.]\d{2}\b/i;
  if (timePattern.test(text)) {
    return true;
  }
  const amPmTimePattern = /\b\d{1,2}(am|pm)\s*[-–—to]\s*\d{1,2}(am|pm)\b/i;
  if (amPmTimePattern.test(text)) {
    return true;
  }
  const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dayAbbrevs = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const allDays = [...dayNames, ...dayAbbrevs];
  const dayRangePattern = new RegExp(`\\b(${allDays.join("|")})\\s*[-–—to]+\\s*(${allDays.join("|")})\\b`, "i");
  if (dayRangePattern.test(text)) {
    return true;
  }
  const singleDayPattern = new RegExp(`^(${allDays.join("|")})s?$`, "i");
  if (singleDayPattern.test(text.trim())) {
    return true;
  }
  const otherTimePatterns = [
    /^weekdays?$/i,
    /^weekends?$/i,
    /^daily$/i,
    /^open\s*\d/i,
    /^closed\s*(on\s*)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /^\d{1,2}(am|pm|:\d{2})\s*$/i,
    /^(breakfast|lunch|dinner)\s*(times?)?$/i,
    /^last\s*orders?$/i,
    /^kitchen\s*(hours|times|closes?)/i,
    /^bar\s*(hours|times|closes?)/i
  ];
  return otherTimePatterns.some(pattern => pattern.test(text.trim()));
}

function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

function isJunkLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (line.includes("©") || lower.includes("copyright") || lower.includes("all rights reserved")) {
    return true;
  }
  if (looksLikeEmail(line)) {
    return true;
  }
  if (looksLikeConcatenatedNavItems(lower)) {
    return true;
  }
  if (looksLikeOpeningHours(lower)) {
    return true;
  }
  if (looksLikeCallToAction(lower)) {
    return true;
  }
  if (looksLikeMarketingCopy(line)) {
    return true;
  }
  if (looksLikeSocialMedia(lower)) {
    return true;
  }
  const labelPatterns = [
    /^opening\s*(times|hours)?$/i,
    /^contact\s*(us|details)?$/i,
    /^find\s*us$/i,
    /^get\s*directions$/i,
    /^follow\s*us$/i,
    /^connect\s*with\s*us$/i,
    /^social\s*media$/i,
    /^menu$/i,
    /^menus$/i,
    /^food$/i,
    /^food\s*(menu|&\s*drink|and\s*drink)?$/i,
    /^traditional\s*food$/i,
    /^(home\s*)?cooked\s*food$/i,
    /^pub\s*food$/i,
    /^bar\s*food$/i,
    /^drinks?$/i,
    /^wine\s*(list|menu)?$/i,
    /^beer\s*(menu|list)?$/i,
    /^real\s*ales?$/i,
    /^cask\s*ales?$/i,
    /^craft\s*beers?$/i,
    /^live\s*music$/i,
    /^music$/i,
    /^music\s*(&|and)\s*events?$/i,
    /^events?\s*(&|and)\s*music$/i,
    /^events?$/i,
    /^what'?s\s*on$/i,
    /^pub\s*photos?$/i,
    /^photos?$/i,
    /^pictures?$/i,
    /^(photo\s*)?gallery$/i,
    /^gardens?\s*gallery$/i,
    /^image\s*gallery$/i,
    /^local\s*info(rmation)?$/i,
    /^area\s*info(rmation)?$/i,
    /^links?$/i,
    /^legal$/i,
    /^direction(s|\s*finder)?$/i,
    /^get\s*directions?$/i,
    /^prev(ious)?$/i,
    /^next$/i,
    /^prev(ious)?\s*next$/i,
    /^back$/i,
    /^forward$/i,
    /^more$/i,
    /^less$/i,
    /^show\s*(more|less)$/i,
    /^load\s*more$/i,
    /^view\s*(more|all)$/i,
    /^accommodation$/i,
    /^rooms?$/i,
    /^bed\s*(&|and)\s*breakfast$/i,
    /^b\s*&\s*b$/i,
    /^book\s*(a\s*table|now|online)?$/i,
    /^booking$/i,
    /^reservations?$/i,
    /^privacy\s*policy$/i,
    /^privacy$/i,
    /^privacy\s*(&|and)\s*cookies?$/i,
    /^cookies?\s*(&|and)\s*privacy$/i,
    /^terms\s*(and|&)\s*conditions$/i,
    /^cookie\s*policy$/i,
    /^cookies?$/i,
    /^sitemap$/i,
    /^home$/i,
    /^about\s*us$/i,
    /^about$/i,
    /^gallery$/i,
    /^news$/i,
    /^events$/i,
    /^news\s*(&|and)\s*events$/i,
    /^plan\s*your\s*visit$/i,
    /^things\s*to\s*(do|see)$/i,
    /^special\s*events$/i,
    /^group\s*visits?$/i,
    /^experiences?$/i,
    /^blog$/i,
    /^visitor\s*info(rmation)?$/i,
    /^tickets?$/i,
    /^buy\s*tickets?$/i,
    /^shop$/i,
    /^gift\s*shop$/i,
    /^our\s*story$/i,
    /^history$/i,
    /^faq(s)?$/i,
    /^help$/i,
    /^support$/i,
    /^accessibility$/i,
    /^careers?$/i,
    /^jobs?$/i,
    /^press$/i,
    /^media$/i,
    /^partners?$/i,
    /^sponsors?$/i,
    /^what's\s*on$/i,
    /^whats\s*on$/i,
    /^explore$/i,
    /^discover$/i,
    /^learn\s*more$/i,
    /^read\s*more$/i,
    /^see\s*more$/i,
    /^view\s*all$/i,
    /^more\s*info(rmation)?$/i,
    /^subscribe$/i,
    /^newsletter$/i,
    /^sign\s*up$/i,
    /^log\s*in$/i,
    /^login$/i,
    /^register$/i,
    /^my\s*account$/i,
    /^basket$/i,
    /^cart$/i,
    /^checkout$/i,
    /^search$/i,
    /^facilities$/i,
    /^amenities$/i,
    /^services$/i,
    /^getting\s*(here|there)$/i,
    /^how\s*to\s*(find|get)\s*us$/i,
    /^directions$/i,
    /^parking$/i,
    /^location$/i,
    /^maps?$/i,
    /^opening$/i,
    /^view\s*(all\s*)?(opening\s*)?(times?|hours?)$/i,
    /^see\s*(all\s*)?(opening\s*)?(times?|hours?)$/i,
    /^closed$/i,
    /^admission$/i,
    /^top$/i,
    /^back\s*to\s*top$/i,
    /^scroll\s*(up|to\s*top)$/i,
    /^allergies?$/i,
    /^hygiene$/i,
    /^allergies?\s*(&|and)\s*hygiene$/i,
    /^venue\s*hire$/i,
    /^private\s*hire$/i,
    /^function\s*room$/i,
    /^wifi$/i,
    /^free\s*wifi$/i,
    /^creative\s*by\s*/i,
    /^design(ed)?\s*by\s*/i,
    /^built\s*by\s*/i,
    /^powered\s*by\s*/i,
    /^website\s*by\s*/i
  ];
  if (labelPatterns.some(pattern => pattern.test(lower))) {
    return true;
  }
  if (line.length > 80) {
    return true;
  }
  return false;
}

function removePostcodeFromPart(part: string, postcode: string | null): string {
  if (!postcode) {
    return part;
  }
  const postcodePattern = new RegExp(postcode.replace(/\s/g, "\\s*"), "gi");
  return part.replace(postcodePattern, "").trim();
}

function extractAddressLines(lines: string[], postcode: string | null): { name: string | null; address1: string | null; address2: string | null } {
  const result = { name: null as string | null, address1: null as string | null, address2: null as string | null };

  const allParts: string[] = [];
  lines.forEach(line => {
    // Skip junk lines early
    if (isJunkLine(line)) {
      return;
    }

    const lineWithoutUrls = line.replace(URL_REGEX, "").trim();
    const lineWithoutPhones = lineWithoutUrls.replace(PHONE_REGEX, "").trim();

    if (lineWithoutPhones.length < 3) {
      return;
    }

    const parts = lineWithoutPhones.split(",").map(part => cleanAddressLine(part));
    parts.forEach(part => {
      if (part.length >= 3 && !isJunkLine(part)) {
        allParts.push(part);
      }
    });
  });

  const filteredParts = allParts
    .map(part => removePostcodeFromPart(part, postcode))
    .filter(part => part.length >= 3 && !isJunkLine(part));

  if (filteredParts.length === 0) {
    return result;
  }

  const streetIndicators = /\b(road|rd|street|st|lane|ln|avenue|ave|drive|dr|close|cl|way|place|pl|court|ct|crescent|cres|hill|green|park|terrace|grove|gardens|row|walk|mews|rise|view|fields|meadow|copse)\b/i;
  const nameIndicators = /\b(pub|inn|tavern|hotel|house|arms|head|bell|crown|swan|bull|lion|rose|anchor|castle|oak|fox|bear|eagle|plough|cafe|coffee|restaurant|bistro|kitchen|hall|centre|center|church|chapel|farm|barn|manor|lodge|cottage|fire\s+station|the\s+\w+)\b/i;

  let nameIndex = -1;
  let firstNonStreetIndex = -1;

  filteredParts.forEach((part, index) => {
    const hasStreetIndicator = streetIndicators.test(part);
    const hasNameIndicator = nameIndicators.test(part);

    if (hasNameIndicator && nameIndex === -1) {
      nameIndex = index;
    }
    if (!hasStreetIndicator && firstNonStreetIndex === -1) {
      firstNonStreetIndex = index;
    }
  });

  if (nameIndex === -1 && firstNonStreetIndex !== -1) {
    nameIndex = firstNonStreetIndex;
  }

  if (nameIndex !== -1) {
    result.name = filteredParts[nameIndex];
  }

  const addressParts = filteredParts.filter((part, index) => {
    if (index === nameIndex) return false;
    if (nameIndicators.test(part)) return false;
    return true;
  });

  const streetIndex = addressParts.findIndex(part => streetIndicators.test(part));
  if (streetIndex !== -1) {
    result.address1 = addressParts[streetIndex];
    const remaining = addressParts.filter((_, i) => i !== streetIndex);
    if (remaining.length > 0) {
      result.address2 = remaining[0];
    }
  } else {
    addressParts.forEach((part, index) => {
      if (index === 0) {
        result.address1 = part;
      } else if (index === 1) {
        result.address2 = part;
      }
    });
  }

  return result;
}

export function parseVenueFromText(text: string): VenueParseResult {
  if (!isString(text) || isEmpty(text.trim())) {
    return {
      venue: {},
      confidence: 0,
      warnings: ["No text provided"]
    };
  }

  debugLog("parseVenueFromText: parsing text of length", text.length);

  const venue: ParsedVenue = {};
  const warnings: string[] = [];
  let confidence = 0;

  const cleanedText = cleanText(text);
  const lines = splitIntoLines(cleanedText);

  const postcodes = extractPostcodes(text);
  if (postcodes.length > 0) {
    venue.postcode = normalizePostcode(postcodes[0]);
    confidence += 30;
    if (postcodes.length > 1) {
      warnings.push(`Multiple postcodes found, using: ${venue.postcode}`);
    }
  }

  const urls = extractUrls(text);
  if (urls.length > 0) {
    venue.url = urls[0];
    confidence += 20;
    if (urls.length > 1) {
      warnings.push(`Multiple URLs found, using first one`);
    }
  }

  const phones = extractPhones(text);
  if (phones.length > 0) {
    venue.phone = phones[0];
    confidence += 10;
  }

  const addressLines = extractAddressLines(lines, venue.postcode || null);
  if (addressLines.name) {
    venue.name = addressLines.name;
    confidence += 25;
  }
  if (addressLines.address1) {
    venue.address1 = addressLines.address1;
    confidence += 15;
  }
  if (addressLines.address2) {
    venue.address2 = addressLines.address2;
    confidence += 10;
  }

  venue.type = inferVenueTypeFromName(text + " " + (venue.name || ""));

  if (isEmpty(venue.name) && isEmpty(venue.postcode)) {
    warnings.push("Could not extract venue name or postcode");
    confidence = 0;
  }

  debugLog("parseVenueFromText: result", { venue, confidence, warnings });

  return { venue, confidence, warnings };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<(br|p|div|h[1-6]|li|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length > 0)
    .join("\n");
}

function extractJsonLdVenue(html: string): ParsedVenue | null {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!jsonLdMatches) {
    return null;
  }

  for (const match of jsonLdMatches) {
    try {
      const jsonContent = match.replace(/<script[^>]*>/gi, "").replace(/<\/script>/gi, "").trim();
      const data = JSON.parse(jsonContent);

      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const types = ["Restaurant", "BarOrPub", "CafeOrCoffeeShop", "LocalBusiness", "FoodEstablishment", "Place"];
        const itemType = item["@type"];
        if (types.includes(itemType) || (Array.isArray(itemType) && itemType.some(t => types.includes(t)))) {
          const venue: ParsedVenue = {};

          if (item.name) {
            venue.name = decodeHtmlEntities(String(item.name));
          }

          if (item.address) {
            const addr = item.address;
            if (typeof addr === "string") {
              venue.address1 = decodeHtmlEntities(addr);
            } else if (addr.streetAddress) {
              venue.address1 = decodeHtmlEntities(String(addr.streetAddress));
              if (addr.addressLocality) {
                venue.address2 = decodeHtmlEntities(String(addr.addressLocality));
              }
              if (addr.postalCode) {
                venue.postcode = normalizePostcode(String(addr.postalCode));
              }
            }
          }

          if (item.telephone) {
            venue.phone = String(item.telephone);
          }

          if (item.url) {
            venue.url = String(item.url);
          }

          if (venue.name || venue.postcode) {
            debugLog("extractJsonLdVenue: found structured data", venue);
            return venue;
          }
        }
      }
    } catch (e) {
      debugLog("extractJsonLdVenue: failed to parse JSON-LD", e);
    }
  }

  return null;
}

function extractAddressTagContent(html: string): string {
  const addressMatches = html.match(/<address[^>]*>([\s\S]*?)<\/address>/gi);
  if (addressMatches && addressMatches.length > 0) {
    const addressContent = addressMatches
      .map(match => {
        const content = match.replace(/<address[^>]*>/gi, "").replace(/<\/address>/gi, "");
        return decodeHtmlEntities(stripHtmlTags(content));
      })
      .join("\n");
    debugLog("extractAddressTagContent: found address tag content", addressContent);
    return addressContent;
  }
  return "";
}

function extractFooterContent(html: string): string {
  const footerMatches = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/gi);
  if (footerMatches && footerMatches.length > 0) {
    let footerHtml = footerMatches.join("\n");
    footerHtml = footerHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
    const footerText = decodeHtmlEntities(stripHtmlTags(footerHtml));
    // Filter out junk lines from footer
    const cleanedLines = footerText
      .split("\n")
      .filter(line => !isJunkLine(line.trim()))
      .join("\n");
    debugLog("extractFooterContent: found footer content length", cleanedLines.length);
    return cleanedLines;
  }
  return "";
}

function cleanVenueName(name: string): string {
  if (!name) return "";
  let cleaned = name.trim();

  // Split on common title separators - use multiple approaches for robustness
  const separatorPatterns = [
    /\s+[|]\s+/,           // pipe with spaces
    /\s+[-]\s+/,           // hyphen with spaces
    /\s+[–]\s+/,           // en-dash with spaces (U+2013)
    /\s+[—]\s+/,           // em-dash with spaces (U+2014)
    /\s*:\s+/              // colon (typically title: subtitle)
  ];

  for (const pattern of separatorPatterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.split(pattern)[0].trim();
      break;
    }
  }

  // Remove common tagline phrases that follow venue names
  const taglinePatterns = [
    /\s+(traditional|classic|historic|modern|contemporary|award[- ]winning)\s+(country\s+)?(pub|inn|hotel|restaurant|cafe|bar|gastropub).*$/i,
    /\s+in\s+the\s+heart\s+of\s+.*$/i,
    /\s+located\s+in\s+.*$/i,
    /\s+situated\s+in\s+.*$/i,
    /\s+nestled\s+in\s+.*$/i,
    /\s+(pub|inn|hotel)\s+(&|and|with)\s+(restaurant|rooms|accommodation|garden|terrace).*$/i,
    /\s+your\s+(local|neighbourhood|neighborhood).*$/i,
    /\s+a\s+(warm\s+)?welcome.*$/i
  ];

  for (const pattern of taglinePatterns) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  return cleaned.trim();
}

function extractTitleFromHtml(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    let title = decodeHtmlEntities(titleMatch[1]).trim();
    title = cleanVenueName(title);
    if (title.length > 0 && title.length < 100) {
      return title;
    }
  }
  return null;
}

function extractMetaDescription(html: string): string | null {
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  if (metaMatch) {
    return decodeHtmlEntities(metaMatch[1]).trim();
  }
  return null;
}

function extractMainHeading(html: string): string | null {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const heading = decodeHtmlEntities(stripHtmlTags(h1Match[1])).trim();
    if (heading.length > 0 && heading.length < 100 && !isJunkLine(heading)) {
      return heading;
    }
  }
  return null;
}

export function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  text = decodeHtmlEntities(stripHtmlTags(text));

  return text;
}

export function parseVenueFromHtml(html: string, sourceUrl?: string): VenueParseResult {
  debugLog("parseVenueFromHtml: starting, html length", html.length);

  const jsonLdVenue = extractJsonLdVenue(html);
  if (jsonLdVenue && (jsonLdVenue.name || jsonLdVenue.postcode)) {
    const warnings: string[] = [];
    let confidence = 0;

    if (jsonLdVenue.name) confidence += 30;
    if (jsonLdVenue.postcode) confidence += 30;
    if (jsonLdVenue.address1) confidence += 20;
    if (jsonLdVenue.phone) confidence += 10;

    jsonLdVenue.type = inferVenueTypeFromName(jsonLdVenue.name || "");

    if (sourceUrl && !jsonLdVenue.url) {
      jsonLdVenue.url = sourceUrl;
      confidence += 10;
    }

    debugLog("parseVenueFromHtml: using JSON-LD data", jsonLdVenue);
    return { venue: jsonLdVenue, confidence, warnings };
  }

  const addressTagContent = extractAddressTagContent(html);
  const footerContent = extractFooterContent(html);
  const title = extractTitleFromHtml(html);
  const mainHeading = extractMainHeading(html);
  const metaDescription = extractMetaDescription(html);

  const priorityText = [addressTagContent, footerContent].filter(t => t.length > 0).join("\n");

  if (priorityText.length > 0) {
    debugLog("parseVenueFromHtml: trying priority text (address/footer)", priorityText.substring(0, 200));
    const priorityResult = parseVenueFromText(priorityText);

    if (priorityResult.confidence > 0) {
      if (!priorityResult.venue.name) {
        if (mainHeading) {
          priorityResult.venue.name = mainHeading;
          priorityResult.confidence += 20;
        } else if (title) {
          priorityResult.venue.name = title;
          priorityResult.confidence += 15;
        }
      }

      if (!priorityResult.venue.type || priorityResult.venue.type === VenueTypeValue.OTHER) {
        priorityResult.venue.type = inferVenueTypeFromName((mainHeading || "") + " " + (title || "") + " " + (priorityResult.venue.name || ""));
      }

      if (sourceUrl && !priorityResult.venue.url) {
        priorityResult.venue.url = sourceUrl;
        priorityResult.confidence += 10;
      }

      debugLog("parseVenueFromHtml: using priority text result", priorityResult);
      return priorityResult;
    }
  }

  const bodyText = extractTextFromHtml(html);
  const combinedText = [metaDescription, bodyText].filter(t => t).join("\n");
  const result = parseVenueFromText(combinedText);

  if (!result.venue.name) {
    if (mainHeading) {
      result.venue.name = mainHeading;
      result.confidence += 20;
    } else if (title) {
      result.venue.name = title;
      result.confidence += 15;
    }
  }

  if (!result.venue.type || result.venue.type === VenueTypeValue.OTHER) {
    result.venue.type = inferVenueTypeFromName((mainHeading || "") + " " + (title || "") + " " + (result.venue.name || ""));
  }

  if (sourceUrl && !result.venue.url) {
    result.venue.url = sourceUrl;
    result.confidence += 10;
  }

  debugLog("parseVenueFromHtml: final result", result);
  return result;
}
