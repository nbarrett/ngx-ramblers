import { MailchimpContact } from "../../../../../server/lib/shared/server-models";
import { ApiResponse } from "./api-response.model";
import { AuditStatus } from "./audit";

type EmailType = "text"|"html";

export type Status = "subscribed" | "unsubscribed" | "cleaned" | "pending" | "transactional";

export interface BatchListMembersBodyMembersObject {
  email_address: string;
  email_type: EmailType;
  status: Status;
  vip?: boolean;
  location?: {
    latitude: number;
    longtitude: number;
  };
  tags?: string[]; // non-documented tho still available to use
  ip_signup?: string;
  timestamp_signup?: string;
  ip_opt?: string;
  timestamp_opt?: string;
  language?: string; // https://mailchimp.com/help/view-and-edit-contact-languages/
  merge_fields?: {[k: string]: string}; // https://mailchimp.com/developer/marketing/docs/merge-fields/#structure
}

export interface BatchListMembersOpts {
  skipMergeValidation?: boolean;
  skipDuplicateCheck?: boolean;
}

export interface BatchListMembersBody {
  members: BatchListMembersBodyMembersObject[];
  sync_tags?: boolean;
  update_existing?: boolean;
}

export interface MailchimpConfig {
  apiUrl: string;
  apiKey: string;
  allowSendCampaign: boolean;
  mailchimpEnabled: boolean;
  contactDefaults: MailchimpContact;
  campaignDefaults: MailchimpCampaignDefaults,
  lists: {
    walks?: string;
    socialEvents?: string;
    general?: string
  };
  segments: {
    walks: {};
    socialEvents: {};
    general: {
      passwordResetSegmentId: number;
      forgottenPasswordSegmentId: number;
      welcomeSegmentId: number;
      committeeSegmentId: number;
      expiredMembersSegmentId: number;
      expiredMembersWarningSegmentId: number
    }
  };
  campaigns: {
    walkNotification: CampaignConfig;
    expenseNotification: CampaignConfig;
    passwordReset: CampaignConfig;
    forgottenPassword: CampaignConfig;
    welcome: CampaignConfig;
    socialEvents: CampaignConfig;
    committee: CampaignConfig;
    expiredMembers: CampaignConfig;
    newsletter: CampaignConfig;
    expiredMembersWarning: CampaignConfig;
  };
}

export enum SubscriptionStatus {
  SUBSCRIBED = "subscribed",
  UNSUBSCRIBED = "unsubscribed",
  CLEANED = "cleaned",
  PENDING = "pending"
}

export enum Frequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly"
}

export enum WinnerCriteria {
  OPENS = "opens",
  CLICKS = "clicks",
  MANUAL = "manual",
  TOTAL_REVENUE = "total_revenue"
}

export interface CampaignConfig {
  campaignId: string;
  name: string;
  monthsInPast?: number;
}

export enum CustomMergeFieldTag {
  MEMBER_NUM = "MEMBER_NUM",
  MEMBER_EXP = "MEMBER_EXP",
  USERNAME = "USERNAME",
  PW_RESET = "PW_RESET",
}
export interface MergeFields {
  EMAIL: string;
  FNAME: string;
  LNAME: string;
  MEMBER_NUM: string;
  USERNAME: string;
  PW_RESET: string;
  MEMBER_EXP: string;
}

export interface MergeVariablesRequest {
  merge_vars: MergeFields;
}

export interface MailchimpMemberIdentifiers {
  email_address: string;
  unique_email_id?: string;
  web_id: number;
}

export interface MailchimpListsMembersResponse {
  list_id: string;
  members: MailchimpListMember[];
}

export interface MailchimpSegmentUpdateResponse {
  id: number;
  name: string;
  member_count: number;
  type: string;
  created_at: string;
  updated_at: string;
  options: {
    match: string;
    conditions: Condition[]
  },
  list_id: string;
  _links: Link[]
}

export interface MailchimpListingResponse {
  lists: MailchimpList[],
  total_items: number;
  constraints: {
    may_create: boolean;
    max_instances: number;
    current_total_instances: number
  },
  _links: Link[]
}

export interface MailchimpCampaignDefaults {
  from_name: string;
  from_email: string;
  subject: string;
  language: string;
}

export type MergeFieldType = "text" | "number" | "address" | "phone" | "date" | "url" | "imageurl" | "radio" | "dropdown" | "birthday" | "zip";

export interface MergeField {
  merge_id?: number;
  tag?: string;
  name: string;
  type: MergeFieldType;
  required?: boolean;
  default_value?: string;
  public?: boolean;
  display_order?: number;
  options?: {
    default_country: number;
    phone_format: string;
    date_format: string;
    choices: string[];
    size: number;
  };
  help_text?: string;
  list_id?: string;
  _links?: Link[];
}

export interface MergeFieldAddResponse {
  merge_id: number;
  tag: string;
  name: string;
  type: string;
  required: boolean;
  default_value: string;
  public: boolean;
  display_order: number;
  options: {
    size: number;
    date_format: string;
    choices: string[];
    default_country: number;
    phone_format: string
  };
  help_text: string;
  list_id: string;
  _links: Link[];
}

export interface MailchimpList {
  id: string;
  web_id: number;
  name: string;
  contact: {
    company: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string;
  },
  permission_reminder: string;
  use_archive_bar: false,
  campaign_defaults: MailchimpCampaignDefaults,
  notify_on_subscribe: false,
  notify_on_unsubscribe: false,
  date_created: string;
  list_rating: number;
  email_type_option: boolean;
  subscribe_url_short: string;
  subscribe_url_long: string;
  beamer_address: string;
  visibility: string;
  double_optin: false,
  has_welcome: false,
  marketing_permissions: false,
  modules: string[];
  stats: {
    member_count: number;
    total_contacts: number;
    unsubscribe_count: number;
    cleaned_count: number;
    member_count_since_send: number;
    unsubscribe_count_since_send: number;
    cleaned_count_since_send: number;
    campaign_count: number;
    campaign_last_sent: string;
    merge_field_count: number;
    avg_sub_rate: number;
    avg_unsub_rate: number;
    target_sub_rate: number;
    open_rate: number;
    click_rate: number;
    last_sub_date: string;
    last_unsub_date: string;
  },
  _links: Link[]
}

export interface MailchimpSubscription {
  subscribed?: boolean;
  updated?: boolean;
  leid?: number;   // will be deleted
  unique_email_id?: string;
  web_id?: number;
  lastUpdated?: number;
  email?: SubscriberIdentifiers;
}

