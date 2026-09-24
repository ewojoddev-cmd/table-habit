import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { assetPath } from "@/lib/base-path";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TableHabit",
  description: "Group in a table, build a habit.",
  icons: {
    icon: assetPath("/favicon.png"),
    apple: assetPath("/logo-mark.png"),
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f4f7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
