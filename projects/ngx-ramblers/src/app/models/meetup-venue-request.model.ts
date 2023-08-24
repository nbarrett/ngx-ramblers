export interface MeetupVenueRequest {
  address_1?: string;        // • urlname (required) – None
  address_2?: string;        // • address_1 – Primary address of the venue
  city?: string;             // • address_2 – Secondary address info
  country?: string;          // • city – City name of the venue
  hours?: string;            // • country – 2 character country code of the venue
  name?: string;             // • hours – Open hours information about the venue
  phone?: string;            // • name – Unique name of the venue
  state?: string;            // • phone – Optional phone number for the venue
  visibility?: string;       // • visibility – Optional value indicating the venues visibility to others. May be one of private or public. Defaults to ‘public’
  web_url?: string;          // • web_url – Optional web url for the venue
}
