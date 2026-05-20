import type { ImgHTMLAttributes } from "react";

type AppImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

export function AppImage({
  fill,
  priority,
  unoptimized: _unoptimized,
  style,
  loading,
  decoding,
  ...props
}: AppImageProps) {
  return (
    <img
      {...props}
      loading={priority ? "eager" : loading}
      decoding={priority ? "sync" : decoding}
      style={
        fill
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              ...style,
            }
          : style
      }
    />
  );
}
