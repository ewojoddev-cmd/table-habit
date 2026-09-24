import { initialsFor } from "@/lib/habits";

type MemberAvatarProps = {
  name: string;
  color: string;
  /** Diameter in pixels. */
  size?: number;
  className?: string;
};

/**
 * A plain circular avatar: one solid colour per member (no photos yet) with
 * their initials, so rows stay readable and scannable.
 */
export default function MemberAvatar({
  name,
  color,
  size = 38,
  className = "",
}: MemberAvatarProps) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(11, Math.round(size / 2.6)),
      }}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  );
}
