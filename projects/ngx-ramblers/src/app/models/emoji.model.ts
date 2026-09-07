export interface EmojiShortcodeMatch {
  shortname: string;
  unicode: string;
}

export interface EmojiSynonym {
  keyword: string;
  shortnames: string[];
}

export interface EmojiSettings {
  synonyms: EmojiSynonym[];
}

export const EMOJI_SUGGESTION_LIMIT = 150;

export const DEFAULT_EMOJI_SYNONYMS: EmojiSynonym[] = [
  {keyword: "thanks", shortnames: ["pray", "clap", "raised_hands", "hugging", "heart", "sparkling_heart", "tada"]},
  {keyword: "thank", shortnames: ["pray", "clap", "raised_hands", "hugging", "heart"]},
  {keyword: "thankyou", shortnames: ["pray", "clap", "raised_hands", "heart"]},
  {keyword: "cheers", shortnames: ["beers", "clinking_glass", "wine_glass", "champagne"]},
  {keyword: "welldone", shortnames: ["clap", "muscle", "trophy", "first_place", "star"]},
  {keyword: "great", shortnames: ["clap", "star", "tada", "thumbsup"]},
  {keyword: "love", shortnames: ["heart", "hearts", "heart_eyes", "sparkling_heart"]},
  {keyword: "happy", shortnames: ["smile", "blush", "grinning", "sunny"]},
  {keyword: "walk", shortnames: ["walking", "hiking_boot", "mountain", "deciduous_tree", "national_park"]},
  {keyword: "hike", shortnames: ["hiking_boot", "mountain", "walking", "national_park"]},
  {keyword: "hiking", shortnames: ["hiking_boot", "mountain", "walking", "national_park"]},
  {keyword: "boots", shortnames: ["hiking_boot"]},
  {keyword: "sun", shortnames: ["sunny", "sunrise", "sunset"]},
  {keyword: "rain", shortnames: ["cloud_rain", "umbrella", "umbrella2"]},
  {keyword: "wet", shortnames: ["cloud_rain", "umbrella", "sweat_drops"]},
  {keyword: "cold", shortnames: ["snowflake", "cold_face", "cloud_snow"]},
  {keyword: "hot", shortnames: ["sunny", "hot_face", "fire"]},
  {keyword: "pub", shortnames: ["beers", "beer", "fork_knife"]},
  {keyword: "lunch", shortnames: ["fork_knife", "sandwich", "plate_with_cutlery"]},
  {keyword: "coffee", shortnames: ["coffee"]},
  {keyword: "tea", shortnames: ["tea"]},
  {keyword: "cake", shortnames: ["cake", "birthday"]},
  {keyword: "dog", shortnames: ["dog", "dog2", "paw_prints"]},
  {keyword: "photo", shortnames: ["camera", "camera_with_flash", "frame_photo"]},
  {keyword: "photos", shortnames: ["camera", "camera_with_flash", "frame_photo"]},
  {keyword: "sea", shortnames: ["ocean", "beach", "wave"]},
  {keyword: "beach", shortnames: ["beach", "ocean", "sunny"]},
  {keyword: "castle", shortnames: ["european_castle", "japanese_castle"]},
  {keyword: "train", shortnames: ["train", "steam_locomotive", "railway_track"]},
  {keyword: "bus", shortnames: ["bus", "busstop"]},
  {keyword: "map", shortnames: ["map", "compass", "round_pushpin"]},
  {keyword: "flowers", shortnames: ["blossom", "cherry_blossom", "sunflower", "tulip", "bouquet"]},
  {keyword: "birds", shortnames: ["bird", "duck", "swan", "eagle"]},
  {keyword: "sheep", shortnames: ["sheep", "ram"]},
  {keyword: "cows", shortnames: ["cow", "cow2"]},
  {keyword: "mud", shortnames: ["hiking_boot", "sweat_drops"]},
  {keyword: "tired", shortnames: ["tired_face", "sleeping", "weary"]},
  {keyword: "celebrate", shortnames: ["tada", "confetti_ball", "champagne", "clap"]}
];

export function emojiSynonymsToText(synonyms: EmojiSynonym[]): string {
  return (synonyms || []).map(synonym => `${synonym.keyword}: ${synonym.shortnames.join(", ")}`).join("\n");
}

export function emojiSynonymsFromText(text: string): EmojiSynonym[] {
  return (text || "").split("\n")
    .map(line => line.trim())
    .filter(line => line.includes(":"))
    .map(line => {
      const separator = line.indexOf(":");
      const keyword = line.slice(0, separator).trim().toLowerCase().replace(/[\s_-]+/g, "");
      const shortnames = line.slice(separator + 1).split(",")
        .map(shortname => shortname.trim().toLowerCase().replace(/^:/, "").replace(/:$/, ""))
        .filter(shortname => !!shortname);
      return {keyword, shortnames};
    })
    .filter(synonym => synonym.keyword && synonym.shortnames.length > 0);
}
