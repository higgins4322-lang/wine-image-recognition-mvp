import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wine Scan MVP",
  description: "AI-assisted wine bottle recognition with user confirmation"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
