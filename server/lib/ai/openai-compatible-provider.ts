import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  MultimodalGenerationRequest,
  TextGenerationProvider,
  TextGenerationRequest
} from "../../../projects/ngx-ramblers/src/app/models/ai.model";

async function chatCompletion(config: Ai, body: object): Promise<string> {
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? {Authorization: `Bearer ${config.apiKey}`} : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI provider responded ${response.status}: ${text.slice(0, 300)}`);
  }
  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned no content");
  }
  return content.trim();
}

export function openAiCompatibleProvider(config: Ai): TextGenerationProvider {
  return {
    async generate({systemPrompt, input, maxTokens}: TextGenerationRequest): Promise<string> {
      return chatCompletion(config, {
        model: config.model,
        max_tokens: maxTokens || 1024,
        messages: [
          {role: "system", content: systemPrompt},
          {role: "user", content: input}
        ]
      });
    },
    async generateWithImages({systemPrompt, userText, imageUrls, maxTokens}: MultimodalGenerationRequest): Promise<string> {
      const imageParts = (imageUrls || []).map(url => ({
        type: "image_url",
        image_url: {url, detail: "low"}
      }));
      return chatCompletion(config, {
        model: config.model,
        max_tokens: maxTokens || 64,
        messages: [
          {role: "system", content: systemPrompt},
          {
            role: "user",
            content: [
              {type: "text", text: userText},
              ...imageParts
            ]
          }
        ]
      });
    }
  };
}
