"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clipboard,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  fiveGradeLabel,
  formatPercentile,
  formatSigned,
  parseNeisRows,
  summarizeClass,
  type ClassSummary,
  type StudentReport,
  type SubjectScore,
} from "@/lib/grade-parser";
import { buildCounselingMemo, type MessageMode, type Tone } from "@/lib/local-message";

type MessageSource = "idle" | "openai" | "gemini" | "local";

const statusLabels: Record<StudentReport["overallStatus"], string> = {
  growth: "강점",
  steady: "안정",
  support: "점검",
  missing: "자료없음",
};

const toneOptions: Array<{ value: Tone; label: string }> = [
  { value: "warm", label: "따뜻하게" },
  { value: "formal", label: "정중하게" },
  { value: "brief", label: "간결하게" },
];

function scoreText(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}

function rankText(subject: SubjectScore): string {
  if (subject.rank === null || !subject.participants) return "-";
  return `${subject.rankLabel ?? subject.rank}/${subject.participants}`;
}

function subjectStatusLabel(status: SubjectScore["status"]): string {
  if (status === "strength") return "강점";
  if (status === "watch") return "점검";
  if (status === "missing") return "자료없음";
  return "보통";
}

function toCsv(reports: StudentReport[]): string {
  const header = ["반", "번호", "이름", "과목", "점수", "과목평균", "차이", "석차", "중간석차", "석차백분위", "5등급", "수강자수", "상태"];
  const rows = reports.flatMap((report) =>
    report.subjects.map((subject) => [
      report.classNumber ?? "",
      report.studentNumber ?? "",
      report.name,
      subject.subject,
      subject.value ?? "",
      subject.subjectAverage ?? "",
      subject.deltaFromAverage ?? "",
      subject.rankLabel ?? "",
      subject.midRank ?? "",
      subject.percentile ?? "",
      subject.fiveGrade ?? "",
      subject.participants ?? "",
      subjectStatusLabel(subject.status),
    ]),
  );

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [parseError, setParseError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [mode, setMode] = useState<MessageMode>("individual");
  const [tone, setTone] = useState<Tone>("warm");
  const [includeScores, setIncludeScores] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [classGrade, setClassGrade] = useState("");
  const [classNumberInput, setClassNumberInput] = useState("");
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [counselingMemo, setCounselingMemo] = useState("");
  const [notice, setNotice] = useState("");
  const [messageSource, setMessageSource] = useState<MessageSource>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const summary = useMemo<ClassSummary | null>(() => (reports.length ? summarizeClass(reports) : null), [reports]);
  const selectedStudent = reports.find((report) => report.id === selectedId) ?? reports[0] ?? null;
  const selectedObservation = selectedStudent ? observations[selectedStudent.id] ?? "" : "";

  async function parseUploadedFile(file: File) {
    setIsParsing(true);
    setParseError("");
    setMessage("");
    setNotice("");
    setMessageSource("idle");
    setObservations({});
    setCounselingMemo("");

    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("첫 번째 시트를 찾지 못했습니다.");
      const rows: unknown[][] = [];
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows[rowNumber - 1] = values.map((value) => {
          if (value instanceof Date) return value;
          if (value && typeof value === "object" && "text" in value) return String(value.text);
          if (value && typeof value === "object" && "result" in value) return value.result;
          return value ?? null;
        });
      });
      const parsed = parseNeisRows(rows);

      if (!parsed.length) {
        throw new Error("성적 통지표 블록을 찾지 못했습니다.");
      }

      setFileName(file.name);
      setReports(parsed);
      setSelectedId(parsed[0]?.id ?? null);
      setClassGrade(parsed[0]?.grade ?? "");
      setClassNumberInput(parsed[0]?.classNumber ?? "");
    } catch (error) {
      setReports([]);
      setSelectedId(null);
      setFileName("");
      setParseError(error instanceof Error ? error.message : "엑셀 파일을 읽지 못했습니다.");
    } finally {
      setIsParsing(false);
      setIsDragging(false);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await parseUploadedFile(file);
    } finally {
      event.target.value = "";
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      setIsDragging(false);
      return;
    }
    await parseUploadedFile(file);
  }

  function downloadCsv() {
    if (!reports.length) return;
    const blob = new Blob([`\uFEFF${toCsv(reports)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "class-grade-analysis.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function generateMessage() {
    if (!summary || (mode === "individual" && !selectedStudent)) return;

    setIsGenerating(true);
    setNotice("");
    setMessageSource("idle");

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          tone,
          includeScores,
          teacherName,
          teacherObservation: mode === "individual" ? selectedObservation : undefined,
          student: mode === "individual" ? selectedStudent : undefined,
          classSummary: mode === "class" ? summary : undefined,
          classContext:
            mode === "class"
              ? {
                  year: reports[0]?.year,
                  semester: reports[0]?.semester,
                  grade: classGrade || reports[0]?.grade,
                  classNumber: classNumberInput || reports[0]?.classNumber,
                  examName: reports[0]?.examName,
                }
              : undefined,
        }),
      });
      const data = (await response.json()) as { message?: string; source?: MessageSource; notice?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "문안 생성에 실패했습니다.");
      setMessage(data.message ?? "");
      setMessageSource(data.source ?? "local");
      setNotice(data.notice ?? "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문안 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyMessage() {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setNotice("문안을 클립보드에 복사했습니다.");
  }

  function generateCounselingMemo() {
    setCounselingMemo(buildCounselingMemo(selectedStudent, selectedObservation));
    setNotice("성적 상담 참고 자료를 만들었습니다.");
  }

  async function copyCounselingMemo() {
    if (!counselingMemo) return;
    await navigator.clipboard.writeText(counselingMemo);
    setNotice("성적 상담 참고 자료를 클립보드에 복사했습니다.");
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">담임 성적 분석</p>
          <h1>가정 메시지 스튜디오</h1>
        </div>
        <div className="top-actions">
          <label className="icon-button primary" title="엑셀 업로드">
            <Upload size={18} />
            <span>파일 선택</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
          </label>
          <button className="icon-button" type="button" onClick={downloadCsv} disabled={!reports.length} title="CSV 다운로드">
            <Download size={18} />
            <span>CSV</span>
          </button>
        </div>
      </header>

      <section
        className={`upload-strip ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="file-state">
          <FileSpreadsheet size={22} />
          <div>
            <strong>{fileName || "나이스 성적통지표 xlsx"}</strong>
            <span>{isParsing ? "분석 중" : reports.length ? `${reports.length}명 분석 완료` : "대기 중"}</span>
            <span className="download-guide">
              이곳에 파일을 끌어 놓거나 파일 선택을 누르세요. 나이스 &gt; 학급담임 &gt; 성적 &gt; 성적처리 &gt; 성적통지표 &gt; 가정에서 학교로 &gt; 가정통신문 제외 후 미리보기 &gt; XLS DATA 다운로드
            </span>
          </div>
        </div>
        {isParsing && <Loader2 className="spin" size={20} />}
        {parseError && (
          <p className="notice error">
            <AlertCircle size={16} />
            {parseError}
          </p>
        )}
      </section>

      {summary ? (
        <>
          <section className="metrics-grid" aria-label="학급 요약">
            <div className="metric">
              <span>학생</span>
              <strong>{summary.studentCount}</strong>
            </div>
            <div className="metric">
              <span>과목</span>
              <strong>{summary.subjectCount}</strong>
            </div>
            <div className="metric">
              <span>평균</span>
              <strong>{scoreText(summary.classAverage)}</strong>
            </div>
            <div className="metric accent">
              <span>평균 대비</span>
              <strong>{formatSigned(summary.averageGap)}</strong>
            </div>
            <div className="metric">
              <span>5등급제 평균</span>
              <strong>{fiveGradeLabel(summary.averageFiveGrade)}</strong>
            </div>
            <div className="metric warn">
              <span>점검 학생</span>
              <strong>{summary.supportCount}</strong>
            </div>
          </section>

          <section className="main-grid">
            <aside className="panel student-list" aria-label="학생 목록">
              <div className="panel-title">
                <UsersRound size={18} />
                <h2>학생</h2>
              </div>
              <div className="student-scroll">
                {reports.map((report) => (
                  <button
                    className={`student-row ${selectedStudent?.id === report.id ? "selected" : ""}`}
                    key={report.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(report.id);
                      setCounselingMemo("");
                    }}
                  >
                    <span className="number">{report.studentNumber ?? "-"}</span>
                    <span className="student-name">{report.name}</span>
                    <span className={`badge ${report.overallStatus}`}>{statusLabels[report.overallStatus]}</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="panel detail-panel" aria-label="학생 분석">
              <div className="panel-title split">
                <div>
                  <UserRound size={18} />
                  <h2>{selectedStudent?.name ?? "학생"}</h2>
                </div>
                <span className="soft-pill">
                  {selectedStudent?.grade ?? "-"}학년 {selectedStudent?.classNumber ?? "-"}반 {selectedStudent?.studentNumber ?? "-"}번
                </span>
              </div>

              {selectedStudent ? (
                <>
                  <div className="student-summary">
                    <div>
                      <span>평균</span>
                      <strong>{scoreText(selectedStudent.averageScore)}</strong>
                    </div>
                    <div>
                      <span>평균 대비</span>
                      <strong>{formatSigned(selectedStudent.averageDelta)}</strong>
                    </div>
                    <div>
                      <span>5등급제 평균</span>
                      <strong>{fiveGradeLabel(selectedStudent.averageFiveGrade)}</strong>
                    </div>
                    <div>
                      <span>강점</span>
                      <strong>{selectedStudent.strengthCount}</strong>
                    </div>
                    <div>
                      <span>점검</span>
                      <strong>{selectedStudent.watchCount}</strong>
                    </div>
                  </div>

                  <div className="subject-table-wrap">
                    <table className="subject-table">
                      <thead>
                        <tr>
                          <th>과목</th>
                          <th>점수</th>
                          <th>평균</th>
                          <th>차이</th>
                          <th>석차</th>
                          <th>5등급</th>
                          <th>상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudent.subjects.length ? (
                          selectedStudent.subjects.map((subject) => (
                            <tr key={`${selectedStudent.id}-${subject.subject}`}>
                              <td>{subject.subject}</td>
                              <td>{scoreText(subject.value)}</td>
                              <td>{scoreText(subject.subjectAverage)}</td>
                              <td>{formatSigned(subject.deltaFromAverage)}</td>
                              <td title={formatPercentile(subject.percentile)}>{rankText(subject)}</td>
                              <td title={subject.fiveGradeLabel ?? ""}>{fiveGradeLabel(subject.fiveGrade)}</td>
                              <td>
                                <span className={`badge ${subject.status}`}>{subjectStatusLabel(subject.status)}</span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="empty-cell">
                              성적 데이터 없음
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>

            <section className="panel message-panel" aria-label="메시지 생성">
              <div className="panel-title split">
                <div>
                  <Sparkles size={18} />
                  <h2>문안</h2>
                </div>
                {messageSource !== "idle" && (
                  <span className={`soft-pill ${messageSource}`}>
                    {messageSource === "gemini" ? "Gemini" : messageSource === "openai" ? "OpenAI" : "로컬"}
                  </span>
                )}
              </div>

              <div className="segmented" role="tablist" aria-label="문안 범위">
                <button className={mode === "individual" ? "active" : ""} type="button" onClick={() => setMode("individual")}>
                  개별
                </button>
                <button className={mode === "class" ? "active" : ""} type="button" onClick={() => setMode("class")}>
                  단체
                </button>
              </div>

              <label className="field">
                <span>문체</span>
                <select value={tone} onChange={(event) => setTone(event.target.value as Tone)}>
                  {toneOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>담임명</span>
                <input value={teacherName} onChange={(event) => setTeacherName(event.target.value)} placeholder="선택" />
              </label>

              <div className="field-row">
                <label className="field">
                  <span>학년</span>
                  <input value={classGrade} onChange={(event) => setClassGrade(event.target.value)} placeholder="예: 2" />
                </label>
                <label className="field">
                  <span>반</span>
                  <input value={classNumberInput} onChange={(event) => setClassNumberInput(event.target.value)} placeholder="예: 10" />
                </label>
              </div>

              {mode === "individual" && (
                <label className="field">
                  <span>담임 관찰내용</span>
                  <textarea
                    className="observation-textarea"
                    value={selectedObservation}
                    onChange={(event) => {
                      if (!selectedStudent) return;
                      setObservations((current) => ({ ...current, [selectedStudent.id]: event.target.value }));
                    }}
                    placeholder="예: 수업 중 질문에 성실히 답하고, 과제 수행을 끝까지 해내려는 모습이 보임"
                  />
                </label>
              )}

              <label className="check-row">
                <input type="checkbox" checked={includeScores} onChange={(event) => setIncludeScores(event.target.checked)} />
                <span>점수 포함</span>
              </label>

              <button className="generate-button" type="button" onClick={generateMessage} disabled={isGenerating || !summary}>
                {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                <span>{isGenerating ? "생성 중" : "문안 생성"}</span>
              </button>

              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="생성된 문안" />

              <div className="message-actions">
                <button className="icon-button" type="button" onClick={copyMessage} disabled={!message} title="복사">
                  <Clipboard size={18} />
                  <span>복사</span>
                </button>
                {notice && (
                  <p className="notice">
                    <CheckCircle2 size={16} />
                    {notice}
                  </p>
                )}
              </div>

              {mode === "individual" && (
                <div className="counseling-box">
                  <div className="panel-title mini split">
                    <div>
                      <ClipboardList size={18} />
                      <h3>성적 상담 참고</h3>
                    </div>
                    <button className="icon-button" type="button" onClick={generateCounselingMemo} disabled={!selectedStudent} title="성적 상담 자료 만들기">
                      <ClipboardList size={18} />
                      <span>자료 만들기</span>
                    </button>
                  </div>
                  <textarea
                    className="counseling-textarea"
                    value={counselingMemo}
                    onChange={(event) => setCounselingMemo(event.target.value)}
                    placeholder="학생 성적자료를 바탕으로 한 보완 지점, 상담 질문, 다음 평가 전 실천 약속"
                  />
                  <div className="message-actions">
                    <button className="icon-button" type="button" onClick={copyCounselingMemo} disabled={!counselingMemo} title="성적 상담 자료 복사">
                      <Clipboard size={18} />
                      <span>자료 복사</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </section>

          <section className="panel class-panel" aria-label="과목별 학급 분석">
            <div className="panel-title">
              <BarChart3 size={18} />
              <h2>과목별 흐름</h2>
            </div>
            <div className="subject-bars">
              {summary.subjectSummaries.map((subject) => {
                const width = Math.min(100, Math.max(6, ((subject.averageScore ?? 0) / 100) * 100));
                return (
                  <div className="subject-bar-row" key={subject.subject}>
                    <span>{subject.subject}</span>
                    <div className="bar-track">
                      <div className={subject.gap !== null && subject.gap < 0 ? "bar negative" : "bar"} style={{ width: `${width}%` }} />
                    </div>
                    <strong>{scoreText(subject.averageScore)}</strong>
                    <strong>{fiveGradeLabel(subject.averageFiveGrade)}</strong>
                    <em>{formatSigned(subject.gap)}</em>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <FileSpreadsheet size={40} />
          <h2>성적통지표 파일을 선택하세요</h2>
          <p>학생 이름, 과목 점수, 과목 평균, 석차 정보를 자동으로 분리합니다.</p>
        </section>
      )}
    </main>
  );
}
