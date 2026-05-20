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

function toneLabel(tone: Tone): string {
  if (tone === "formal") return "정중하고 단정한";
  if (tone === "brief") return "간결하고 선명한";
  return "따뜻하고 격려하는";
}

function studyAdvice(subject: SubjectScore | null): string {
  if (!subject) {
    return "수업 시간에 다룬 핵심 개념을 짧게 정리하고, 틀린 문제를 다시 풀어 보며 스스로 설명하는 연습을 이어가면 좋겠습니다.";
  }

  const name = subject.subject;
  if (/문학|독서|국어|화법|작문/.test(name)) {
    return `${name} 과목은 지문을 빠르게 넘기기보다 근거 문장에 밑줄을 긋고, 오답 선지가 왜 틀렸는지 한 줄로 정리하는 연습이 도움이 되겠습니다.`;
  }
  if (/대수|수학|미적|확률|기하/.test(name)) {
    return `${name} 과목은 풀이 과정을 눈으로만 확인하지 말고, 막힌 단계와 사용한 개념을 따로 표시해 같은 유형을 다시 풀어 보는 방식이 좋겠습니다.`;
  }
  if (/영어/.test(name)) {
    return `${name} 과목은 지문 구조를 먼저 파악하고, 모르는 어휘를 문장 속에서 다시 확인하는 복습 루틴을 만들면 안정감을 높일 수 있겠습니다.`;
  }
  if (/물리|화학|생명|지구|과학/.test(name)) {
    return `${name} 과목은 개념 정의와 그래프, 표, 실험 조건을 연결해 정리하고 계산형 문제는 풀이 순서를 반복 점검하는 공부가 필요합니다.`;
  }
  return `${name} 과목은 수업 자료의 핵심 개념을 먼저 정리한 뒤, 틀린 문제의 원인을 개념 부족, 조건 해석, 시간 관리로 나누어 복습하면 좋겠습니다.`;
}

function classLabel(context?: ClassContext): string {
  const grade = context?.grade ? `${context.grade}학년` : "[학년]";
  const classNumber = context?.classNumber ? `${context.classNumber}반` : "[반]";
  return `${grade} ${classNumber}`;
}

export function buildLocalDraft(input: GenerateRequest): string {
  if (input.mode === "class") {
    const summary = input.classSummary;
    if (!summary) return "학급 분석 자료를 먼저 불러와 주세요.";
    const klass = classLabel(input.classContext);

    return [
      "학부모님, 안녕하십니까?",
      `한 학기의 흐름 속에서 ${klass} 학생들의 성적 통지표를 보내드립니다. 그동안 아이들이 건강하게 학교생활을 이어갈 수 있도록 관심과 격려로 함께해 주신 학부모님들께 감사드립니다.`,
      "이번 성적표는 단순한 숫자의 결과라기보다, 학생들이 수업 속에서 고민하고 질문하며 자신의 속도로 쌓아 온 과정의 기록입니다. 기대한 만큼의 결과에 기뻐하는 학생도 있고, 아쉬움을 느끼는 학생도 있겠지만, 중요한 것은 이 결과를 다음 성장을 위한 출발점으로 삼는 일이라 생각합니다.",
      "가정에서도 성적을 질책하기보다 아이가 어떤 부분을 성실히 해냈는지 먼저 들어주시고, 다음에는 어떤 습관을 조금 더 보완하면 좋을지 차분히 이야기해 주시면 좋겠습니다. 학교에서도 학생들이 스스로의 가능성을 믿고 꾸준히 나아갈 수 있도록 살피고 지도하겠습니다.",
      "가정에 건강과 평안이 늘 함께하시기를 바랍니다. 감사합니다.",
    ].join("\n\n");
  }

  const student = input.student;
  if (!student) return "학생을 먼저 선택해 주세요.";
  const teacher = input.teacherName ? `\n\n${input.teacherName} 드림` : "";
  const focus = student.focusSubject;
  const strength = student.strongestSubject;
  const observation = input.teacherObservation?.trim();
  const opening = input.includeScores && student.averageScore !== null
    ? `이번 평가의 전반적인 결과를 살펴보면 평균은 ${student.averageScore}점이며,`
    : "이번 평가 결과를 살펴보면";
  const observationSentence = observation
    ? `담임으로서 관찰한 바로는 ${observation}`
    : `${student.name} 학생은 수업과 과제 과정에서 자신의 속도로 해내려는 모습을 보여 주었습니다.`;

  return [
    `${student.name} 학부모님께.`,
    `${opening} ${observationSentence} ${strength?.subject ?? "몇몇 과목"}에서 보여 준 태도를 바탕으로 자신감을 이어가면 좋겠습니다.`,
    `앞으로는 ${focus?.subject ?? "보완이 필요한 과목"} 학습에서 한 가지 습관을 더 연습해 보면 좋겠습니다. ${studyAdvice(focus)}`,
    "가정에서는 결과를 먼저 평가하기보다 아이가 어떤 방식으로 공부했는지 차분히 들어주시고, 매일 10분 복습하기나 읽은 내용을 말로 설명해 보기처럼 작게 실천할 수 있는 약속을 함께 확인해 주시면 도움이 되겠습니다.",
    "학교에서도 수업 참여와 학습 습관을 꾸준히 살피며 가정과 같은 마음으로 지도하겠습니다.",
  ].join("\n\n") + teacher;
}

