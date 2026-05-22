import { motion } from "motion/react";
import { Fragment } from "react/jsx-runtime";
import { ArrowRight } from "lucide-react";

type Prop = {
  pathStr: string;
  color: string;
  opacity: number;
};

const ARROW_SPEED_PX_S = 300;
const ARROW_MIN_ARC_PX = 300;
const NUM_ARROWS = 3;

function svgPathLength(d: string): number {
  if (typeof document === "undefined") return 400;
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  return el.getTotalLength();
}

export default function Arrow({ pathStr, color, opacity }: Prop) {
  const duration =
    Math.max(svgPathLength(pathStr), ARROW_MIN_ARC_PX) / ARROW_SPEED_PX_S;

  return (
    <Fragment>
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 20,
          overflow: "visible",
          opacity,
          transition: "opacity 300ms ease",
        }}
      >
        <path
          d={pathStr}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeOpacity={1}
          strokeDasharray="6 5"
        />
      </svg>
      {Array.from({ length: NUM_ARROWS }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 21,
            offsetPath: `path("${pathStr}")`,
            offsetRotate: "auto",
            offsetAnchor: "50% 50%",
            opacity,
            transition: "opacity 300ms ease",
          }}
          animate={{ offsetDistance: ["0%", "100%"] }}
          transition={{
            duration,
            repeat: Infinity,
            ease: "linear",
            delay: -(i * (duration / 3)),
          }}
        >
          <ArrowRight size={22} color={color} strokeWidth={2.5} />
        </motion.div>
      ))}
    </Fragment>
  );
}
