"use client";

import { ReactNode } from "react";

type NewFieldProps = {
  children: ReactNode;
};

export default function NewField({ children }: NewFieldProps) {
  return (
    <div
      className="relative flex gap-2 px-4 py-3
                 bg-green-800 border-2 border-green-900 rounded-lg"
    >
      {children}
    </div>
  );
}
