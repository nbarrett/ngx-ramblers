import { ApiResponse } from "./api-response.model";

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

export interface AiConnectionStatus {
  connected: boolean;
  model?: string;
  error?: string;
}

export interface AiConnectionStatusApiResponse extends ApiResponse {
  response?: AiConnectionStatus;
}
