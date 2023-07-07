import { ReactNode } from "react";

type IconHoverEffectProps = {
  children: ReactNode;
  red?: boolean;
};

export default function IconHoverEffect({
  children,
  red = false,
}: IconHoverEffectProps) {
  const colorClasess = red
    ? "outline-red-400 hover:bg-red-200 group-hover-bg-red-200 group-focus-visible:bg-red-200 focus-visible:bg-red-200"
    : "outline-gray-400 hover:bg-gray-200 group-hover-bg-gray-200 group-focus-visible:bg-gray-200 focus-visible:bg-gray-200";
  return (
    <div
      className={`rounded-full p-2 transition-colors duration-200 ${colorClasess}`}
    >
      {children}
    </div>
  );
}
