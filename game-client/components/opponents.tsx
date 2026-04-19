import { Children, cloneElement, isValidElement, ReactNode } from "react";

// Calibrated from SVG debug ellipses (viewBox 1280×853, container 16:9)
// Formula: val_x / 1280 * 100,  val_y / 853 * 100
const CX = (640 / 1280) * 100; // 50.00  — red ellipse cx
const CY = (430 / 853) * 100; // 50.41  — red ellipse cy
const RX = (635 / 1280) * 100; // 49.61  — red ellipse rx
const RY = (425 / 853) * 100; // 49.82  — red ellipse ry

const FCX = (640 / 1280) * 100; // 50.00  — green ellipse cx
const FCY = (400 / 853) * 100; // 46.89  — green ellipse cy
const FX = (460 / 1280) * 100; // 35.94  — green ellipse rx
const FY = (290 / 853) * 100; // 34.00  — green ellipse ry

type OpponentsProps = {
  children: ReactNode;
};

export function getFieldRotation(index: number, total: number): number {
  const totalSeats = total + 1;
  const angle = 270 + (index + 1) * (360 / totalSeats);
  return 270 - angle;
}

function getPosition(index: number, total: number) {
  const totalSeats = total + 1;
  const angle = 270 + (index + 1) * (360 / totalSeats);
  const rad = (angle * Math.PI) / 180;
  const fieldRotation = 270 - angle;

  // Field center on green ellipse
  const fx = FCX + FX * Math.cos(rad);
  const fy = FCY - FY * Math.sin(rad);

  // Outward normal to green ellipse at (fx, fy) in %-coord space (y increases downward)
  // Gradient of ((x-FCX)/FX)^2 + ((y-FCY)/FY)^2: (cos/FX, -sin/FY)
  const ndx = Math.cos(rad) / FX;
  const ndy = -Math.sin(rad) / FY;

  // Find intersection of ray (fx + t*ndx, fy + t*ndy) with red ellipse
  const ax = (fx - CX) / RX;
  const bx = ndx / RX;
  const ay = (fy - CY) / RY;
  const by = ndy / RY;

  const A = bx * bx + by * by;
  const B = 2 * (ax * bx + ay * by);
  const C = ax * ax + ay * ay - 1;

  const disc = Math.max(0, B * B - 4 * A * C);
  const sqrtDisc = Math.sqrt(disc);
  // Field is inside red ellipse → one positive t (outward) and one negative
  const t = Math.max((-B + sqrtDisc) / (2 * A), (-B - sqrtDisc) / (2 * A));

  return {
    avatarLeft: `${fx + t * ndx}%`,
    avatarTop: `${fy + t * ndy}%`,
    fieldLeft: `${fx}%`,
    fieldTop: `${fy}%`,
    fieldRotation,
  };
}

function Opponents({ children }: OpponentsProps) {
  const items = Children.toArray(children);

  return (
    <>
      {items.map((child, index) => {
        const { avatarLeft, avatarTop, fieldLeft, fieldTop, fieldRotation } =
          getPosition(index, items.length);

        const childProps = isValidElement(child)
          ? (child.props as Record<string, unknown>)
          : null;

        const fieldEl = childProps?.field as ReactNode;
        const tradedCardsAreaEl = childProps?.tradedCardsArea as ReactNode;

        // Render avatar-only child (field and tradedCardsArea stripped out)
        const avatarChild = isValidElement(child)
          ? cloneElement(child as React.ReactElement<Record<string, unknown>>, {
              field: null,
              tradedCardsArea: null,
              fieldRotation,
            })
          : child;

        const fieldTransform = `translate(-50%, -50%) scaleY(${Math.cos((25 * Math.PI) / 180).toFixed(4)}) rotate(${fieldRotation}deg) scale(0.8)`;

        return (
          <div key={index}>
            {/* Field + tradedCardsArea at green ellipse, same perspective transform */}
            {(fieldEl || tradedCardsAreaEl) && (
              <div
                className="absolute flex flex-col items-center gap-2"
                style={{
                  left: fieldLeft,
                  top: fieldTop,
                  transform: fieldTransform,
                  zIndex: 9,
                }}
              >
                {tradedCardsAreaEl}
                {fieldEl}
              </div>
            )}

            {/* Avatar at red ellipse, in front of field */}
            <div
              className="absolute"
              style={{
                left: avatarLeft,
                top: avatarTop,
                transform: "translate(-50%, -50%)",
                zIndex: 10,
              }}
            >
              {avatarChild}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default Opponents;
