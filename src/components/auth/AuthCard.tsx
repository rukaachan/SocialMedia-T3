import type { PropsWithChildren } from "react";

type AuthCardProps = PropsWithChildren<{
  description: string;
  title: string;
}>;

export function AuthCard({ children, description, title }: AuthCardProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}
