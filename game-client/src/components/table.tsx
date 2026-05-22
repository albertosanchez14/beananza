import { ReactNode, useEffect, useRef, useState } from "react";
import { AppImage as Image } from "@/components/app-image";

const DESIGN_W = 1280;
const DESIGN_H = 720;

type TableProps = {
  children: ReactNode;
  onScaleChange?: (scale: number) => void;
  narrow?: boolean;
  paddingTop?: number;
};

export default function Table({
  children,
  onScaleChange,
  narrow,
  paddingTop,
}: TableProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState(DESIGN_W);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: outerW, height: outerH } = entry.contentRect;
      const maxWFromH = outerH * (DESIGN_W / DESIGN_H);
      const constrainedW = Math.min(outerW, maxWFromH, DESIGN_W);
      setWidth(constrainedW);
      const next = constrainedW / DESIGN_W;
      setScale(next);
      onScaleChange?.(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onScaleChange]);

  const useTopAlign = narrow !== undefined && narrow;

  return (
    <div
      ref={outerRef}
      className={`absolute inset-0 flex ${useTopAlign ? "items-start" : "items-center"} justify-center`}
      style={{
        perspective: "900px",
        paddingTop: useTopAlign ? (paddingTop ?? 16) : 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width,
          maxWidth: DESIGN_W,
          aspectRatio: "16/9",
          zIndex: 1,
        }}
      >
        <Image
          src="/tablenobg2.webp"
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: "fill" }}
          priority
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
