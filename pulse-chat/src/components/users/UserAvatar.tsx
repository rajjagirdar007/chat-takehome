"use client";

import { getInitial } from "@/lib/utils";

interface UserAvatarProps {
  username: string;
  color: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "away" | "offline";
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

export function UserAvatar({
  username,
  color,
  size = "md",
  status,
}: UserAvatarProps) {
  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`flex items-center justify-center rounded-full font-semibold text-white ${sizeClasses[size]}`}
        style={{ backgroundColor: color }}
      >
        {getInitial(username)}
      </div>
      {status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-primary ${
            status === "online"
              ? "bg-online"
              : status === "away"
                ? "bg-away"
                : "bg-offline"
          }`}
        />
      )}
    </div>
  );
}
