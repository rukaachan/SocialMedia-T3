import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

// type
type ButtonProps = {
  small?: boolean;
  gray?: boolean;
  className?: string;
} & DetailedHTMLProps<
  // to get Attributtes for button
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

export default function Button({
  // some props for custom in Button
  small,
  gray,
  className = "", // fr can make it style more in Button
  ...props
}: ButtonProps) {
  const sizeClasess = small ? "px-2 py-1" : "px-4 py-2 font-bold";
  const colorClassses = gray
    ? "bg-gray-400 hover:bg-gray-300 focus-visible:bg-gray-300"
    : "bg-blue-500 hover:bg-blue-400 focus-visible:bg-blue-400";

  return (
    <button
      className={`rounded-full text-white transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasess} ${colorClassses} ${className}`}
      {...props}
    ></button>
  );
}
