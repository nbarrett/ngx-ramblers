export enum FeatureCategory {
  FACILITIES = "Facilities",
  TRANSPORT = "Transport",
  ACCESSIBILITY = "Accessibility",
  UNUSED_FEATURES = "Unused Features"
}

export enum Feature {
  ASSISTANCE_DOGS = "assistance-dogs",
  BACK = "back",
  BACK_LINK = "back-link",
  BACK_ROUND = "back-round",
  CAR_PARKING = "car-parking",
  CAR_SHARING = "car-sharing",
  CHAT = "chat",
  CLOCK = "clock",
  COACH_TRIP = "coach-trip",
  COMPONENT_TICK_DESKTOP = "component-tick-desktop",
  COMPONENT_TICK_MOBILE = "component-tick-mobile",
  COPYRIGHT = "copyright",
  CROSS = "cross",
  CURSOR = "cursor",
  DOG_FRIENDLY = "dog-friendly",
  DOWN = "down",
  EMAIL_ICON = "email-icon",
  EXTERNAL_LINK = "external-link",
  FACEBOOK = "facebook",
  FACEBOOK_ICON = "facebook-icon",
  FAMILY_FRIENDLY = "family-friendly",
  FAST_PACE = "fast-pace",
  FOOTPRINT = "footprint",
  FORWARD = "forward",
  FORWARD_ROUND = "forward-round",
  GATE = "gate",
  HAT = "hat",
  HIKING = "hiking",
  HOME = "home",
  INFORMATION = "information",
  INSTAGRAM = "instagram",
  INTRODUCTORY_WALK = "introductory-walk",
  LINKEDIN_IN = "linkedin-in",
  LOCATION = "location",
  MAIL = "mail",
  MAY_BE_MUDDY = "may-be-muddy",
  MEETUP = "meetup",
  MENU = "menu",
  NO_CAR = "no-car",
  NO_STILES = "no-stiles",
  PLAY = "play",
  PUBLIC_TRANSPORT = "public-transport",
  PUSHCHAIR_FRIENDLY = "pushchair-friendly",
  QUOTE_END = "quote-end",
  QUOTE_START = "quote-start",
  RAIN = "rain",
  REFRESHMENTS = "refreshments",
  REST_STOP_AVAILABLE = "rest-stop-available",
  SEARCH = "search",
  SIGNPOST = "signpost",
  SLOWER_PACE = "slower-pace",
  SOME_INCLINES = "some-inclines",
  SUN = "sun",
  TICK = "tick",
  TOILETS = "toilets",
  TREE = "tree",
  TWITTER = "twitter",
  TWITTER_ICON = "twitter-icon",
  UNEVEN_GROUND = "uneven-ground",
  UP = "up",
  WHATSAPP = "whatsapp",
  WHEELCHAIR_ACCESSIBLE = "wheelchair-accessible",
  YOUTUBE = "youtube"
}

export interface DescribedFeature {
  code: Feature;
  description: string;
}

export interface CategorisedFeatures {
  category: FeatureCategory;
  features: DescribedFeature[];
}

export const FEATURE_CATEGORIES: CategorisedFeatures[] = [
  {
    category: FeatureCategory.TRANSPORT,
    features: [
      {code: Feature.PUBLIC_TRANSPORT, description: "Accessible by public transport"},
      {code: Feature.CAR_PARKING, description: "Car parking available"},
      {code: Feature.CAR_SHARING, description: "Car sharing available"},
      {code: Feature.COACH_TRIP, description: "Coach trip"}
    ]
  },
  {
    category: FeatureCategory.FACILITIES,
    features: [
      {code: Feature.REFRESHMENTS, description: "Refreshments available (Pub/cafe)"},
      {code: Feature.TOILETS, description: "Toilets available"}
    ]
  },
  {
    category: FeatureCategory.ACCESSIBILITY,
    features: [
      {code: Feature.DOG_FRIENDLY, description: "Dog friendly"},
      {code: Feature.INTRODUCTORY_WALK, description: "Introductory walk"},
      {code: Feature.NO_CAR, description: "No car needed"},
      {code: Feature.PUSHCHAIR_FRIENDLY, description: "Pushchair friendly"},
      {code: Feature.NO_STILES, description: "No Stiles"},
      {code: Feature.FAMILY_FRIENDLY, description: "Family-Friendly"},
      {code: Feature.WHEELCHAIR_ACCESSIBLE, description: "Wheelchair accessible"}
    ]
  }
];