export interface SubscriberIdentifiers {
  email: string;
  euid?: string;
  leid?: number;
}

export interface MailchimpSubscriptionMember {
  email_address: string;
  status: SubscriptionStatus;
  merge_fields: MergeFields;
}

export type SubscriptionRequest = SubscriberIdentifiers | MergeVariablesRequest & MailchimpSubscription;

export interface MailchimpUpdateSegmentRequest {
  segmentId: number;
  resetSegmentMembers: boolean;
  segmentName: string;
}

export interface MailchimpBatchSubscriptionResponse {
  new_members: MailchimpMember[];
  updated_members: MailchimpMember[];
  errors: MailchimpEmailWithError[];
  total_created: number;
  total_updated: number;
  error_count: number;
  _links: Link[];
}

export interface MailchimpListSegmentAddOrRemoveMembersRequest {
  segmentId: number;
  membersToAdd: SubscriptionRequest[];
  membersToRemove: SubscriptionRequest[];
}

export interface MemberLocation {
  latitude: number;
  logitude: number;
}

export interface FullMemberLocation extends MemberLocation {
  gmtoff: number;
  dstoff: number;
  country_code: string;
  timezone: string;
  region: string;
}

export interface BatchListMembersResponse {
  new_members?: MembersSuccessResponse[];
  updated_members?: MembersSuccessResponse[];
  errors?: Array<{
    email_address: string;
    error: string;
    error_code: string;
    field: string;
    field_message: string;
  }>;
}

interface MembersSuccessResponse {
  id: string;
  email_address: string;
  unique_email_id: string;
  contact_id: string;
  full_name: string;
  web_id: number;
  email_type: string;
  status: string;
  unsubscribe_reason: string;
  consents_to_one_to_one_messaging: boolean;
  merge_fields: Record<string, any>;
  interests: Record<string, any>;
  stats: MemberStats;
  ip_signup: string;
  timestamp_signup: string;
  ip_opt: string;
  timestamp_opt: string;
  member_rating: string;
  last_changed: string;
  language: string;
  vip: boolean;
  email_client: string;
  location: FullMemberLocation;
  marketing_permissions: MemberMarketingPermissions[];
  last_note: MemberLastNote;
  source: string;
  tags_count: number;
  tags: Tag[];
  list_id: string;
  _links: Link[];
}

interface MemberLastNote {
  note_id: number;
  created_at: string;
  created_by: string;
  note: string;
}

interface MemberMarketingPermissions extends MemberMarketingPermissionsInput {
  text: string;
}

interface MemberMarketingPermissionsInput {
  marketing_permission_id: string;
  enabled: boolean;
}

interface MemberStats {
  avg_open_rate: number;
  avg_click_rate: number;
  ecommerce_data: MemberEcommerceData;
}

interface MemberEcommerceData {
  total_revenue: number;
  number_of_orders: number;
  currency_code: number;
}

interface MembersSuccessResponse {
  id: string;
  email_address: string;
  unique_email_id: string;
  contact_id: string;
  full_name: string;
  web_id: number;
  email_type: string;
  status: string;
  unsubscribe_reason: string;
  consents_to_one_to_one_messaging: boolean;
  merge_fields: Record<string, any>;
  interests: Record<string, any>;
  stats: MemberStats;
  ip_signup: string;
  timestamp_signup: string;
  ip_opt: string;
  timestamp_opt: string;
  member_rating: string;
  last_changed: string;
  language: string;
  vip: boolean;
  email_client: string;
  location: FullMemberLocation;
  marketing_permissions: MemberMarketingPermissions[];
  last_note: MemberLastNote;
  source: string;
  tags_count: number;
  tags: Tag[];
  list_id: string;
  _links: Link[];
}

export interface MailchimpListSegmentBatchAddOrRemoveMembersResponse {
  members_added: [
    {
      id: string;
      email_address: string;
      unique_email_id: string;
      email_type: string;
      status: string;
      merge_fields: {
        property1: null,
        property2: null
      },
      interests: {
        property1: true,
        property2: true
      },
      stats: {
        avg_open_rate: number;
        avg_click_rate: 0
      },
      ip_signup: string;
      timestamp_signup: string;
      ip_opt: string;
      timestamp_opt: string;
      member_rating: number;
      last_changed: string;
      language: string;
      vip: true,
      email_client: string;
      location: {
        latitude: number;
        longitude: number;
        gmtoff: number;
        dstoff: number;
        country_code: string;
        timezone: string;
      },
      last_note: {
        note_id: number;
        created_at: string;
        created_by: string;
        note: string;
      },
      tags_count: number;
      tags: [
        {
          id: number;
          name: string;
        }
      ],
      list_id: string;
      _links: Link[]
    }
  ],
  members_removed: [
    {
      id: string;
      email_address: string;
      unique_email_id: string;
      email_type: string;
      status: string;
      merge_fields: {
        property1: null,
        property2: null
      },
      interests: {
        property1: true,
        property2: true
      },
      stats: {
        avg_open_rate: number;
        avg_click_rate: number;
      },
      ip_signup: string;
      timestamp_signup: string;
      ip_opt: string;
      timestamp_opt: string;
      member_rating: number;
      last_changed: string;
      language: string;
      vip: true,
      email_client: string;
      location: {
        latitude: number;
        longitude: number;
        gmtoff: number;
        dstoff: number;
        country_code: string;
        timezone: string;
      },
      last_note: {
        note_id: number;
        created_at: string;
        created_by: string;
        note: string;
      },
      tags_count: number;
      tags: [
        {
          id: number;
          name: string;
        }
      ],
      list_id: string;
      _links: Link[]
    }
  ],
  errors: [
    {
      email_addresses: string[],
      error: string;
    }
  ],
  total_added: number;
  total_removed: number;
  error_count: number;
  _links: Link[]
}

export interface MailchimpListSegmentAddResponse {
  id: number;
  status: string;
  code: number;
  name: string;
  error: string;
}

export interface MailchimpListSegmentDeleteResponse {
  complete: boolean;
}

export interface MailchimpCampaignListRequest {
  start: number;
  limit: number;
  concise: boolean;
  status: string;
  query?: string;
}

export interface MailchimpCampaignSearchRequest {
  concise: boolean;
  query?: string;
}

export interface MailchimpCampaignSearchResponse {
  results: [{
    campaign: MailchimpCampaign;
  }];
}

export interface VariateSettingsAB {
  wait_time: number;
  test_size: number;
  subject_lines: string[];
  send_times: string[];
  from_names: string[];
  reply_to_addresses: string[];
  winner_criteria: WinnerCriteria;
}

