import { Link } from 'react-router'
import { useApp } from '../app/context'
import { isCpu } from '../domain/bracket'
import { displayName } from '../domain/stats'

export function DuelistLink({ id }: { id: string | null | undefined }) {
  const { model } = useApp()
  if (!isCpu(id)) return <span className="font-semibold">{displayName(model, id)}</span>
  return (
    <Link to={`/duelists/${id}`} className="hover:text-accent hover:underline">
      {displayName(model, id)}
    </Link>
  )
}
