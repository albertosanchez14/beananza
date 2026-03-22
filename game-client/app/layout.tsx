import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const bohnanzaFont = localFont({
  src: "../public/fonts/bonanza.ttf",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Beananza",
  description: "The bean trading card game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={bohnanzaFont.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
