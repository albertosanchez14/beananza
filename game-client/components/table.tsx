import { ReactNode, useEffect, useRef, useState } from "react";

const DESIGN_W = 1280;
const DESIGN_H = 720;

type TableProps = {
  children: ReactNode;
};

export default function Table({ children }: TableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / DESIGN_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ perspective: "900px" }}
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: DESIGN_W,
          aspectRatio: "16/9",
          zIndex: 1,
        }}
      >
        <img
          src="/tablenobg2.webp"
          alt=""
          style={{ display: "block", width: "100%", height: "100%" }}
        />

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: DESIGN_W,
            height: DESIGN_H,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
