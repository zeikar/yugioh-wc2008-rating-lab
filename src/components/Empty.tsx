import type { ReactNode } from 'react'

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-ink-2">{children}</p>
}
