import type { ClassSummary, StudentReport, SubjectScore } from "@/lib/grade-parser";

export type MessageMode = "individual" | "class";
export type Tone = "warm" | "formal" | "brief";

export type ClassContext = {
  year?: string | null;
  semester?: string | null;
  grade?: string | null;
  classNumber?: string | null;
  examName?: string | null;
};

export type GenerateRequest = {
  mode: MessageMode;
  tone: Tone;
  includeScores: boolean;
  teacherName?: string;
  teacherObservation?: string;
  student?: StudentReport;
  classSummary?: ClassSummary;
  classContext?: ClassContext;
};

type MessageStudentContext = {
  name: string;
  observation: string | null;
  strengthSubject: string | null;
  focusSubject: string | null;
  focusAdvice: string;
  averageScore?: number | null;
};

function toneLabel(tone: Tone): string {
  if (tone === "formal") return "정중하고 담백한";
  if (tone === "brief") return "짧고 자연스러운";
  return "따뜻하지만 과장하지 않는";
}

function compactSubjectName(subject: SubjectScore | null): string | null {
  return subject?.subject?.replace(/\(\d+\)/g, "").trim() || null;
}

function studyAdvice(subject: SubjectScore | null): string {
  if (!subject) {
    return "수업에서 다룬 내용을 그날 짧게 다시 보고, 틀린 문제는 풀이를 말로 설명해 보는 연습이 좋겠습니다.";
  }

  const name = compactSubjectName(subject) ?? "해당 과목";
  if (/문학|독서|국어|화법|작문/.test(name)) {
    return `${name}은 지문을 읽은 뒤 근거 문장을 표시하고, 오답 선지가 왜 맞지 않는지 한 줄로 정리해 보면 좋겠습니다.`;
  }
  if (/대수|수학|미적|확률|기하/.test(name)) {
    return `${name}은 풀이를 눈으로 확인하는 데서 멈추지 말고, 막힌 단계와 사용한 개념을 표시한 뒤 같은 유형을 다시 풀어 보면 좋겠습니다.`;
  }
  if (/영어/.test(name)) {
    return `${name}은 지문 흐름을 먼저 잡고, 모르는 어휘를 문장 속에서 다시 확인하는 짧은 복습이 도움이 되겠습니다.`;
  }
  if (/물리|화학|생명|지구|과학/.test(name)) {
    return `${name}은 개념과 그래프, 표, 조건을 함께 묶어 정리하고 계산 과정은 순서대로 다시 써 보는 연습이 필요합니다.`;
  }
  return `${name}은 핵심 개념을 먼저 정리하고, 틀린 이유를 개념 이해, 조건 해석, 시간 관리 중 하나로 나누어 복습하면 좋겠습니다.`;
}

function classLabel(context?: ClassContext): string {
  const grade = context?.grade ? `${context.grade}학년` : "[학년]";
  const classNumber = context?.classNumber ? `${context.classNumber}반` : "[반]";
  return `${grade} ${classNumber}`;
}

function observationSentence(name: string, observation: string | null): string {
  if (!observation) {
    return `${name}이는 수업과 과제 과정에서 자기 몫을 해내려는 모습을 보여 주었습니다.`;
  }

  const base = observation.trim().replace(/[.。]+$/, "");
  if (/모습이\s*보임$/.test(base)) {
    return `${name}이는 ${base.replace(/모습이\s*보임$/, "모습을 보여 주었습니다.")}`;
  }
  if (/보임$/.test(base)) {
    return `${name}이는 ${base.replace(/보임$/, "모습을 보여 주었습니다.")}`;
  }
  if (/함$/.test(base)) {
    return `${name}이는 ${base.replace(/함$/, "하는 모습을 보여 주었습니다.")}`;
  }
  if (/(습니다|다|요)$/.test(base)) {
    return `${name}이는 ${base}.`;
  }
  return `${name}이는 ${base} 모습을 보여 주었습니다.`;
}

