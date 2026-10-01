export interface RecipientRow {
  email: string;
  deliveredDate: string;
  openDate: string;
  unsubscribeDate: string;
  hardBounceDate: string;
  softBounceDate: string;
  clickedCount: number;
  clickedLinks: string[];
}

export interface RecipientSelector {
  select: (row: RecipientRow) => boolean;
  date: (row: RecipientRow) => string;
  links?: (row: RecipientRow) => string[];
}

export interface CachedRecipientRows {
  rows: RecipientRow[];
  cachedAt: number;
}

export interface MemberRecipientInfo {
  name?: string;
  membershipNumber?: string;
}
