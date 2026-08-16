import { ApiResponse } from "./api-response.model";
import { ReleaseNoteUpdateCategory, ReleaseNoteUpdateCoverage } from "./email-composer.model";

export interface TextGenerationRequest {
  systemPrompt: string;
  input: string;
  maxTokens?: number;
}

export interface MultimodalGenerationRequest {
  systemPrompt: string;
  userText: string;
  imageUrls: string[];
  maxTokens?: number;
}

export interface TextGenerationProvider {
  generate(request: TextGenerationRequest): Promise<string>;
  generateWithImages?(request: MultimodalGenerationRequest): Promise<string>;
}

export interface CoverImageCandidate {
  image: string;
  url?: string;
  s3Key?: string;
}

export interface ChooseCoverImageRequest {
  candidates: CoverImageCandidate[];
  rootFolder?: string;
  albumName?: string;
}

export interface ChooseCoverImageResponse {
  image: string | null;
}

export interface ChooseCoverImageApiResponse extends ApiResponse {
  response?: ChooseCoverImageResponse;
}

export interface TextRewriteRequest {
  input: string;
  systemPrompt?: string;
}

export interface TextRewriteResponse {
  output: string;
}

export interface TextRewriteApiResponse extends ApiResponse {
  response?: TextRewriteResponse;
}

export enum NewsletterIntroPurpose {
  UPCOMING_EVENTS = "upcoming-events",
  WALK_LEADER_REQUEST = "walk-leader-request"
}

export interface NewsletterIntroPurposeOption {
  key: NewsletterIntroPurpose;
  label: string;
  hint: string;
}

export const NEWSLETTER_INTRO_PURPOSE_OPTIONS: NewsletterIntroPurposeOption[] = [
  {
    key: NewsletterIntroPurpose.UPCOMING_EVENTS,
    label: "Up and coming events",
    hint: "Covers what is on. Only events with their details filled in are included"
  },
  {
    key: NewsletterIntroPurpose.WALK_LEADER_REQUEST,
    label: "Request for walk leaders",
    hint: "Lists the empty slots in the period that still need someone to lead them"
  }
];

export const DEFAULT_NEWSLETTER_INTRO_PURPOSE = NewsletterIntroPurpose.UPCOMING_EVENTS;

export interface NewsletterIntroEvent {
  title: string;
  eventType: string;
  dateDescription: string;
  distance?: string;
  location?: string;
  description?: string;
  newSinceLastNewsletter?: boolean;
  awaitingDetails?: boolean;
}

export interface NewsletterIntroRequest {
  events: NewsletterIntroEvent[];
  periodDescription?: string;
  groupName?: string;
  guidance?: string;
  purpose?: NewsletterIntroPurpose;
}

export interface NewsletterIntroResponse {
  output: string;
}

export interface NewsletterIntroApiResponse extends ApiResponse {
  response?: NewsletterIntroResponse;
}

export interface NewsletterPlanRequest {
  request: string;
}

export interface NewsletterPlan {
  fromMillis: number;
  toMillis: number;
  periodDescription: string;
  guidance: string | null;
  understood: boolean;
}

export interface NewsletterPlanApiResponse extends ApiResponse {
  response?: NewsletterPlan;
}

export interface ReleaseNoteUpdateCandidate {
  title: string;
  path: string;
  url: string;
  dateMillis: number | null;
  excerpt: string;
  hasImages?: boolean;
  images?: ReleaseNoteUpdateImage[];
}

export interface ReleaseNoteUpdateImage {
  url: string;
  alt: string;
}

export interface ReleaseNoteUpdateItem {
  path: string;
  sourcePaths: string[];
  sourceNotes: ReleaseNoteUpdateSourceNote[];
  url: string;
  title: string;
  body: string;
  theme: string | null;
  category: ReleaseNoteUpdateCategory;
  image?: ReleaseNoteUpdateImage | null;
}

export interface ReleaseNoteUpdateSourceNote {
  description: string;
  url: string;
  date: string | null;
}

export interface ReleaseNoteUpdateDraft {
  intro: string;
  items: ReleaseNoteUpdateItem[];
  indexPath: string | null;
  indexUrl: string | null;
}

export interface ReleaseNoteUpdateRequest {
  fromMillis: number;
  toMillis: number;
  previouslyIncludedPaths?: string[];
  guidance?: string;
  groupName?: string;
  categories: ReleaseNoteUpdateCategory[];
  coverage: ReleaseNoteUpdateCoverage;
  maximumThemes: number;
  maximumSourcesPerTheme: number;
  writingRules: string;
  includeTechnicalChanges: boolean;
  includeImages: boolean;
}

export enum ReleaseNoteUpdateDraftOutcome {
  GENERATED = "generated",
  AI_DISABLED = "ai-disabled",
  INVALID_RESPONSE = "invalid-response"
}

export interface ReleaseNoteUpdateResponse {
  candidates: ReleaseNoteUpdateCandidate[];
  draft: ReleaseNoteUpdateDraft;
  emptyWindow: boolean;
  drafted: boolean;
  draftOutcome: ReleaseNoteUpdateDraftOutcome;
}

export interface ReleaseNoteUpdateApiResponse extends ApiResponse {
  response?: ReleaseNoteUpdateResponse;
}

export interface AiConnectionStatus {
  connected: boolean;
  model?: string;
  error?: string;
}

export interface AiConnectionStatusApiResponse extends ApiResponse {
  response?: AiConnectionStatus;
}