function studentContext(input: GenerateRequest): MessageStudentContext | null {
  const student = input.student;
  if (!student) return null;
  return {
    name: student.name,
    observation: input.teacherObservation?.trim() || null,
    strengthSubject: compactSubjectName(student.strongestSubject),
    focusSubject: compactSubjectName(student.focusSubject),
    focusAdvice: studyAdvice(student.focusSubject),
    averageScore: input.includeScores ? student.averageScore : undefined,
  };
}

function classMessageContext(input: GenerateRequest) {
  return {
    classContext: input.classContext,
    studentCount: input.classSummary?.studentCount ?? null,
  };
}

export function buildLocalDraft(input: GenerateRequest): string {
  if (input.mode === "class") {
    const klass = classLabel(input.classContext);
    return [
      "학부모님, 안녕하십니까?",
      `한 학기의 흐름 속에서 ${klass} 학생들의 성적 통지표를 보내드립니다. 그동안 아이들이 건강하게 학교생활을 이어갈 수 있도록 관심과 격려로 함께해 주신 학부모님들께 감사드립니다.`,
      "이번 성적표는 단순한 숫자의 결과라기보다, 학생들이 수업 속에서 고민하고 질문하며 자신의 속도로 쌓아 온 과정의 기록입니다. 기대한 만큼 기뻐하는 학생도 있고 아쉬움을 느끼는 학생도 있겠지만, 중요한 것은 이 결과를 다음 배움의 출발점으로 삼는 일이라 생각합니다.",
      "가정에서도 성적을 먼저 묻기보다 아이가 어떤 부분을 성실히 해냈는지 들어주시고, 다음에는 어떤 습관을 조금 더 보완하면 좋을지 차분히 이야기해 주시면 좋겠습니다. 학교에서도 학생들이 스스로 해낼 수 있다는 마음을 잃지 않도록 꾸준히 살피겠습니다.",
      "가정에 건강과 평안이 함께하시기를 바랍니다. 감사합니다.",
    ].join("\n\n");
  }

  const context = studentContext(input);
  if (!context) return "학생을 먼저 선택해 주세요.";

  const teacher = input.teacherName ? `\n\n${input.teacherName} 드림` : "";
  const observation = observationSentence(context.name, context.observation);
  const strength = context.strengthSubject
    ? `${context.strengthSubject}에서 보여 준 꾸준함도 계속 살려 가면 좋겠습니다.`
    : "지금처럼 수업에서 보이는 성실한 태도를 이어가면 좋겠습니다.";
  const focusSentence = context.focusSubject
    ? `앞으로는 ${context.focusSubject}에서 한 가지 습관을 조금 더 연습해 보면 좋겠습니다.`
    : "앞으로는 배운 내용을 스스로 정리하는 습관을 조금 더 연습해 보면 좋겠습니다.";
  const scorePrefix = context.averageScore !== undefined && context.averageScore !== null ? "이번 평가 결과를 함께 확인했습니다. " : "";

  return [
    `${context.name} 학부모님께.`,
    `${scorePrefix}${observation} ${strength}`,
    `${focusSentence} ${context.focusAdvice}`,
    "가정에서는 결과를 바로 평가하기보다 공부한 방법을 먼저 물어봐 주세요. 매일 10분 복습하기, 읽은 내용을 말로 설명해 보기, 과제 계획을 함께 확인하기처럼 작게 지킬 수 있는 약속을 정해 주시면 도움이 되겠습니다.",
    "학교에서도 수업 참여와 학습 습관을 꾸준히 살피며 가정과 함께 지도하겠습니다.",
  ].join("\n\n") + teacher;
}

