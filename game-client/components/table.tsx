import { ReactNode } from "react";

type TableProps = {
  children: ReactNode;
};

export default function Table({ children }: TableProps) {
  return (
    <>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "900px" }}
      >
        <div
          className="absolute"
          style={{
            width: "82%",
            height: "72%",
            borderRadius: "50%",
            background: "#1e5c35",
            border: "14px solid #5c3311",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.85), inset 0 2px 12px rgba(255,255,255,0.06)",
            transform: "rotateX(28deg)",
            transformOrigin: "center center",
          }}
        />
      </div>
      {children}
    </>
  );
}
