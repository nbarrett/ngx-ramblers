import {
  BatchListMembersBody,
  BatchListMembersOpts,
  BatchListMembersResponse,
  MailchimpBatchSegmentAddOrRemoveRequest,
  MailchimpCampaignContentUpdateRequest,
  MailchimpCampaignDefaults,
  MailchimpCampaignGetContentResponse,
  MailchimpCampaignListResponse,
  MailchimpCampaignReplicateResponse,
  MailchimpCampaignSearchResponse,
  MailchimpCampaignSendResponse,
  MailchimpCampaignUpdateRequest,
  MailchimpConfig,
  MailchimpList,
  MailchimpListingResponse,
  MailchimpListSegmentBatchAddOrRemoveMembersResponse,
  MailchimpListsMembersResponse,
  MailchimpSegmentUpdateResponse,
  MailchimpSetContentResponse,
  MergeField,
  MergeFieldAddResponse
} from "./mailchimp.model";

export interface MessageHandlerOptions {
  req: any;
  body?: any;
  mapper?: (parsedDataJSON: any) => any;
  apiRequest: any;
  successStatusCodes?: number[];
  res: any;
  debug: (...args: any) => void;
}

export interface MailchimpMarketingApiClient {
  campaigns: {
    setContent(campaignId: string, mailchimpCampaignContentUpdateRequest: MailchimpCampaignContentUpdateRequest): Promise<MailchimpSetContentResponse>;
    list(mailchimpCampaignListRequest: MailchimpCampaignListRequest): Promise<MailchimpCampaignListResponse>;
    replicate(campaignId: string): Promise<MailchimpCampaignReplicateResponse>;
    send(campaignId: string): Promise<MailchimpCampaignSendResponse>;
    update(campaignId: string, mailchimpCampaignListRequest: MailchimpCampaignUpdateRequest): Promise<MailchimpCampaignUpdateRequest>;
    getContent(campaignId: string, options: MailchimpCampaignSearchRequestOptions): Promise<MailchimpCampaignGetContentResponse>;
  };
  searchCampaigns: {
    search(query: string, options: MailchimpCampaignSearchRequestOptions): Promise<MailchimpCampaignSearchResponse>;
  };
  lists: {
    addListMergeField(listId: string, mergeField: MergeField): Promise<MergeFieldAddResponse>;
    batchListMembers(listId: string, body: BatchListMembersBody, options: BatchListMembersOpts): Promise<BatchListMembersResponse>;
    batchSegmentMembers(bodyParameters: MailchimpBatchSegmentAddOrRemoveRequest, listId: string, segmentId: number): Promise<MailchimpListSegmentBatchAddOrRemoveMembersResponse>;
    createList(mailchimpListMembersRequest: MailchimpListCreateRequest): Promise<MailchimpList>;
    createSegment(listId: string, requestData: MailchimpCreateSegmentRequest): Promise<MailchimpListingResponse>;
    deleteList(listId: string): Promise<void>;
    deleteSegment(listId: string, segmentId: string): Promise<MailchimpListingResponse>;
    getAllLists(listOptions: MailchimpListsRequest): Promise<MailchimpListingResponse>;
    getListMembersInfo(listId: string, mailchimpListMembersRequest: MailchimpListMembersRequest): Promise<MailchimpListsMembersResponse>;
    updateSegment(listId, segmentId, clientRequest): Promise<MailchimpSegmentUpdateResponse>;
  };
}

export interface MailchimpConfigData {
  config: MailchimpConfig;
  client: MailchimpMarketingApiClient;
}

export interface MailchimpListsRequest {
  fields: string[];
  offset: number;
  count: number;
}

export interface MailchimpUpdateSegmentBodyParameters {
  name: string;
  static_segment?: string[];
}

export interface MailchimpCampaignListRequest {
  fields?: string[];
  query?: string;
  exclude_fields?: string[];
  count?: number;
  offset?: number;
  type?: string;
  status?: string;
  before_send_time?: string;
  since_send_time?: string;
  before_create_time?: string;
  since_create_time?: string;
  list_id?: string;
  folder_id?: string;
  member_id?: string;
  sort_field?: string;
  sort_dir?: string;
}

export interface MailchimpCampaignSearchRequestOptions {
  fields: string[];
  exclude_fields?: string[];
}

export interface MailchimpListMembersRequest {
  fields: string[];
  status: string;
  offset: number;
  count: number;
}

export interface MailchimpContact {
  company: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  zip?: string;
  country: string;
  phone?: string;
}

export interface MailchimpListCreateRequest {
  name?: string;
  contact: MailchimpContact;
  permission_reminder: string;
  campaign_defaults: MailchimpCampaignDefaults;
  email_type_option: boolean;
  use_archive_bar: boolean;
  notify_on_subscribe: string;
  notify_on_unsubscribe: string;
  double_optin: boolean;
  marketing_permissions: boolean;
}

export interface MailchimpCreateSegmentRequest {
  name: any;
  static_segment: string[];
  options?: object;
}
