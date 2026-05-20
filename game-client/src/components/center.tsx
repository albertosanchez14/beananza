import { ReactNode } from "react";

type CenterProps = {
  children: ReactNode;
};

function Center({ children }: CenterProps) {
  return (
    <div
      className="absolute"
      style={{
        top: "45%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10,
        perspective: "700px",
      }}
    >
      <div
        className="flex items-end gap-6"
        style={{
          transform: "rotateX(25deg) scaleX(1.08)",
          transformOrigin: "bottom center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default Center;
