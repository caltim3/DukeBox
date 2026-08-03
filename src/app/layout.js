import { Geist, Geist_Mono } from "next/font/google";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "The DukeBox",
  description: "The Duke Box",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <KeyboardShortcuts />
      </body>
    </html>
  );
}
