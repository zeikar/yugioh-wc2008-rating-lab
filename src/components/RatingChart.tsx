import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type DotProps } from 'recharts'

export interface ChartPoint {
  x: number
  rating: number
  /** Lines shown in the tooltip under the rating. */
  details: string[]
}

const INK = '#2b54c8'
const SURFACE = '#ffffff'

function Dot(props: DotProps) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  // A surface ring keeps neighbouring dots apart.
  return <circle cx={cx} cy={cy} r={4.5} fill={INK} stroke={SURFACE} strokeWidth={2} />
}

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="panel px-3 py-2 text-sm shadow-md">
      <p className="font-display text-base font-bold">
        <span className="text-gold">▼</span> {p.rating}
      </p>
      {p.details.map((d) => (
        <p key={d} className="text-ink-2">
          {d}
        </p>
      ))}
    </div>
  )
}

/** One CPU's rating over the timeline. Single series, so no legend: the page title names it. */
export function RatingChart({ points }: { points: ChartPoint[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Rating history chart; the table below lists the same values">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e7ebf0" vertical={false} />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} hide />
          <YAxis domain={['auto', 'auto']} width={48} tick={{ fill: '#7d8a9a', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipBody />} cursor={{ stroke: '#c5ccd6', strokeWidth: 1 }} isAnimationActive={false} />
          <Line dataKey="rating" stroke={INK} strokeWidth={2} dot={<Dot />} activeDot={{ r: 6, fill: INK, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
