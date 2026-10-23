import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { APPLE_TOUCH_ICON, PWA_METADATA } from "@/lib/pwa";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...PWA_METADATA,
  title: "BounceLab",
  icons: { apple: APPLE_TOUCH_ICON },
  description:
    "A 2D physics playground. Bounce balls and tweak friction and gravity in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="/ball-bounce/favicon.svg"
          type="image/svg+xml"
        ></link>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
