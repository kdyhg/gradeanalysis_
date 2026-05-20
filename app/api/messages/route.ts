import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { buildLocalDraft, buildPrompt, type GenerateRequest } from "@/lib/local-message";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

function isGenerateRequest(value: unknown): value is GenerateRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<GenerateRequest>;
  return (body.mode === "individual" || body.mode === "class") && (body.tone === "warm" || body.tone === "formal" || body.tone === "brief");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!isGenerateRequest(body)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const fallback = buildLocalDraft(body);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      message: fallback,
      source: "local",
      notice: "OPENAI_API_KEY가 없어 로컬 초안을 생성했습니다.",
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: MODEL,
      instructions:
        "너는 한국 학교 담임교사의 학부모 소통 문안을 돕는 조심스럽고 전문적인 보조자다. 개인정보를 새로 추정하지 말고, 제공된 데이터 범위 안에서만 작성한다. 출력은 한국어 본문만 제공한다.",
      input: buildPrompt(body),
      max_output_tokens: 900,
    });

    return NextResponse.json({
      message: response.output_text?.trim() || fallback,
      source: "openai",
      model: MODEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI 요청 중 오류가 발생했습니다.";
    return NextResponse.json({
      message: fallback,
      source: "local",
      notice: message,
    });
  }
}
