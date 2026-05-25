import { useCallback, useEffect, useRef, useState } from "react";
import { useAppRouter } from "@/lib/router";
import { AppImage as Image } from "@/components/app-image";
import { m } from "motion/react";

type CloudFlight = {
  scale: number;
  y: number;
};

type CloudBounds = {
  baseScale: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const DEFAULT_CLOUD_FLIGHT = {
  left: { scale: 5, y: 0 },
  right: { scale: 4, y: 0 },
};

// Bounds of the drawn cloud mass inside each source image. The assets include
// extra sky streaks, so the full image box cannot be used for viewport fitting.
const CLOUD_BOUNDS = {
  left: {
    baseScale: 5,
    top: 0.367,
    bottom: 0.86,
    left: 0.117,
    right: 0.889,
  },
  right: {
    baseScale: 4,
    top: 0.104,
    bottom: 0.878,
    left: 0.038,
    right: 0.94,
  },
};

function getCloudFlight(
  element: HTMLDivElement | null,
  bounds: CloudBounds,
  viewportWidth: number,
  viewportHeight: number,
): CloudFlight {
  const rect = element?.getBoundingClientRect();

  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { scale: bounds.baseScale, y: 0 };
  }

  const centerY = rect.top + rect.height / 2;
  const baseTop = centerY + bounds.baseScale * (bounds.top - 0.5) * rect.height;
  const baseBottom =
    centerY + bounds.baseScale * (bounds.bottom - 0.5) * rect.height;

  if (baseTop <= 0 && baseBottom >= viewportHeight) {
    return { scale: bounds.baseScale, y: 0 };
  }

  const visibleHeight = (bounds.bottom - bounds.top) * rect.height;
  const visibleWidth = (bounds.right - bounds.left) * rect.width;
  const scale = Math.max(
    bounds.baseScale,
    (viewportHeight / visibleHeight) * 1.08,
    (viewportWidth / visibleWidth) * 1.08,
  );
  const visibleCenterOffset =
    ((bounds.top + bounds.bottom) / 2 - 0.5) * rect.height;
  const y = viewportHeight / 2 - (centerY + scale * visibleCenterOffset);

  return { scale, y };
}

