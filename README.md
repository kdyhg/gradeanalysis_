# 담임 성적 메시지 스튜디오

나이스 성적통지표 엑셀 파일을 업로드해 학생별 과목 성적을 분석하고, 가정으로 보낼 개별/단체 메시지 초안을 생성하는 Next.js 앱입니다.

## 실행

```bash
npm install
npm run dev
```

`.env.local`에 다음 값을 넣으면 OpenAI API로 문안을 생성합니다.

```bash
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-5.4-mini
```

API 키가 없을 때는 앱이 로컬 규칙 기반 초안을 반환합니다.

## 개인정보

- 엑셀 파싱과 기본 분석은 브라우저에서 처리됩니다.
- AI 문안 생성 버튼을 누를 때 선택된 학생 요약 또는 학급 요약만 서버 API로 전송됩니다.
- 학생 성적 파일은 Git에 포함하지 않도록 `.gitignore`에 엑셀 확장자를 제외했습니다.

## 배포

Vercel에 배포한 뒤 프로젝트 환경 변수에 `OPENAI_API_KEY`와 `OPENAI_MODEL`을 등록하세요.
