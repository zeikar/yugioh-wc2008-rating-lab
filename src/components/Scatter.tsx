import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter as RScatter, ScatterChart, Tooltip, XAxis, YAxis, type DotProps } from 'recharts'

export interface ScatterPoint {
  x: number
  y: number
  label: string
  details: string[]
}

const INK = '#2b54c8'
const SURFACE = '#ffffff'

function Dot(props: DotProps) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return <circle cx={cx} cy={cy} r={5} fill={INK} fillOpacity={0.85} stroke={SURFACE} strokeWidth={2} />
}

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="panel max-w-72 px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{p.label}</p>
      {p.details.map((d) => (
        <p key={d} className="text-ink-2">
          {d}
        </p>
      ))}
    </div>
  )
}

interface Props {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  /** A vertical reference at this x (e.g. gap 0). */
  xRef?: number
  /** Draw y = x across the plot. */
  diagonal?: boolean
  ariaLabel: string
}

/** Single-series scatter; the section heading names the series, so no legend. */
export function Scatter({ points, xLabel, yLabel, xRef, diagonal, ariaLabel }: Props) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  // Pad the shared diagonal domain so dots on the extremes aren't cut in half.
  const pad = 50
  const lo = Math.min(...xs, ...(diagonal ? ys : [])) - pad
  const hi = Math.max(...xs, ...(diagonal ? ys : [])) + pad
  return (
    <div className="h-80 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid stroke="#e7ebf0" />
          <XAxis
            dataKey="x"
            type="number"
            domain={diagonal ? [lo, hi] : ['auto', 'auto']}
            name={xLabel}
            tick={{ fill: '#7d8a9a', fontSize: 12 }}
            label={{ value: xLabel, position: 'insideBottom', offset: -14, fill: '#4e5b6b', fontSize: 12 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={diagonal ? [lo, hi] : ['auto', 'auto']}
            name={yLabel}
            width={52}
            tick={{ fill: '#7d8a9a', fontSize: 12 }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#4e5b6b', fontSize: 12, style: { textAnchor: 'middle' } }}
          />
          {xRef !== undefined && <ReferenceLine x={xRef} stroke="#b8c1cc" strokeDasharray="4 4" />}
          {diagonal && points.length > 0 && (
            <ReferenceLine
              segment={[
                { x: lo, y: lo },
                { x: hi, y: hi },
              ]}
              stroke="#b8c1cc"
              strokeDasharray="4 4"
            />
          )}
          <Tooltip content={<TooltipBody />} cursor={false} isAnimationActive={false} />
          <RScatter data={points} shape={<Dot />} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
