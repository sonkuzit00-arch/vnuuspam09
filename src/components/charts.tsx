// Лёгкие inline-SVG графики без внешних библиотек — по гайду dataviz:
// тонкие марки, 4px скругление у верхнего края (не у базовой линии),
// 2px зазор между столбцами, ink на осях/подписях, палитра из
// references/palette.md заведена как CSS-переменные в globals.css.

const CHART_FONT = "10px var(--font-sans, ui-sans-serif)";

/** Столбец с скруглением только у "дальнего" от базовой линии края. */
function Bar({
  x,
  y,
  width,
  height,
  fill,
  radius = 3,
  title,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  radius?: number;
  title?: string;
}) {
  if (height <= 0) return null;
  const r = Math.min(radius, width / 2, height);
  return (
    <g>
      {title && <title>{title}</title>}
      <rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={fill} />
      {height > r && <rect x={x} y={y + height - r} width={width} height={r} fill={fill} />}
    </g>
  );
}

/** Динамика поступления обращений по дням — один ряд, магнитуда во времени. */
export function DailyVolumeChart({ data }: { data: { label: string; count: number }[] }) {
  const width = 640;
  const height = 160;
  const padLeft = 28;
  const padBottom = 22;
  const padTop = 12;
  const plotW = width - padLeft - 8;
  const plotH = height - padTop - padBottom;
  const max = Math.max(1, ...data.map((d) => d.count));
  const gap = 3;
  const barW = data.length > 0 ? Math.max(2, plotW / data.length - gap) : 0;

  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Обращений в день">
      {ticks.map((t) => {
        const ty = padTop + plotH - (t / max) * plotH;
        return (
          <g key={`tick-${t}`}>
            <line x1={padLeft} x2={width - 4} y1={ty} y2={ty} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padLeft - 6} y={ty + 3} textAnchor="end" fontSize={9} fill="var(--muted)" style={{ font: CHART_FONT }}>
              {t}
            </text>
          </g>
        );
      })}
      <line
        x1={padLeft}
        x2={padLeft}
        y1={padTop}
        y2={padTop + plotH}
        stroke="var(--chart-axis)"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const barH = (d.count / max) * plotH;
        const x = padLeft + i * (barW + gap);
        const y = padTop + plotH - barH;
        const showLabel = data.length <= 16 || i % Math.ceil(data.length / 16) === 0;
        return (
          <g key={d.label}>
            <Bar x={x} y={y} width={barW} height={barH} fill="var(--chart-1)" title={`${d.label}: ${d.count}`} />
            {showLabel && (
              <text
                x={x + barW / 2}
                y={height - padBottom + 12}
                textAnchor="middle"
                fontSize={8.5}
                fill="var(--muted)"
                style={{ font: CHART_FONT }}
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Срез результатов по каждому сотруднику — горизонтальный стек статусов
 * (решено/в работе/просрочено). Статус — не идентичность, поэтому цвета
 * из status-палитры, а не категориальной.
 */
export function PersonResultsChart({
  data,
}: {
  data: { name: string; resolved: number; inProgress: number; overdue: number }[];
}) {
  const rows = data.filter((d) => d.resolved + d.inProgress + d.overdue > 0);
  const max = Math.max(1, ...rows.map((d) => d.resolved + d.inProgress + d.overdue));
  const rowH = 22;
  const gap = 10;
  const width = 640;
  const labelW = 140;
  const plotW = width - labelW - 40;
  const height = rows.length * (rowH + gap) + gap;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Результаты по сотрудникам">
      {rows.map((d, i) => {
        const total = d.resolved + d.inProgress + d.overdue;
        const y = gap + i * (rowH + gap);
        const scale = plotW / max;
        let cx = labelW;
        const segments: { key: string; value: number; fill: string; label: string }[] = [
          { key: "resolved", value: d.resolved, fill: "var(--chart-good)", label: "решено" },
          { key: "inProgress", value: d.inProgress, fill: "var(--muted)", label: "в работе" },
          { key: "overdue", value: d.overdue, fill: "var(--chart-critical)", label: "просрочено" },
        ];
        return (
          <g key={d.name}>
            <text x={labelW - 10} y={y + rowH / 2 + 3.5} textAnchor="end" fontSize={10} fill="var(--foreground)" style={{ font: CHART_FONT }}>
              {d.name.split(" ").slice(0, 2).join(" ")}
            </text>
            {segments.map((s, si) => {
              const w = s.value * scale;
              const seg = (
                <Bar
                  key={s.key}
                  x={cx + (si > 0 ? 2 : 0)}
                  y={y}
                  width={Math.max(0, w - (si > 0 ? 2 : 0))}
                  height={rowH}
                  fill={s.fill}
                  radius={4}
                  title={`${d.name} · ${s.label}: ${s.value}`}
                />
              );
              cx += w;
              return seg;
            })}
            <text x={labelW + total * scale + 6} y={y + rowH / 2 + 3.5} fontSize={10} fill="var(--muted)" style={{ font: CHART_FONT }}>
              {total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Разбивка по группам каналов (ГД объединяет все подканалы) — идентичность, категориальная палитра. */
export function ChannelGroupChart({ data }: { data: { group: string; count: number }[] }) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  const width = 640;
  const height = 150;
  const padLeft = 8;
  const padBottom = 30;
  const padTop = 22;
  const plotH = height - padTop - padBottom;
  const max = Math.max(1, ...data.map((d) => d.count));
  const gap = 16;
  const barW = data.length > 0 ? Math.min(64, (width - padLeft * 2 - gap * (data.length - 1)) / data.length) : 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Обращения по группам каналов">
      <line x1={padLeft} x2={width - padLeft} y1={padTop + plotH} y2={padTop + plotH} stroke="var(--chart-axis)" strokeWidth={1} />
      {data.map((d, i) => {
        const barH = (d.count / max) * plotH;
        const x = padLeft + i * (barW + gap);
        const y = padTop + plotH - barH;
        return (
          <g key={d.group}>
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)" style={{ font: CHART_FONT }}>
              {d.count}
            </text>
            <Bar x={x} y={y} width={barW} height={barH} fill={palette[i % palette.length]} title={`${d.group}: ${d.count}`} />
            <text
              x={x + barW / 2}
              y={height - padBottom + 14}
              textAnchor="middle"
              fontSize={9.5}
              fill="var(--muted)"
              style={{ font: CHART_FONT }}
            >
              {d.group}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