export interface Sections {
  [key: string]: string;
}

export interface MultiVariateSettings {
  archive?: {
    archive_content: string;
    archive_type: string;
  };
  template: {
    id: number;
    sections: Sections;
  };
  content_label: string;
  plain_text?: string;
  html?: string;
  url?: string;
}

export interface VariateSettings {
  winning_combination_id: string;
  winning_campaign_id: string;
  winner_criteria: WinnerCriteria;
  wait_time: number;
  test_size: number;
  subject_lines: string[];
  send_times: string[];
  from_names: string[];
  reply_to_addresses: string[];
  contents: string[];
  combinations: [
    {
      id: string;
      subject_line: number;
      send_time: number;
      from_name: number;
      reply_to: number;
      content_description: number;
      recipients: number
    }
  ];
}

export interface OtherOptions {
  from_email?: string;
  from_name?: string;
  list_id?: string;
}

export interface MailchimpCampaignContentUpdateRequest {
  archive?: {
    archive_type: string;
    archive_content: string;
  };
  template: {
    sections: Sections
    id: number;
  };
  plain_text?: string;
  html?: string;
  url?: string;
  variate_contents?: MultiVariateSettings[];
}

export interface MailchimpCampaignUpdateRequest {
  recipients: {
    segment_opts: {
      saved_segment_id: number;
      prebuilt_segment_id?: string;
      match?: string;
      conditions?: Condition[];
    }
    list_id: string;
  };
  settings: {
    preview_text?: string;
    title?: string;
    use_conversation?: boolean;
    to_name?: string;
    folder_id?: string;
    authenticate?: boolean;
    auto_footer?: boolean;
    inline_css?: boolean;
    auto_tweet?: boolean;
    auto_fb_post?: boolean;
    fb_comments?: string;
    template_id?: string;
    subject_line: string;
    from_name: string;
    reply_to?: string;
  };
  rss_opts?: {
    schedule: {}
    constrain_rss_img: boolean;
    feed_url: string;
    frequency: Frequency;
  };
  variate_settings?: VariateSettingsAB;
  tracking?: {};
  social_card?: {};
}

export interface Condition {
  field: string;
  op: string;
  value: string;
  extra?: string;
}

export interface Conditions {
  name: string;
  options: {
    match: string;
    conditions: Condition[];
  };
}

export interface MailchimpCampaignListResponse {
  campaigns: MailchimpCampaign[];
  total_items: number;
  _links: Link[];
}

export interface MailchimpSetContentResponse {
  id: string;
  web_id: number;
  type: string;
  create_time: string;
  archive_url: string;
  long_archive_url: string;
  status: string;
  emails_sent: number;
  send_time: string;
  content_type: string;
  needs_block_refresh: boolean;
  resendable: boolean;
  recipients: {
    list_id: string;
    list_is_active: boolean;
    list_name: string;
    segment_text: string; recipient_count: number;
    segment_opts: {
      saved_segment_id: number;
      match: string;
      conditions: Condition[];
    }
  };
  settings: {
    subject_line: string;
    title: string;
    from_name: string;
    reply_to: string;
    use_conversation: boolean;
    to_name: string;
    folder_id: string;
    authenticate: boolean;
    auto_footer: boolean;
    inline_css: boolean;
    auto_tweet: boolean;
    fb_comments: boolean;
    timewarp: boolean;
    template_id: number;
    drag_and_drop: boolean
  };

  tracking: {
    opens: boolean;
    html_clicks: boolean;
    text_clicks: boolean;
    goal_tracking: boolean;
    ecomm360: boolean;
    google_analytics: string;
    clicktale: string;
  };
  delivery_status: { enabled: boolean; };
  _links: Link[];
}

export interface MailchimpCampaign {
  id: string;
  web_id: number;
  parent_campaign_id: string;
  type: string;
  create_time: string;
  archive_url: string;
  long_archive_url: string;
  status: string;
  emails_sent: number;
  send_time: string;
  content_type: string;
  needs_block_refresh: boolean;
  resendable: boolean;
  recipients: {
    list_id: string;
    list_is_active: boolean;
    list_name: string;
    segment_text: string;
    recipient_count: number;
    segment_opts: {
      saved_segment_id: number;
      prebuilt_segment_id: string;
      match: string;
      conditions: Condition[];
    }
  };
  settings: {
    subject_line: string;
    preview_text: string;
    title: string;
    from_name: string;
    reply_to: string;
    use_conversation: boolean;
    to_name: string;
    folder_id: string;
    authenticate: boolean;
    auto_footer: boolean;
    inline_css: boolean;
    auto_tweet: boolean;
    auto_fb_post: string[];
    fb_comments: boolean;
    timewarp: boolean;
    template_id: number;
    drag_and_drop: boolean;
  };
  variate_settings: VariateSettings;
  tracking: {
    opens: boolean;
    html_clicks: boolean;
    text_clicks: boolean;
    goal_tracking: boolean;
    ecomm360: boolean;
    google_analytics: string;
    clicktale: string;
    salesforce: {
      campaign: boolean;
      notes: boolean;
    };
    capsule: {
      notes: boolean;
    }
  };
  rss_opts: {
    feed_url: string;
    frequency: string;
    schedule: {
      hour: number;
      daily_send: {
        sunday: boolean;
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean;
      };
      weekly_send_day: string;
      monthly_send_date: number
    };
    last_sent: string;
    constrain_rss_img: boolean;
  };
  ab_split_opts: {
    split_test: string;
    pick_winner: string;
    wait_units: string;
    wait_time: number;
    split_size: number;
    from_name_a: string;
    from_name_b: string;
    reply_email_a: string;
    reply_email_b: string;
    subject_a: string;
    subject_b: string;
    send_time_a: string;
    send_time_b: string;
    send_time_winner: string;
  };
  social_card: {
    image_url: string;
    description: string;
    title: string;
  };
  report_summary: {
    opens: number;
    unique_opens: number;
    open_rate: number;
    clicks: number;
    subscriber_clicks: number;
    click_rate: number;
    ecommerce: {
      total_orders: number;
      total_spent: number;
      total_revenue: number
    }
  };
  delivery_status: {
    enabled: boolean;
    can_cancel?: boolean;
    status?: string;
    emails_sent?: number;
    emails_canceled?: number
  };
  _links: Link[];
}

