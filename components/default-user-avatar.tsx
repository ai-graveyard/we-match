import { UserRound } from "lucide-react";

export function DefaultUserAvatar({
  className = "",
  iconSize = 18,
}: {
  className?: string;
  iconSize?: number;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-sm bg-bg-3 text-gray ${className}`}
      aria-hidden
    >
      <UserRound size={iconSize} strokeWidth={1.75} />
    </div>
  );
}
