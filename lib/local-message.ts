import type { ClassSummary, StudentReport } from "@/lib/grade-parser";
import { formatSigned } from "@/lib/grade-parser";

export type MessageMode = "individual" | "class";
export type Tone = "warm" | "formal" | "brief";

export type GenerateRequest = {
  mode: MessageMode;
  tone: Tone;
  includeScores: boolean;
  teacherName?: string;
  student?: StudentReport;
  classSummary?: ClassSummary;
};

function toneLabel(tone: Tone): string {
  if (tone === "formal") return "정중하고 단정한";
  if (tone === "brief") return "간결하고 선명한";
  return "따뜻하고 격려하는";
}

function subjectLine(report: StudentReport): string {
  const strong = report.strongestSubject;
  const focus = report.focusSubject;
  const strongText = strong ? `${strong.subject}(${formatSigned(strong.deltaFromAverage)})` : "확인된 강점 과목 없음";
  const focusText = focus ? `${focus.subject}(${formatSigned(focus.deltaFromAverage)})` : "확인된 보완 과목 없음";
  return `강점: ${strongText}, 보완: ${focusText}`;
}

export function buildLocalDraft(input: GenerateRequest): string {
  if (input.mode === "class") {
    const summary = input.classSummary;
    if (!summary) return "학급 분석 자료를 먼저 불러와 주세요.";
    const focus = summary.focusSubjects.map((subject) => subject.subject).join(", ") || "보완 과목 없음";
    const top = summary.topSubjects.map((subject) => subject.subject).join(", ") || "강점 과목 없음";
    return [
      "학부모님께.",
      `${summary.studentCount}명 성적을 살펴본 결과, 학급 평균은 ${summary.classAverage ?? "-"}점이며 과목 평균 대비 차이는 ${formatSigned(summary.averageGap)}점입니다.`,
      `상대적으로 안정적인 흐름을 보인 과목은 ${top}이고, 다음 기간에 함께 점검하면 좋을 과목은 ${focus}입니다.`,
      "가정에서는 결과 자체보다 학습 습관, 오답 정리, 질문하는 태도가 이어질 수 있도록 격려해 주시면 학교에서도 학생별 상황에 맞춰 꾸준히 살피겠습니다.",
    ].join("\n\n");
  }

  const student = input.student;
  if (!student) return "학생을 먼저 선택해 주세요.";
  const teacher = input.teacherName ? `\n\n${input.teacherName} 드림` : "";
  const scoreText = input.includeScores
    ? ` 평균은 ${student.averageScore ?? "-"}점, 과목 평균 대비 ${formatSigned(student.averageDelta)}점입니다.`
    : "";
  return [
    `${student.name} 학부모님께.`,
    `${student.name} 학생의 이번 평가를 살펴보았습니다.${scoreText} ${subjectLine(student)} 흐름이 확인됩니다.`,
    "잘 해낸 부분은 자신감으로 이어가고, 보완이 필요한 과목은 오답 원인과 공부 시간을 함께 점검하면 다음 평가에서 더 안정적인 변화를 만들 수 있겠습니다.",
    "학교에서도 수업 참여와 학습 습관을 지속적으로 살피며 필요한 도움을 이어가겠습니다.",
  ].join("\n\n") + teacher;
}

export function buildPrompt(input: GenerateRequest): string {
  const sharedRules = [
    "한국 고등학교 담임교사가 학부모에게 보내는 문안으로 작성한다.",
    "학생을 낙인찍거나 비교하지 않는다.",
    "순위와 등급은 요청 데이터에 있어도 과도하게 강조하지 않는다.",
    "학업 결과, 노력 방향, 가정에서 도울 수 있는 행동을 균형 있게 담는다.",
    "과장된 약속이나 진단적 표현을 피한다.",
    `문체는 ${toneLabel(input.tone)} 톤으로 한다.`,
    input.includeScores ? "필요한 경우 점수와 평균 대비 차이를 자연스럽게 포함한다." : "구체적인 점수 숫자는 쓰지 않는다.",
  ];

  if (input.mode === "class") {
    return [
      sharedRules.join("\n"),
      "단체 메시지이므로 학생 이름을 언급하지 않는다.",
      "300자에서 500자 사이의 본문으로 작성한다.",
      "학급 요약 JSON:",
      JSON.stringify(input.classSummary, null, 2),
    ].join("\n\n");
  }

  return [
    sharedRules.join("\n"),
    "개별 메시지이므로 학생 이름을 자연스럽게 1회 이상 포함한다.",
    "350자에서 650자 사이의 본문으로 작성한다.",
    "학생 요약 JSON:",
    JSON.stringify(input.student, null, 2),
  ].join("\n\n");
}
