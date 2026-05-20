import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { buildLocalDraft, buildPrompt, type GenerateRequest } from "@/lib/local-message";

export const runtime = "nodejs";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

const SYSTEM_INSTRUCTIONS =
  "너는 한국 학교 담임교사의 학부모 소통 문안을 돕는 조심스럽고 전문적인 보조자다. 개인정보를 새로 추정하지 말고, 제공된 데이터 범위 안에서만 작성한다. 석차와 2022 개정 교육과정 5등급제 분석을 반영하되 낙인찍는 표현을 피한다. 출력은 한국어 본문만 제공한다.";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function isGenerateRequest(value: unknown): value is GenerateRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<GenerateRequest>;
  return (body.mode === "individual" || body.mode === "class") && (body.tone === "warm" || body.tone === "formal" || body.tone === "brief");
}

function extractGeminiText(data: GeminiResponse): string {
  return (
    data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .filter((text): text is string => Boolean(text))
      .join("")
      .trim() ?? ""
  );
}

function friendlyAiNotice(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("quota") || lower.includes("rate-limit") || lower.includes("rate limit")) {
    return "Gemini API 할당량 또는 사용 한도 문제로 로컬 초안을 생성했습니다.";
  }
  if (lower.includes("high demand")) {
    return "Gemini 모델 사용량이 많아 로컬 초안을 생성했습니다. 잠시 뒤 다시 시도해 주세요.";
  }
  return message;
}

async function generateWithGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("Gemini API 키가 없습니다.");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTIONS }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 900,
      },
    }),
  });

  const data = (await response.json()) as GeminiResponse;
  if (!response.ok) throw new Error(data.error?.message ?? "Gemini 요청 중 오류가 발생했습니다.");

  return extractGeminiText(data);
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API 키가 없습니다.");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    instructions: SYSTEM_INSTRUCTIONS,
    input: prompt,
    max_output_tokens: 900,
  });

  return response.output_text?.trim() ?? "";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!isGenerateRequest(body)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const fallback = buildLocalDraft(body);
  const prompt = buildPrompt(body);

  try {
    if (GEMINI_API_KEY) {
      return NextResponse.json({
        message: (await generateWithGemini(prompt)) || fallback,
        source: "gemini",
        model: GEMINI_MODEL,
      });
    }

    if (process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        message: (await generateWithOpenAI(prompt)) || fallback,
        source: "openai",
        model: OPENAI_MODEL,
      });
    }

    return NextResponse.json({
      message: fallback,
      source: "local",
      notice: "API 키가 없어 로컬 초안을 생성했습니다.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 요청 중 오류가 발생했습니다.";
    return NextResponse.json({
      message: fallback,
      source: "local",
      notice: friendlyAiNotice(message),
    });
  }
}
