import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mepandes Dinda Diana Danta",
  description:
    "Undangan mepandes interaktif dengan halaman surat pembuka, countdown realtime, nama-nama yang mepandes, RSVP, dan ucapan terima kasih.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
