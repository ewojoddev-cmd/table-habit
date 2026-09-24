import Image from "next/image";
import { assetPath } from "@/lib/base-path";

type LogoProps = {
  /** Mark size in pixels. */
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

/**
 * Wordmark built from assets/Logo.png: the cropped, transparent mark
 * (public/logo-mark.png) plus the live "TableHabit" text.
 */
export default function Logo({
  size = 56,
  withWordmark = true,
  className = "",
}: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src={assetPath("/logo-mark.png")}
        alt="TableHabit"
        width={size}
        height={size}
        priority
        style={{ width: size, height: size }}
        className="select-none"
      />
      {withWordmark && (
        <span className="text-xl font-semibold tracking-tight text-th-prussian">
          TableHabit
        </span>
      )}
    </div>
  );
}
