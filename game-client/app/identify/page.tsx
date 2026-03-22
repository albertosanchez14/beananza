import { Suspense } from "react";
import type { Metadata } from "next";
import { IdentifyForm } from "./form";

export const metadata: Metadata = {
  title: "Beananza — Identify",
  description: "Set your player name before joining a game",
};

export default function IdentifyPage() {
  return (
    <Suspense fallback={null}>
      <IdentifyForm />
    </Suspense>
  );
}