export interface MailchimpCampaignReplicateResponse {
  id: string;
  web_id: number;
  parent_campaign_id: string;
  type: string;
  create_time: string;
  archive_url: string;
  long_archive_url: string;
  status: string;
  emails_sent: number;
  send_time: string;
  content_type: string;
  needs_block_refresh: boolean;
  resendable: boolean;
  recipients: {
    list_id: string;
    list_name: string;
    segment_text: string;
    recipient_count: number;
    segment_opts: {
      saved_segment_id: number;
      prebuilt_segment_id: string;
      match: string;
      conditions: Condition[];
    }
  };
  settings: {
    subject_line: string;
    preview_text: string;
    title: string;
    from_name: string;
    reply_to: string;
    use_conversation: boolean;
    to_name: string;
    folder_id: string;
    authenticate: boolean;
    auto_footer: boolean;
    inline_css: boolean;
    auto_tweet: boolean;
    auto_fb_post: string[];
    fb_comments: boolean;
    timewarp: boolean;
    template_id: number;
    drag_and_drop: boolean;
  };
  variate_settings: VariateSettings;
  tracking: Tracking;
  rss_opts: {
    feed_url: string[];
    frequency: string[];
    schedule: {
      hour: number;
      daily_send: {
        sunday: boolean;
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean
      };
      weekly_send_day: string[];
      monthly_send_date: number
    };
    last_sent: string[];
    constrain_rss_img: boolean
  };
  ab_split_opts: {
    split_test: string[];
    pick_winner: string[];
    wait_units: string[];
    wait_time: number;
    split_size: number;
    from_name_a: string;
    from_name_b: string;
    reply_email_a: string;
    reply_email_b: string;
    subject_a: string;
    subject_b: string;
    send_time_a: string[];
    send_time_b: string[];
    send_time_winner: string[];
  };
  social_card: {
    image_url: string[];
    description: string[];
    title: string[];
  };
  report_summary: {
    opens: number;
    unique_opens: number;
    open_rate: number;
    clicks: number;
    subscriber_clicks: number;
    click_rate: number;
    ecommerce: {
      total_orders: number;
      total_spent: number;
      total_revenue: number
    }
  };
  delivery_status: {
    enabled: boolean;
    can_cancel: boolean;
    status: string[];
    emails_sent: number;
    emails_canceled: number
  };
  _links: Link[];
}

export interface MailchimpCampaignVersion2 {
  id: string;
  web_id: number;
  list_id: string;
  template_id: number;
  title: string;
  subject: string;
  saved_segment: {
    id: number;
    type: string;
    name: string;
  };
  status: string;
  from_name: string;
  archive_url_long: string;
  create_time: number;
}

export interface SaveSegmentResponse {
  segment: { id: number };
}

export interface MailchimpCampaignSendRequest {
  dontSend?: boolean;
  campaignId: string;
  campaignName: string;
  segmentId?: number;
  contentSections?: MailchimpExpenseOtherContent | MailchimpGenericOtherContent;
  otherOptions?: OtherOptions;
}

export interface MailchimpExpenseOtherContent {
  sections: {
    expense_id_url: string;
    expense_notification_text: string;
  };
}

export interface MailchimpGenericOtherContent {
  sections: {
    notification_text: string;
  };
}

export interface MailchimpCampaignGetContentResponse {
  results: [
    {
      campaign: MailchimpCampaign,
      snippet: string;
    }
  ],
  total_items: number;
  _links: [
    {
      rel: string;
      href: string;
      method: string;
      targetSchema: string;
      schema: string;
    }
  ]
}

export interface Tracking {
  opens: boolean;
  html_clicks: boolean;
  text_clicks: boolean;
  goal_tracking: boolean;
  ecomm360: boolean;
  google_analytics: string;
  clicktale: string;
  salesforce: {
    campaign: boolean;
    notes: boolean
  };
  capsule: {
    notes: boolean
  };
}

export interface MailchimpCampaignSendResponse {
  complete: boolean;
}

export interface MailchimpCampaignReplicateIdentifiersResponse extends MailchimpCampaignSendResponse {
  web_id?: number;
}

export interface MailchimpListAudit {
  id?: string;
  memberId: string;
  timestamp: number;
  listType: string;
  status: AuditStatus;
  audit: any;
}

export interface MailchimpListAuditApiResponse extends ApiResponse {
  request: any;
  response?: MailchimpListAudit | MailchimpListAudit[];
}

export interface Link {
  rel: string;
  href: string;
  method: string;
  targetSchema: string;
  schema: string;
}

export interface MailchimpEmailWithError {
  email_address: string;
  error: string;
  error_code: string;
}

export interface MailchimpListMember {
  email_address: string;
  unique_email_id: string;
  web_id: number;
  status: SubscriptionStatus;
  merge_fields: MergeFields;
  last_changed: string;
}

export interface MailchimpMember extends MailchimpMemberIdentifiers {
  id: string;
  email_address: string;
  unique_email_id: string;
  email_type: string;
  status: SubscriptionStatus;
  merge_fields: MergeFields;
  interests?: Interests;
  stats: Stats;
  ip_signup: string;
  timestamp_signup: string;
  ip_opt: string;
  timestamp_opt: string;
  member_rating: number;
  last_changed: string;
  language: string;
  vip: boolean;
  email_client: string;
  location: Location;
  last_note: LastNote;
  tags_count: number;
  tags: Tag[];
  list_id: string;
  _links: Link[];
}

export interface Interests {
  property1?: boolean;
  property2?: boolean;
}

export interface LastNote {
  note_id: number;
  created_at: string;
  created_by: string;
  note: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  gmtoff: number;
  dstoff: number;
  country_code: string;
  timezone: string;
}

export interface Stats {
  avg_open_rate: number;
  avg_click_rate: number;
}

export interface Tag {
  id: number;
  name: string;
}

export type MailchimpApiError = MailchimpHttpErrorResponse | MailchimpErrorResponse | Error;

export interface MailchimpErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export interface MailchimpHttpErrorResponse {
  status: number;
  response: {
    req: {
      method: string;
      url: string;
      headers: {
        "user-agent": string;
        "content-type": string;
        accept: string;
      }
    },
    header: {
      server: string;
      "content-type": string;
      "content-length": string;
      "x-request-id": string;
      link: string;
      "content-encoding": string;
      vary: string;
      date: string;
      connection: string;
      "server-timing": string;
    },
    status: number;
    text: string;
  };
}

export interface MailchimpBatchSegmentAddOrRemoveRequest {
  members_to_add: (string | SubscriberIdentifiers)[];
  members_to_remove: (string | SubscriberIdentifiers)[];
}

