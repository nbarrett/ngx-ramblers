export interface LinkConfig {
  area: string;
  subArea?: string;
  id: string;
  relative?: boolean;
}

export interface LinkTextConfig {
  name: string;
  text?: string;
  href: string;
}

export interface AWSLinkConfig {
  name: string;
}
