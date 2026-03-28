import { Suspense } from "react";
import type { Metadata } from "next";
import { IdentifyForm } from "./form";

export const metadata: Metadata = {
  title: "Beananza — Identify",
  description: "Set your player name before joining a game",
};

export default function IdentifyPage() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden"
      style={{
        backgroundImage: "url('/fields/field6.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "bottom",
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <Suspense fallback={null}>
        <IdentifyForm />
      </Suspense>
    </div>
  );
}
