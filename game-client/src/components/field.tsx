import { ReactNode } from "react";

type NewFieldProps = {
  children: ReactNode;
};

export default function Field({ children }: NewFieldProps) {
  return (
    <div className="relative flex gap-2 px-0 py-0 rounded">
      <div className="absolute inset-0 rounded pointer-events-none" />
      {children}
    </div>
  );
}
