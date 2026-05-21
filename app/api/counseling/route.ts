import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { buildCounselingMemo, buildCounselingPrompt, type CounselingRequest } from "@/lib/local-message";

export const runtime = "nodejs";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

const SYSTEM_INSTRUCTIONS =
  "너는 한국 학교 담임교사의 학생 성적 상담을 돕는 전문적인 보조자다. 제공된 성적자료만 근거로 삼고, 학생을 낙인찍지 않는다. 출력은 교사용 내부 참고자료이며, 학생과 상담할 때 확인할 지점과 보완 방법을 구체적으로 제안한다. 한국어 본문만 제공한다.";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function isCounselingRequest(value: unknown): value is CounselingRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<CounselingRequest>;
  return Boolean(body.student && typeof body.student === "object");
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
    return "Gemini API 할당량 또는 사용 한도 문제로 로컬 상담 자료를 생성했습니다.";
  }
  if (lower.includes("expired") || lower.includes("api key not valid") || lower.includes("invalid api key")) {
    return "Gemini API 키를 확인할 수 없어 로컬 상담 자료를 생성했습니다. 새 키를 발급해 환경 변수에 다시 등록해 주세요.";
  }
  if (lower.includes("high demand")) {
    return "Gemini 모델 사용량이 많아 로컬 상담 자료를 생성했습니다. 잠시 뒤 다시 시도해 주세요.";
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
        temperature: 0.35,
        maxOutputTokens: 1500,
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
    max_output_tokens: 1500,
  });

  return response.output_text?.trim() ?? "";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!isCounselingRequest(body)) {
    return NextResponse.json({ error: "학생 성적자료가 필요합니다." }, { status: 400 });
  }

  const fallback = buildCounselingMemo(body.student ?? null, body.teacherObservation ?? "");
  const prompt = buildCounselingPrompt(body);

  try {
    if (GEMINI_API_KEY) {
      return NextResponse.json({
        memo: (await generateWithGemini(prompt)) || fallback,
        source: "gemini",
        model: GEMINI_MODEL,
      });
    }

    if (process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        memo: (await generateWithOpenAI(prompt)) || fallback,
        source: "openai",
        model: OPENAI_MODEL,
      });
    }

    return NextResponse.json({
      memo: fallback,
      source: "local",
      notice: "API 키가 없어 로컬 상담 자료를 생성했습니다.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 요청 중 오류가 발생했습니다.";
    return NextResponse.json({
      memo: fallback,
      source: "local",
      notice: friendlyAiNotice(message),
    });
  }
}
