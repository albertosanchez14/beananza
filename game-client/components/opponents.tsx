import { Children, ReactNode } from "react";

type OpponetsProps = {
  children: ReactNode;
};

function Opponets({ children }: OpponetsProps) {
  const items = Children.toArray(children);

  const getPlayerPosition = (index: number, total: number) => {
    const centerDeg = 90;
    const maxSpread = 160;
    const spread = total <= 1 ? 0 : Math.min(maxSpread, (total - 1) * 50);
    const step = total > 1 ? spread / (total - 1) : 0;
    const angle =
      total === 1 ? centerDeg : centerDeg + spread / 2 - step * index;
    const angleRad = (angle * Math.PI) / 180;

    const rx = 36;
    const ry = 26;
    const cx = 50;
    const cy = 50;

    const x = cx + rx * Math.cos(angleRad);
    const y = cy - ry * Math.sin(angleRad);

    return { left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" };
  };

  return (
    <div>
      {items.map((child, index) => {
        const position = getPlayerPosition(index, items.length);
        return (
          <div
            key={index}
            className="absolute"
            style={{ ...position, zIndex: 10 }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}

export default Opponets;
