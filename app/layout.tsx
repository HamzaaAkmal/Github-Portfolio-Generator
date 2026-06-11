import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gitfolio Studio",
  description: "Turn a GitHub profile and resume into a polished portfolio."
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