export function buildCounselingMemo(student: StudentReport | null, observation: string): string {
  if (!student) return "학생을 먼저 선택해 주세요.";

  const strength = compactSubjectName(student.strongestSubject) ?? "수업에서 해낸 부분";
  const focus = compactSubjectName(student.focusSubject) ?? "학습 습관";
  const advice = studyAdvice(student.focusSubject);
  const observed = observation.trim() || "최근 수업 참여, 과제 수행, 질문 태도 중 학생에게 먼저 확인하고 싶은 장면을 적어 두면 좋습니다.";

  return [
    `[${student.name} 상담 참고]`,
    "",
    "1. 먼저 물어볼 질문",
    "- 이번 시험을 준비하면서 스스로 가장 잘했다고 생각하는 부분은 무엇인지",
    "- 공부하다가 가장 자주 막힌 순간은 언제였는지",
    "- 다음 평가 전까지 바꾸고 싶은 공부 습관이 하나 있다면 무엇인지",
    "",
    "2. 담임 관찰 포인트",
    `- ${observed}`,
    "",
    "3. 격려할 부분",
    `- ${strength}에서 보인 태도나 끝까지 해낸 경험을 먼저 짚어 주기`,
    "",
    "4. 함께 정할 한 가지 약속",
    `- ${focus}: ${advice}`,
    "- 약속은 크게 잡기보다 매일 10분 복습, 오답 2문제 설명하기, 과제 계획 확인처럼 확인 가능한 행동으로 정하기",
    "",
    "5. 마무리 문장",
    "- 결과보다 다음에 바꿀 수 있는 방법을 함께 찾자는 방향으로 마무리하기",
  ].join("\n");
}

export function buildPrompt(input: GenerateRequest): string {
  const sharedRules = [
    "한국 고등학교 담임교사가 학부모에게 보내는 문안으로 작성한다.",
    "AI가 쓴 글처럼 거창하거나 과하게 매끄러운 표현을 피한다.",
    "담임이 실제로 쓰는 짧고 자연스러운 문장으로 쓴다.",
    "친구와 비교하는 말, 성격을 단정하는 말, 막연한 지적, 성적만 강조하는 문장을 피한다.",
    "등급, 석차, 백분위, 상위, 순위, 등급대, 평균 등급이라는 표현은 절대 쓰지 않는다.",
    `문체는 ${toneLabel(input.tone)} 톤으로 한다.`,
  ];

  if (input.mode === "class") {
    return [
      sharedRules.join("\n"),
      "단체 메시지는 학급 전체에 공통으로 들어가는 가정통신문이다.",
      "특정 학생, 특정 과목, 평균 점수, 등급, 석차, 백분위, 우수/부진 학생 수를 직접 언급하지 않는다.",
      "학급 전체의 분위기, 학생들이 한 학기 동안 노력한 과정, 가정에서의 격려 요청을 중심으로 쓴다.",
      "상투적인 문구는 줄이고 담임이 직접 전하는 말처럼 쓴다.",
      "학년과 반 정보가 있으면 자연스럽게 포함한다.",
      "550자에서 800자 사이로 쓴다.",
      "학급 맥락 JSON:",
      JSON.stringify(classMessageContext(input), null, 2),
    ].join("\n\n");
  }

  return [
    sharedRules.join("\n"),
    "개별 메시지는 성적 해설이 아니라 성장 안내에 둔다.",
    "핵심은 가정에 '담임이 이 아이를 잘 보고 있다'는 느낌이 전달되게 하는 것이다.",
    "담임 관찰내용이 있으면 가장 우선해 반영한다. 성격을 단정하지 말고 관찰된 행동과 태도로 표현한다.",
    "보완점은 한 가지 정도만 언급하고, '부족하다'가 아니라 '앞으로는 ~을 조금 더 연습하면 좋겠습니다'처럼 표현한다.",
    "가정에서 도울 방법은 매일 10분 복습하기, 읽은 내용을 말로 설명해 보기, 과제 계획 함께 확인하기처럼 실천 가능한 제안으로 쓴다.",
    "마무리는 학교와 가정이 함께 살피겠다는 협력 메시지로 쓴다.",
    "280자에서 430자 사이로 쓴다.",
    "학생 메시지 맥락 JSON:",
    JSON.stringify(studentContext(input), null, 2),
  ].join("\n\n");
}
