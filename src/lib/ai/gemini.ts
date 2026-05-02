export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

interface GenerateGeminiJsonOptions {
  apiKey?: string;
  model?: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function generateGeminiJson<T>(options: GenerateGeminiJsonOptions): Promise<T> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada");
  }

  const model = options.model?.trim() || DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options.systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: options.prompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.35,
        maxOutputTokens: options.maxOutputTokens ?? 4096,
        responseMimeType: "application/json",
        responseSchema: options.responseSchema,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini respondió ${response.status}: ${detail.slice(0, 400)}`);
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);
  if (!text) {
    throw new Error("Gemini no devolvió texto");
  }

  return JSON.parse(stripJsonFence(text)) as T;
}

function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part?.text || "").join("\n").trim();
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}