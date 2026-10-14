import { HttpError } from "./errors";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type Message = { role: "system" | "user" | "assistant"; content: string };

type ChatOptions = {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export function groqModel(): string {
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
}

export async function groqChat(messages: Message[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpError(
      503,
      "GROQ_API_KEY is not set on the server. Add it to .env and restart.",
    );
  }

  const baseBody: Record<string, unknown> = {
    model: groqModel(),
    messages,
    temperature: options.temperature ?? 0.2,
    max_completion_tokens: options.maxTokens ?? 1800,
  };
  if (options.json) baseBody.response_format = { type: "json_object" };

  const attempts: Record<string, unknown>[] = [
    { ...baseBody, reasoning_effort: "low", reasoning_format: "hidden" },
    baseBody,
  ];

  let lastStatus = 500;
  let lastText = "";
  for (const body of attempts) {
    let response: Response;
    try {
      response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new HttpError(504, "Groq took too long to respond. Try again.");
      }
      throw new HttpError(502, "Could not reach the Groq API.");
    }

    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
      };
      const message = payload.choices?.[0]?.message;
      const content = (message?.content || message?.reasoning || "").trim();
      if (!content) throw new HttpError(502, "Groq returned an empty response.");
      return content;
    }

    lastStatus = response.status;
    lastText = await response.text();
    if (response.status !== 400) break;
  }

  if (lastStatus === 401) throw new HttpError(502, "Groq rejected the API key.");
  if (lastStatus === 429) {
    throw new HttpError(429, "Groq rate limit reached. Wait a moment and try again.");
  }
  if (lastStatus === 404 || /model/i.test(lastText)) {
    throw new HttpError(
      502,
      `The Groq model "${groqModel()}" is unavailable. Set GROQ_MODEL to a current model such as openai/gpt-oss-20b.`,
    );
  }
  throw new HttpError(502, "Groq could not complete this request.");
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new HttpError(502, "Groq returned an unexpected remediation format. Try again.");
  }
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "Groq returned an unexpected remediation format. Try again.");
  }
}
