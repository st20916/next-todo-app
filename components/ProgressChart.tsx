"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ChartDatum {
  name: string;
  percent: number;
}

const tick = { fontSize: 12, fill: "var(--muted)" };

/** Bar chart of progress percentages with an accessible text fallback. */
export function ProgressChart({ title, data }: { title: string; data: ChartDatum[] }) {
  if (data.length === 0) return null;
  return (
    <figure className="rounded-2xl border border-line bg-surface p-5">
      <figcaption className="mb-1 text-xl font-medium">{title}</figcaption>
      <p className="mb-4 text-xs text-muted">완료한 할 일 ÷ 전체 할 일</p>
      <div className="h-56" role="img" aria-label={`${title}: ${data.map((d) => `${d.name} ${d.percent}%`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={tick} interval={0} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} unit="%" tick={tick} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "var(--primary-soft)", opacity: 0.5 }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg)" }}
              formatter={(v) => [`${v}%`, "진행률"]}
            />
            <Bar dataKey="percent" fill="#606bdf" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
