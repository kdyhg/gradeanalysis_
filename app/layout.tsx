import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "담임 성적 메시지 스튜디오",
  description: "나이스 성적통지표 분석 및 가정 메시지 생성 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
