import type { ComponentType, SVGProps } from "react";
import Link from "next/link";

const TONES = {
  pink: "bg-brand-pink/10 text-brand-pink-dark",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  neutral: "bg-gray-100 text-gray-700",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "pink",
  href,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const content = (
    <>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONES[tone]}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="mt-3 text-2xl font-bold text-brand-ink">{value}</p>
      <p className="text-xs font-medium text-brand-muted">{label}</p>
      {hint && <p className="mt-1 text-xs text-brand-muted">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-black/10 bg-white p-5 transition-colors hover:border-brand-pink/40 hover:shadow-sm"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-xl border border-black/10 bg-white p-5">{content}</div>;
}