interface MailchimpCampaignContentResponse {
  plain_text: string;
  html: string;
  archive_html: string;
  _links: Link[];
}

const response = {
  request: {
    messageType: "mailchimp:campaigns:get-content"
  },
  response: {
    plain_text: "------------------------------------------------------------\n*|ARCHIVE|*\n\n\n** EKWG website password reset instructions\n------------------------------------------------------------\nHi *|FNAME|*,\n\nWe're sending you this email because you've either mentioned to one of our website administrators (me, Kerry, Celine or Nick) that you are having trouble logging in to the site, or you've forgotten your login details and you can't find the original welcome email we sent you or it never arrived in your inbox for some reason! Whatever happened, we hope that after reading this you'll get any remaining issues resolved and you'll be able to login and fully use the site.\n\nYour personal login details for the EKWG site are as follows:\n* User Name: *|USERNAME|*\n* Password: changeme\n\nJust to make sure things are secure, the password has been set to expire and must be reset by you on your next login.\n\nTo login, click the link at the top right hand side of the nagivation bar from the main site (http://www.ekwg.co.uk/) . It looks like this:\n\nYou'll see a login popup displayed. Once you enter the details above, and click the Login button you will be prompted to change your password as follows:\n\nOnce you enter a new password and click Login once more, you will be logged into the site and you will see the link at the top change like this:\n\nAt this point you'll be able to see the unlocked information like the extra Social Events detail and your profile.\n\nIf you have any trouble performing this password reset or any problems with the site, please don't hesitate to contact us by clicking on the most suitable email link below:\n* Social Co-ordinator - Kerry O'Grady - socialekwg@gmail.com (mailto:socialekwg@gmail.com)\n* Walks Co-ordinator - Celine Praquin - walksekwg@gmail.com (mailto:walksekwg@gmail.com)\n* Membership Secretary - Desiree Nel - membershipekwg@gmail.com (mailto:membershipekwg@gmail.com)\n* Anything technical - Nick Barrett - nick.barrett@adaptassure.com (mailto:nick.barrett@adaptassure.com)\n* Chairman - Claire Mansfield - chairmanekwg@gmail.com (mailto:chairmanekwg@gmail.com)\n\nBest regards,\nDes\n\n============================================================\n** unsubscribe from this list (*|UNSUB|*)\n| ** update subscription preferences (*|UPDATE_PROFILE|*)\n\nThis email was sent to *|EMAIL|*\nwhy did I get this? (*|ABOUT_LIST|*)     unsubscribe from this list (*|UNSUB|*)     update subscription preferences (*|UPDATE_PROFILE|*)\n*|LIST_ADDRESSLINE_TEXT|*\n\n*|REWARDS_TEXT|*",
    html: "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n<html>\n  <head>\n    <meta http-equiv=\"content-type\" content=\"text/html; charset=UTF-8\">\n    <!-- Facebook sharing information tags -->\n    <meta property=\"og:title\" content=\"*|MC:SUBJECT|*\">\n    <title>*|MC:SUBJECT|*</title>\n    \n  <style type=\"text/css\">\n\t\t#outlook a{\n\t\t\tpadding:0;\n\t\t}\n\t\tbody{\n\t\t\twidth:100% !important;\n\t\t}\n\t\t.ReadMsgBody{\n\t\t\twidth:100%;\n\t\t}\n\t\t.ExternalClass{\n\t\t\twidth:100%;\n\t\t}\n\t\tbody{\n\t\t\t-webkit-text-size-adjust:none;\n\t\t}\n\t\tbody{\n\t\t\tmargin:0;\n\t\t\tpadding:0;\n\t\t}\n\t\timg{\n\t\t\tborder:0;\n\t\t\theight:auto;\n\t\t\tline-height:100%;\n\t\t\toutline:none;\n\t\t\ttext-decoration:none;\n\t\t}\n\t\ttable td{\n\t\t\tborder-collapse:collapse;\n\t\t}\n\t\t#backgroundTable{\n\t\t\theight:100% !important;\n\t\t\tmargin:0;\n\t\t\tpadding:0;\n\t\t\twidth:100% !important;\n\t\t}\n\t\tbody,#backgroundTable{\n\t\t\tbackground-color:#fafafa;\n\t\t}\n\t\t#templateContainer{\n\t\t\tborder:1px solid #DDDDDD;\n\t\t}\n\t\th1,.h1{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:34px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\th2,.h2{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:30px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\th3,.h3{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:26px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\th4,.h4{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:22px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\t#templatePreheader{\n\t\t\tbackground-color:#FAFAFA;\n\t\t}\n\t\t.preheaderContent div{\n\t\t\tcolor:#505050;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:10px;\n\t\t\tline-height:100%;\n\t\t\ttext-align:left;\n\t\t}\n\t\t.preheaderContent div a:link,.preheaderContent div a:visited,.preheaderContent div a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t#templateHeader{\n\t\t\tbackground-color:#FFFFFF;\n\t\t\tborder-bottom:0;\n\t\t}\n\t\t.headerContent{\n\t\t\tcolor:#202020;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:34px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tpadding:0;\n\t\t\ttext-align:center;\n\t\t\tvertical-align:middle;\n\t\t}\n\t\t.headerContent a:link,.headerContent a:visited,.headerContent a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t#headerImage{\n\t\t\theight:auto;\n\t\t\tmax-width:600px !important;\n\t\t}\n\t\t#templateContainer,.bodyContent{\n\t\t\tbackground-color:#FFFFFF;\n\t\t}\n\t\t.bodyContent div{\n\t\t\tcolor:#505050;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:14px;\n\t\t\tline-height:150%;\n\t\t\ttext-align:left;\n\t\t}\n\t\t.bodyContent div a:link,.bodyContent div a:visited,.bodyContent div a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t.bodyContent img{\n\t\t\tdisplay:inline;\n\t\t\theight:auto;\n\t\t}\n\t\t#templateFooter{\n\t\t\tbackground-color:#ffffff;\n\t\t\tborder-top:0;\n\t\t}\n\t\t.footerContent div{\n\t\t\tcolor:#ffffff;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:12px;\n\t\t\tline-height:125%;\n\t\t\ttext-align:left;\n\t\t}\n\t\t.footerContent div a:link,.footerContent div a:visited,.footerContent div a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t.footerContent img{\n\t\t\tdisplay:inline;\n\t\t}\n\t\t#social{\n\t\t\tbackground-color:#FAFAFA;\n\t\t\tborder:0;\n\t\t}\n\t\t#social div{\n\t\t\ttext-align:center;\n\t\t}\n\t\t#utility{\n\t\t\tbackground-color:#FFFFFF;\n\t\t\tborder:0;\n\t\t}\n\t\t#utility div{\n\t\t\ttext-align:center;\n\t\t}\n\t\t#monkeyRewards img{\n\t\t\tmax-width:190px;\n\t\t}\n</style></head>\n  <body leftmargin=\"0\" marginwidth=\"0\" topmargin=\"0\" marginheight=\"0\" offset=\"0\" style=\"-webkit-text-size-adjust: none;margin: 0;padding: 0;background-color: #fafafa;width: 100% !important;\">\n    <center>\n      <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" id=\"backgroundTable\" style=\"height: 100%;margin: 0;padding: 0;background-color: #fafafa;width: 100% !important;\">\n        <tr>\n          <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n            <!-- // Begin Template Preheader \\\\ -->\n            <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"600\" id=\"templatePreheader\" style=\"background-color: #FAFAFA;\">\n              <tr>\n                <td valign=\"top\" class=\"preheaderContent\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Module: Standard Preheader \\ -->\n                  <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"100%\">\n                    <tr>\n                      <td valign=\"top\" style=\"border-collapse: collapse;\">\n                        <div style=\"color: #505050;font-family: Arial;font-size: 10px;line-height: 100%;text-align: left;\">\n                        </div>\n                      </td>\n                      <!-- *|IFNOT:ARCHIVE_PAGE|* -->\n                      <td valign=\"top\" width=\"190\" style=\"border-collapse: collapse;\">\n                        <div style=\"color: #505050;font-family: Arial;font-size: 10px;line-height: 100%;text-align: left;\">Is this email not displaying correctly? <a href=\"*|ARCHIVE|*\" target=\"_blank\" style=\"color: #336699;font-weight: normal;text-decoration: underline;\">View it in your browser</a>.</div>\n                      </td>\n                      <!-- *|END:IF|* -->\n                    </tr>\n                  </table>\n                  <!-- // End Module: Standard Preheader \\ -->\n                </td>\n              </tr>\n            </table>\n            <!-- // End Template Preheader \\\\ -->\n            <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"600\" id=\"templateContainer\" style=\"border: 1px solid #DDDDDD;background-color: #FFFFFF;\">\n              <tr>\n                <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Template Header \\\\ -->\n                  <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"600\" id=\"templateHeader\" style=\"background-color: #FFFFFF;border-bottom: 0;\">\n                    <tr>\n                      <td class=\"headerContent\" style=\"border-collapse: collapse;color: #202020;font-family: Arial;font-size: 34px;font-weight: bold;line-height: 100%;padding: 0;text-align: center;vertical-align: middle;\">\n                        <!-- // Begin Module: Standard Header Image \\\\ -->\n                        <img src=\"https://gallery.mailchimp.com/91c655d91dd761fd7e34310ea/images/7641ebf9-8929-4273-9390-b3b75c3f707d.jpg\" alt=\"\" border=\"0\" style=\"margin: 0;padding: 0;border: 0;height: auto;line-height: 100%;outline: none;text-decoration: none;\">\n                        <!-- // End Module: Standard Header Image \\\\ -->\n                      </td>\n                    </tr>\n                  </table>\n                  <!-- // End Template Header \\\\ -->\n                </td>\n              </tr>\n              <tr>\n                <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Template Body \\\\ -->\n                  <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"600\" id=\"templateBody\">\n                    <tr>\n                      <td valign=\"top\" class=\"bodyContent\" style=\"border-collapse: collapse;background-color: #FFFFFF;\">\n                        <!-- // Begin Module: Standard Content \\\\ -->\n                        <table border=\"0\" cellpadding=\"20\" cellspacing=\"0\" width=\"100%\">\n                          <tr>\n                            <td valign=\"top\" style=\"border-collapse: collapse;\">\n                              <div style=\"color: #505050;font-family: Arial;font-size: 14px;line-height: 150%;text-align: left;\">(this text replaced during notification sending)</div>\n                            </td>\n                          </tr>\n                        </table>\n                        <!-- // End Module: Standard Content \\\\ -->\n                      </td>\n                    </tr>\n                  </table>\n                  <!-- // End Template Body \\\\ -->\n                </td>\n              </tr>\n              <tr>\n                <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Template Footer \\\\ -->\n                  <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"600\" id=\"templateFooter\" style=\"background-color: #ffffff;border-top: 0;\">\n                    <tr>\n                      <td valign=\"top\" class=\"footerContent\" style=\"border-collapse: collapse;\">\n                        <!-- // Begin Module: Standard Footer \\\\ -->\n                        <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"100%\">\n                          <tr>\n                            <td colspan=\"2\" valign=\"middle\" id=\"social\" style=\"border-collapse: collapse;background-color: #FAFAFA;border: 0;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: center;\">\n                              </div>\n                            </td>\n                          </tr>\n                          <tr>\n                            <td valign=\"top\" width=\"350\" style=\"border-collapse: collapse;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: left;\">\n                              </div>\n                            </td>\n                            <td valign=\"top\" width=\"190\" id=\"monkeyRewards\" style=\"border-collapse: collapse;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: left;\">\n                              </div>\n                            </td>\n                          </tr>\n                          <tr>\n                            <td colspan=\"2\" valign=\"middle\" id=\"utility\" style=\"border-collapse: collapse;background-color: #FFFFFF;border: 0;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: center;\"> <a href=\"*|UNSUB|*\" style=\"color: #336699;font-weight: normal;text-decoration: underline;\">unsubscribe from this list</a> |\n                                <a href=\"*|UPDATE_PROFILE|*\" style=\"color: #336699;font-weight: normal;text-decoration: underline;\">update subscription preferences</a> </div>\n                              </td>\n                            </tr>\n                          </table>\n                          <!-- // End Module: Standard Footer \\\\ -->\n                        </td>\n                      </tr>\n                    </table>\n                    <!-- // End Template Footer \\\\ -->\n                  </td>\n                </tr>\n              </table>\n              <br>\n            </td>\n          </tr>\n        </table>\n      </center>\n                <center>\n                <br />\n                <br />\n                <br />\n                <br />\n                <br />\n                <br />\n                <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" id=\"canspamBarWrapper\" style=\"background-color:#FFFFFF; border-top:1px solid #E5E5E5;\">\n                    <tr>\n                        <td align=\"center\" valign=\"top\" style=\"padding-top:20px; padding-bottom:20px;\">\n                            <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" id=\"canspamBar\">\n                                <tr>\n                                    <td align=\"center\" valign=\"top\" style=\"color:#606060; font-family:Helvetica, Arial, sans-serif; font-size:11px; line-height:150%; padding-right:20px; padding-bottom:5px; padding-left:20px; text-align:center;\">\n                                        This email was sent to <a href=\"mailto:*|EMAIL|*\" target=\"_blank\" style=\"color:#404040 !important;\">*|EMAIL|*</a>\n                                        <br />\n                                        <a href=\"*|ABOUT_LIST|*\" target=\"_blank\" style=\"color:#404040 !important;\"><em>why did I get this?</em></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href=\"*|UNSUB|*\" style=\"color:#404040 !important;\">unsubscribe from this list</a>&nbsp;&nbsp;&nbsp;&nbsp;<a href=\"*|UPDATE_PROFILE|*\" style=\"color:#404040 !important;\">update subscription preferences</a>\n                                        <br />\n                                        *|LIST:ADDRESSLINE|*\n                                        <br />\n                                        <br />\n                                        *|REWARDS|*\n                                    </td>\n                                </tr>\n                            </table>\n                        </td>\n                    </tr>\n                </table>\n                <style type=\"text/css\">\n                    @media only screen and (max-width: 480px){\n                        table#canspamBar td{font-size:14px !important;}\n                        table#canspamBar td a{display:block !important; margin-top:10px !important;}\n                    }\n                </style>\n            </center></body>\n</html>",
    archive_html: "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n<html>\n  <head>\n    <meta http-equiv=\"content-type\" content=\"text/html; charset=UTF-8\">\n    <!-- Facebook sharing information tags -->\n    <meta property=\"og:title\" content=\"Committee Notification  I EDITED\">\n    <title>Committee Notification  I EDITED</title>\n    \n  <style type=\"text/css\">\n\t\t#outlook a{\n\t\t\tpadding:0;\n\t\t}\n\t\tbody{\n\t\t\twidth:100% !important;\n\t\t}\n\t\t.ReadMsgBody{\n\t\t\twidth:100%;\n\t\t}\n\t\t.ExternalClass{\n\t\t\twidth:100%;\n\t\t}\n\t\tbody{\n\t\t\t-webkit-text-size-adjust:none;\n\t\t}\n\t\tbody{\n\t\t\tmargin:0;\n\t\t\tpadding:0;\n\t\t}\n\t\timg{\n\t\t\tborder:0;\n\t\t\theight:auto;\n\t\t\tline-height:100%;\n\t\t\toutline:none;\n\t\t\ttext-decoration:none;\n\t\t}\n\t\ttable td{\n\t\t\tborder-collapse:collapse;\n\t\t}\n\t\t#backgroundTable{\n\t\t\theight:100% !important;\n\t\t\tmargin:0;\n\t\t\tpadding:0;\n\t\t\twidth:100% !important;\n\t\t}\n\t\tbody,#backgroundTable{\n\t\t\tbackground-color:#fafafa;\n\t\t}\n\t\t#templateContainer{\n\t\t\tborder:1px solid #DDDDDD;\n\t\t}\n\t\th1,.h1{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:34px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\th2,.h2{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:30px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\th3,.h3{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:26px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\th4,.h4{\n\t\t\tcolor:#202020;\n\t\t\tdisplay:block;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:22px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tmargin-top:0;\n\t\t\tmargin-right:0;\n\t\t\tmargin-bottom:10px;\n\t\t\tmargin-left:0;\n\t\t\ttext-align:left;\n\t\t}\n\t\t#templatePreheader{\n\t\t\tbackground-color:#FAFAFA;\n\t\t}\n\t\t.preheaderContent div{\n\t\t\tcolor:#505050;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:10px;\n\t\t\tline-height:100%;\n\t\t\ttext-align:left;\n\t\t}\n\t\t.preheaderContent div a:link,.preheaderContent div a:visited,.preheaderContent div a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t#templateHeader{\n\t\t\tbackground-color:#FFFFFF;\n\t\t\tborder-bottom:0;\n\t\t}\n\t\t.headerContent{\n\t\t\tcolor:#202020;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:34px;\n\t\t\tfont-weight:bold;\n\t\t\tline-height:100%;\n\t\t\tpadding:0;\n\t\t\ttext-align:center;\n\t\t\tvertical-align:middle;\n\t\t}\n\t\t.headerContent a:link,.headerContent a:visited,.headerContent a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t#headerImage{\n\t\t\theight:auto;\n\t\t\tmax-width:600px !important;\n\t\t}\n\t\t#templateContainer,.bodyContent{\n\t\t\tbackground-color:#FFFFFF;\n\t\t}\n\t\t.bodyContent div{\n\t\t\tcolor:#505050;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:14px;\n\t\t\tline-height:150%;\n\t\t\ttext-align:left;\n\t\t}\n\t\t.bodyContent div a:link,.bodyContent div a:visited,.bodyContent div a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t.bodyContent img{\n\t\t\tdisplay:inline;\n\t\t\theight:auto;\n\t\t}\n\t\t#templateFooter{\n\t\t\tbackground-color:#ffffff;\n\t\t\tborder-top:0;\n\t\t}\n\t\t.footerContent div{\n\t\t\tcolor:#ffffff;\n\t\t\tfont-family:Arial;\n\t\t\tfont-size:12px;\n\t\t\tline-height:125%;\n\t\t\ttext-align:left;\n\t\t}\n\t\t.footerContent div a:link,.footerContent div a:visited,.footerContent div a .yshortcuts{\n\t\t\tcolor:#336699;\n\t\t\tfont-weight:normal;\n\t\t\ttext-decoration:underline;\n\t\t}\n\t\t.footerContent img{\n\t\t\tdisplay:inline;\n\t\t}\n\t\t#social{\n\t\t\tbackground-color:#FAFAFA;\n\t\t\tborder:0;\n\t\t}\n\t\t#social div{\n\t\t\ttext-align:center;\n\t\t}\n\t\t#utility{\n\t\t\tbackground-color:#FFFFFF;\n\t\t\tborder:0;\n\t\t}\n\t\t#utility div{\n\t\t\ttext-align:center;\n\t\t}\n\t\t#monkeyRewards img{\n\t\t\tmax-width:190px;\n\t\t}\n</style></head>\n  <body leftmargin=\"0\" marginwidth=\"0\" topmargin=\"0\" marginheight=\"0\" offset=\"0\" style=\"-webkit-text-size-adjust: none;margin: 0;padding: 0;background-color: #fafafa;width: 100% !important;\">\n    <center>\n      <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" id=\"backgroundTable\" style=\"height: 100%;margin: 0;padding: 0;background-color: #fafafa;width: 100% !important;\">\n        <tr>\n          <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n            <!-- // Begin Template Preheader \\\\ -->\n            <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"600\" id=\"templatePreheader\" style=\"background-color: #FAFAFA;\">\n              <tr>\n                <td valign=\"top\" class=\"preheaderContent\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Module: Standard Preheader \\ -->\n                  <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"100%\">\n                    <tr>\n                      <td valign=\"top\" style=\"border-collapse: collapse;\">\n                        <div style=\"color: #505050;font-family: Arial;font-size: 10px;line-height: 100%;text-align: left;\">\n                        </div>\n                      </td>\n                      <!--  -->\n                    </tr>\n                  </table>\n                  <!-- // End Module: Standard Preheader \\ -->\n                </td>\n              </tr>\n            </table>\n            <!-- // End Template Preheader \\\\ -->\n            <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"600\" id=\"templateContainer\" style=\"border: 1px solid #DDDDDD;background-color: #FFFFFF;\">\n              <tr>\n                <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Template Header \\\\ -->\n                  <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"600\" id=\"templateHeader\" style=\"background-color: #FFFFFF;border-bottom: 0;\">\n                    <tr>\n                      <td class=\"headerContent\" style=\"border-collapse: collapse;color: #202020;font-family: Arial;font-size: 34px;font-weight: bold;line-height: 100%;padding: 0;text-align: center;vertical-align: middle;\">\n                        <!-- // Begin Module: Standard Header Image \\\\ -->\n                        <img src=\"https://gallery.mailchimp.com/91c655d91dd761fd7e34310ea/images/7641ebf9-8929-4273-9390-b3b75c3f707d.jpg\" alt=\"\" border=\"0\" style=\"margin: 0;padding: 0;border: 0;height: auto;line-height: 100%;outline: none;text-decoration: none;\">\n                        <!-- // End Module: Standard Header Image \\\\ -->\n                      </td>\n                    </tr>\n                  </table>\n                  <!-- // End Template Header \\\\ -->\n                </td>\n              </tr>\n              <tr>\n                <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Template Body \\\\ -->\n                  <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"600\" id=\"templateBody\">\n                    <tr>\n                      <td valign=\"top\" class=\"bodyContent\" style=\"border-collapse: collapse;background-color: #FFFFFF;\">\n                        <!-- // Begin Module: Standard Content \\\\ -->\n                        <table border=\"0\" cellpadding=\"20\" cellspacing=\"0\" width=\"100%\">\n                          <tr>\n                            <td valign=\"top\" style=\"border-collapse: collapse;\">\n                              <div style=\"color: #505050;font-family: Arial;font-size: 14px;line-height: 150%;text-align: left;\">(this text replaced during notification sending)</div>\n                            </td>\n                          </tr>\n                        </table>\n                        <!-- // End Module: Standard Content \\\\ -->\n                      </td>\n                    </tr>\n                  </table>\n                  <!-- // End Template Body \\\\ -->\n                </td>\n              </tr>\n              <tr>\n                <td align=\"center\" valign=\"top\" style=\"border-collapse: collapse;\">\n                  <!-- // Begin Template Footer \\\\ -->\n                  <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"600\" id=\"templateFooter\" style=\"background-color: #ffffff;border-top: 0;\">\n                    <tr>\n                      <td valign=\"top\" class=\"footerContent\" style=\"border-collapse: collapse;\">\n                        <!-- // Begin Module: Standard Footer \\\\ -->\n                        <table border=\"0\" cellpadding=\"10\" cellspacing=\"0\" width=\"100%\">\n                          <tr>\n                            <td colspan=\"2\" valign=\"middle\" id=\"social\" style=\"border-collapse: collapse;background-color: #FAFAFA;border: 0;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: center;\">\n                              </div>\n                            </td>\n                          </tr>\n                          <tr>\n                            <td valign=\"top\" width=\"350\" style=\"border-collapse: collapse;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: left;\">\n                              </div>\n                            </td>\n                            <td valign=\"top\" width=\"190\" id=\"monkeyRewards\" style=\"border-collapse: collapse;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: left;\">\n                              </div>\n                            </td>\n                          </tr>\n                          <tr>\n                            <td colspan=\"2\" valign=\"middle\" id=\"utility\" style=\"border-collapse: collapse;background-color: #FFFFFF;border: 0;\">\n                              <div style=\"color: #ffffff;font-family: Arial;font-size: 12px;line-height: 125%;text-align: center;\"> <a href=\"https://adaptassure.us3.list-manage.com/unsubscribe?u=91c655d91dd761fd7e34310ea&id=aa7629edbc&e=[UNIQID]&c=5e6152499d\" style=\"color: #336699;font-weight: normal;text-decoration: underline;\">unsubscribe from this list</a> |\n                                <a href=\"https://adaptassure.us3.list-manage.com/profile?u=91c655d91dd761fd7e34310ea&id=aa7629edbc&e=[UNIQID]&c=5e6152499d\" style=\"color: #336699;font-weight: normal;text-decoration: underline;\">update subscription preferences</a> </div>\n                              </td>\n                            </tr>\n                          </table>\n                          <!-- // End Module: Standard Footer \\\\ -->\n                        </td>\n                      </tr>\n                    </table>\n                    <!-- // End Template Footer \\\\ -->\n                  </td>\n                </tr>\n              </table>\n              <br>\n            </td>\n          </tr>\n        </table>\n      </center>\n    </body>\n</html>",
    _links: [
      {
        rel: "parent",
        href: "https://us3.api.mailchimp.com/3.0/campaigns/5397292",
        method: "GET",
        targetSchema: "https://us3.api.mailchimp.com/schema/3.0/Definitions/Campaigns/Response.json"
      },
      {
        rel: "self",
        href: "https://us3.api.mailchimp.com/3.0/campaigns/5397292/content",
        method: "GET",
        targetSchema: "https://us3.api.mailchimp.com/schema/3.0/Definitions/Campaigns/Content/Response.json"
      },
      {
        rel: "create",
        href: "https://us3.api.mailchimp.com/3.0/campaigns/5397292/content",
        method: "PUT",
        targetSchema: "https://us3.api.mailchimp.com/schema/3.0/Definitions/Campaigns/Content/PUT.json"
      }
    ]
  }
};
