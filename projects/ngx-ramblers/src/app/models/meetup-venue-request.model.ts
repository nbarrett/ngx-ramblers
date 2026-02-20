// • urlname (required) – None
// • address_1 – Primary address of the venue
// • address_2 – Secondary address info
// • city – City name of the venue
// • country – 2 character country code of the venue
// • hours – Open hours information about the venue
// • name – Unique name of the venue
// • phone – Optional phone number for the venue
// • visibility – Optional value indicating the venues visibility to others. May be one of private or public. Defaults to 'public'
// • web_url – Optional web url for the venue
export interface MeetupVenueRequest {
  address_1?: string;
  address_2?: string;
  city?: string;
  country?: string;
  hours?: string;
  name?: string;
  phone?: string;
  state?: string;
  visibility?: string;
  web_url?: string;
}