export const UNUSED_FEATURE_CATEGORIES: CategorisedFeatures[] = [
  {
    category: FeatureCategory.UNUSED_FEATURES,
    features: [
      {code: Feature.ASSISTANCE_DOGS, description: "Assistance dogs allowed"},
      {code: Feature.BACK, description: "Back button"},
      {code: Feature.BACK_LINK, description: "Back link"},
      {code: Feature.BACK_ROUND, description: "Back round icon"},
      {code: Feature.CHAT, description: "Chat feature"},
      {code: Feature.CLOCK, description: "Clock icon"},
      {code: Feature.COMPONENT_TICK_DESKTOP, description: "Component tick for desktop"},
      {code: Feature.COMPONENT_TICK_MOBILE, description: "Component tick for mobile"},
      {code: Feature.COPYRIGHT, description: "Copyright symbol"},
      {code: Feature.CROSS, description: "Cross icon"},
      {code: Feature.CURSOR, description: "Cursor icon"},
      {code: Feature.DOWN, description: "Down arrow"},
      {code: Feature.EMAIL_ICON, description: "Email icon"},
      {code: Feature.EXTERNAL_LINK, description: "External link icon"},
      {code: Feature.FACEBOOK, description: "Facebook link"},
      {code: Feature.FACEBOOK_ICON, description: "Facebook icon"},
      {code: Feature.FAST_PACE, description: "Fast pace indicator"},
      {code: Feature.FOOTPRINT, description: "Footprint icon"},
      {code: Feature.FORWARD, description: "Forward button"},
      {code: Feature.FORWARD_ROUND, description: "Forward round icon"},
      {code: Feature.GATE, description: "Gate icon"},
      {code: Feature.HAT, description: "Hat icon"},
      {code: Feature.HIKING, description: "Hiking indicator"},
      {code: Feature.HOME, description: "Home icon"},
      {code: Feature.INFORMATION, description: "Information icon"},
      {code: Feature.INSTAGRAM, description: "Instagram link"},
      {code: Feature.LINKEDIN_IN, description: "LinkedIn link"},
      {code: Feature.LOCATION, description: "Location icon"},
      {code: Feature.MAIL, description: "Mail icon"},
      {code: Feature.MAY_BE_MUDDY, description: "May be muddy indicator"},
      {code: Feature.MEETUP, description: "Meetup link"},
      {code: Feature.MENU, description: "Menu icon"},
      {code: Feature.PLAY, description: "Play button"},
      {code: Feature.QUOTE_END, description: "Quote end icon"},
      {code: Feature.QUOTE_START, description: "Quote start icon"},
      {code: Feature.RAIN, description: "Rain indicator"},
      {code: Feature.REST_STOP_AVAILABLE, description: "Rest stop available"},
      {code: Feature.SEARCH, description: "Search icon"},
      {code: Feature.SIGNPOST, description: "Signpost icon"},
      {code: Feature.SLOWER_PACE, description: "Slower pace indicator"},
      {code: Feature.SOME_INCLINES, description: "Some inclines indicator"},
      {code: Feature.SUN, description: "Sun icon"},
      {code: Feature.TICK, description: "Tick icon"},
      {code: Feature.TREE, description: "Tree icon"},
      {code: Feature.TWITTER, description: "Twitter link"},
      {code: Feature.TWITTER_ICON, description: "Twitter icon"},
      {code: Feature.UNEVEN_GROUND, description: "Uneven ground indicator"},
      {code: Feature.UP, description: "Up arrow"},
      {code: Feature.WHATSAPP, description: "WhatsApp link"},
      {code: Feature.YOUTUBE, description: "YouTube link"}
    ]
  }
];

export const ALL_DESCRIBED_FEATURES: DescribedFeature[] = (FEATURE_CATEGORIES.concat(UNUSED_FEATURE_CATEGORIES)).map(value => value.features).flat(2);
