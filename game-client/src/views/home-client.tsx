"use client";
import { useEffect, useState } from "react";
import { useAppRouter } from "@/lib/router";
import { AppImage as Image } from "@/components/app-image";
import { m } from "motion/react";

export default function HomeClient() {
  const router = useAppRouter();

  const [flying, setFlying] = useState(false);

  useEffect(() => {
    router.prefetch("/room");
  }, [router]);

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
    width: "max(100%, calc(100vh * 16 / 9))",
    height: "max(100%, calc(100vw * 9 / 16))",
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "linear-gradient(to bottom, #4a7fa5 0%, #a0bfd6 40%, #c8a87a 100%)",
      }}
    >
      <m.div
        animate={flying ? { y: "100vh" } : { y: "0px" }}
        transition={flying ? { duration: 1.0, ease: [0.4, 0, 1, 1] } : {}}
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          x: "-50%",
          width: "max(100%, calc(100vh * 16 / 9))",
          zIndex: 1,
        }}
      >
        <Image
          src="/landscape/landscape3.jpeg"
          alt=""
          width={1920}
          height={1080}
          style={{ display: "block", width: "100%", height: "auto" }}
          priority
        />
      </m.div>

      <m.div
        style={{
          position: "absolute",
          bottom: "30%",
          left: "-30%",
          width: "100%",
          zIndex: 2,
        }}
        animate={
          flying
            ? { scale: 5, x: "35vw", filter: "blur(8px)" }
            : { scale: 1, x: "0px", filter: "blur(0px)" }
        }
        transition={
          flying ? { duration: 1.8, delay: 0.3, ease: [0.2, 0, 0.6, 1] } : {}
        }
      >
        <Image
          src="/landscape/cloud1_nobg.png"
          alt=""
          width={1536}
          height={1024}
          className={flying ? "" : "cloud-slow"}
        />
      </m.div>

      <m.div
        style={{
          position: "absolute",
          bottom: "35%",
          right: "-12%",
          width: "50%",
          zIndex: 2,
        }}
        animate={
          flying
            ? { scale: 4, x: "-30vw", filter: "blur(6px)" }
            : { scale: 1, x: "0px", filter: "blur(0px)" }
        }
        transition={
          flying ? { duration: 1.8, delay: 0.5, ease: [0.2, 0, 0.6, 1] } : {}
        }
      >
        <Image
          src="/landscape/cloud3_nobg.png"
          alt=""
          width={1536}
          height={1024}
          className={flying ? "" : "cloud-fast"}
        />
      </m.div>

      <m.div
        animate={flying ? { y: "100vh" } : { y: "0px" }}
        transition={flying ? { duration: 1.0, ease: [0.4, 0, 1, 1] } : {}}
        style={{ ...sceneStyle, zIndex: 3 }}
      >
        <Image
          src="/landscape/rocaizq2.png"
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
          src="/landscape/cactus1.png"
          alt=""
          width={155}
          height={346}
          className="cactus-sway"
          style={{
            position: "absolute",
            bottom: "10%",
            left: "23%",
            height: "31%",
            zIndex: 5,
            animationDuration: "5.5s",
          }}
        />

        <Image
          src="/landscape/roca1.png"
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
          src="/landscape/cactus5.png"
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
          src="/landscape/cactus3.png"
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
          src="/landscape/cactus3.png"
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
          src="/landscape/roca2.png"
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
          src="/landscape/rightcactus.png"
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
        animate={flying ? { opacity: 0, y: "40vh" } : { opacity: 1, y: "0px" }}
        transition={flying ? { duration: 0.5, ease: "easeIn" } : {}}
        className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center"
        style={{ zIndex: 10 }}
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <h1
            className="text-7xl font-bold tracking-widest text-amber-300"
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