export function buildPrompt(input: GenerateRequest): string {
  const sharedRules = [
    "한국 고등학교 담임교사가 학부모에게 보내는 문안으로 작성한다.",
    "학생을 낙인찍거나 다른 학생과 비교하지 않는다.",
    "제공된 성적, 석차, 5등급제 분석은 내부 판단에만 사용하고 문안은 교육적 조언으로 풀어 쓴다.",
    "학업 결과, 다음 공부 방향, 가정에서 도울 수 있는 행동을 균형 있게 담는다.",
    "과장된 약속이나 진단적 표현을 피한다.",
    `문체는 ${toneLabel(input.tone)} 톤으로 한다.`,
  ];

  if (input.mode === "class") {
    return [
      sharedRules.join("\n"),
      "단체 메시지는 학급 전체에 공통으로 들어가는 가정통신문이다.",
      "개별 학생, 특정 과목, 평균 점수, 석차, 등급, 백분위, 우수/부진 학생 수를 직접 언급하지 않는다.",
      "학급 전체의 전반적인 분위기, 학생들이 한 학기 동안 노력한 과정, 결과를 바라보는 태도, 가정에서의 따뜻한 격려 요청을 중심으로 쓴다.",
      "사용자가 준 예시처럼 학부모에게 감사 인사를 전하고, 성적표를 성장 과정의 기록으로 바라보도록 안내한다.",
      "학년과 반 정보가 있으면 자연스럽게 포함한다.",
      "650자에서 950자 사이의 본문으로 작성한다.",
      "학급 맥락 JSON:",
      JSON.stringify(input.classContext, null, 2),
      "학급 요약 JSON(문안에 숫자로 직접 쓰지 말고 분위기 판단에만 사용):",
      JSON.stringify(input.classSummary, null, 2),
    ].join("\n\n");
  }

  return [
    sharedRules.join("\n"),
    "개별 메시지는 해당 학생의 다음 공부 방향을 제안하는 데 집중한다.",
    "핵심은 가정에 '담임이 이 아이를 잘 보고 있다'는 느낌이 전달되게 하는 것이다.",
    "담임 관찰내용이 있으면 가장 우선해 자연스럽게 반영한다. 단, 성격을 단정하지 말고 관찰된 행동과 태도로 표현한다.",
    "보완점은 한 가지 정도만 언급하고, '부족하다'가 아니라 '앞으로는 ~을 조금 더 연습하면 좋겠습니다'처럼 성장 가능성으로 표현한다.",
    "등급, 등급대, 1-5등급, 석차, 백분위, 상위 몇 %, 평균 등급이라는 표현을 직접 쓰지 않는다.",
    input.includeScores
      ? "점수는 꼭 필요할 때만 한 번 정도 부드럽게 언급할 수 있으나, 핵심은 공부 방법 조언이어야 한다."
      : "구체적인 점수 숫자도 쓰지 않는다.",
    "강점은 자신감을 이어갈 근거로, 보완점은 구체적인 학습 전략으로 풀어 쓴다.",
    "가정에서 도울 방법은 매일 10분 복습하기, 읽은 내용을 말로 설명해 보기, 과제 계획 함께 확인하기처럼 실천 가능한 제안으로 쓴다.",
    "친구와 비교하는 말, 성격을 단정하는 말, '노력이 부족함' 같은 막연한 지적, 성적만 강조하는 문장을 피한다.",
    "마무리는 학교와 가정이 함께 살피겠다는 협력 메시지로 쓴다.",
    "학생 이름을 자연스럽게 1회 이상 포함한다.",
    "280자에서 450자 사이의 길지 않은 본문으로 작성한다.",
    "담임 관찰내용:",
    input.teacherObservation?.trim() || "(입력 없음)",
    "학생 요약 JSON:",
    JSON.stringify(input.student, null, 2),
  ].join("\n\n");
}