export default function HomeClient() {
  const router = useAppRouter();

  const [flying, setFlying] = useState(false);
  const [cloudFlight, setCloudFlight] = useState(DEFAULT_CLOUD_FLIGHT);
  const leftCloudRef = useRef<HTMLDivElement>(null);
  const rightCloudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    router.prefetch("/room");
  }, [router]);

  const updateCloudFlight = useCallback(() => {
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    setCloudFlight({
      left: getCloudFlight(
        leftCloudRef.current,
        CLOUD_BOUNDS.left,
        viewportWidth,
        viewportHeight,
      ),
      right: getCloudFlight(
        rightCloudRef.current,
        CLOUD_BOUNDS.right,
        viewportWidth,
        viewportHeight,
      ),
    });
  }, []);

  useEffect(() => {
    updateCloudFlight();
    const animationFrame = window.requestAnimationFrame(updateCloudFlight);
    const resizeObserver = new ResizeObserver(updateCloudFlight);
    const visualViewport = window.visualViewport;

    if (leftCloudRef.current) resizeObserver.observe(leftCloudRef.current);
    if (rightCloudRef.current) resizeObserver.observe(rightCloudRef.current);

    window.addEventListener("resize", updateCloudFlight);
    visualViewport?.addEventListener("resize", updateCloudFlight);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCloudFlight);
      visualViewport?.removeEventListener("resize", updateCloudFlight);
    };
  }, [updateCloudFlight]);

  async function handlePlayNow() {
    if (flying) return;
    setFlying(true);
    router.prefetch("/room");
    await new Promise((r) => setTimeout(r, 1800));
    router.push("/room");
  }

  const sceneStyle = {
    position: "absolute" as const,
    bottom: 0,
    left: "50%",
    x: "-50%",
    width: "max(100%, calc(100dvh * 16 / 9))",
    height: "max(100%, calc(100vw * 9 / 16))",
  };

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{
        height: "100dvh",
        minHeight: "100dvh",
        background:
          "linear-gradient(to bottom, #4a7fa5 0%, #a0bfd6 40%, #c8a87a 100%)",
      }}
    >
      <m.div
        animate={flying ? { y: "100dvh" } : { y: "0px" }}
        transition={flying ? { duration: 1.0, ease: [0.4, 0, 1, 1] } : {}}
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          x: "-50%",
          width: "max(100%, calc(100dvh * 16 / 9))",
          zIndex: 1,
        }}
      >
        <Image
          src="/landscape/landscape3-large.webp"
          alt=""
          width={1536}
          height={2612}
          style={{ display: "block", width: "100%", height: "auto" }}
          priority
        />
      </m.div>

      <m.div
        ref={leftCloudRef}
        style={{
          position: "absolute",
          bottom: "30%",
          left: "-30%",
          width: "100%",
          zIndex: 2,
        }}
        animate={
          flying
            ? {
                scale: cloudFlight.left.scale,
                x: "35vw",
                y: cloudFlight.left.y,
                filter: "blur(8px)",
              }
            : { scale: 1, x: "0px", y: 0, filter: "blur(0px)" }
        }
        transition={
          flying ? { duration: 1.8, delay: 0.3, ease: [0.2, 0, 0.6, 1] } : {}
        }
      >
        <Image
          src="/landscape/cloud1_nobg.webp"
          alt=""
          width={1536}
          height={1024}
          className={flying ? "" : "cloud-slow"}
        />
      </m.div>

      <m.div
        ref={rightCloudRef}
        style={{
          position: "absolute",
          bottom: "35%",
          right: "-12%",
          width: "50%",
          zIndex: 2,
        }}
        animate={
          flying
            ? {
                scale: cloudFlight.right.scale,
                x: "-30vw",
                y: cloudFlight.right.y,
                filter: "blur(6px)",
              }
            : { scale: 1, x: "0px", y: 0, filter: "blur(0px)" }
        }
        transition={
          flying ? { duration: 1.8, delay: 0.5, ease: [0.2, 0, 0.6, 1] } : {}
        }
      >
        <Image
          src="/landscape/cloud3_nobg.webp"
          alt=""
          width={1536}
          height={1024}
          className={flying ? "" : "cloud-fast"}
        />
      </m.div>

      <m.div
        animate={flying ? { y: "100dvh" } : { y: "0px" }}
        transition={flying ? { duration: 1.0, ease: [0.4, 0, 1, 1] } : {}}
        style={{ ...sceneStyle, zIndex: 3 }}
      >
        <Image
          src="/landscape/rocaizq2.webp"
          alt=""
          width={600}
          height={720}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "60%",
            zIndex: 6,
          }}
        />

        <Image
          src="/landscape/cactus1.webp"
          alt=""
          width={155}
          height={346}
          className="cactus-sway"
          style={{
            position: "absolute",
            bottom: "8%",
            left: "20%",
            height: "31%",
            zIndex: 5,
            animationDuration: "5.5s",
          }}
        />

        <Image
          src="/landscape/roca1.webp"
          alt=""
          width={600}
          height={400}
          style={{
            position: "absolute",
            bottom: "8%",
            left: "20%",
            zIndex: 4,
          }}
        />

        <Image
          src="/landscape/cactus5.webp"
          alt=""
          width={50}
          height={100}
          className="cactus-sway"
          style={{
            position: "absolute",
            bottom: "9%",
            left: "46%",
            zIndex: 5,
          }}
        />

        <Image
          src="/landscape/cactus3.webp"
          alt=""
          width={100}
          height={173}
          className="cactus-sway"
          style={{
            position: "absolute",
            bottom: "7%",
            right: "0%",
            height: "20%",
            zIndex: 4,
            animationDuration: "8s",
          }}
        />

        <Image
          src="/landscape/cactus3.webp"
          alt=""
          width={100}
          height={173}
          className="cactus"
          style={{
            position: "absolute",
            bottom: "8.2%",
            right: "31.2%",
            zIndex: 6,
          }}
        />

        <Image
          src="/landscape/roca2.webp"
          alt=""
          width={1280}
          height={719}
          style={{
            position: "absolute",
            bottom: "3.3%",
            right: "8%",
            width: "30%",
            zIndex: 5,
          }}
        />

        <Image
          src="/landscape/rightcactus.webp"
          alt=""
          width={579}
          height={677}
          className="cactus"
          style={{
            position: "absolute",
            bottom: "-5.5%",
            right: "-8%",
            height: "70%",
            zIndex: 6,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.15) 35%, transparent 60%)",
            zIndex: 7,
          }}
        />
      </m.div>

      <m.main
        animate={flying ? { opacity: 0, y: "40dvh" } : { opacity: 1, y: "0px" }}
        transition={flying ? { duration: 0.5, ease: "easeIn" } : {}}
        className="relative flex flex-col items-center justify-center min-h-dvh px-6 text-center"
        style={{ zIndex: 10, minHeight: "100dvh" }}
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <h1
            className="text-6xl leading-none font-bold tracking-wide text-amber-300 sm:tracking-widest md:text-7xl"
            style={{ textShadow: "2px 4px 12px rgba(0,0,0,0.8)" }}
          >
            BEANANZA
          </h1>
          <p className="text-lg text-amber-200/80 italic">The Unoficial Game</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-sm">
          <button
            onMouseEnter={() => router.prefetch("/room")}
            onClick={handlePlayNow}
            className="flex-1 rounded-xl 
						bg-amber-700 hover:bg-amber-600 active:bg-amber-800 
						border border-amber-700 
						text-white font-semibold text-lg 
						py-3 px-8 transition-colors cursor-pointer"
          >
            Play Now
          </button>
          <button
            onClick={() => router.push("/identify")}
            className="flex-1 rounded-xl border border-amber-600/60 hover:border-amber-400 text-amber-200 font-semibold text-lg py-3 px-8 transition-colors cursor-pointer"
          >
            Identify
          </button>
        </div>
      </m.main>
    </div>
  );
}
