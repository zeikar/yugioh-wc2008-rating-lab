import type { Duelist } from '../types'

// One file per duelist id, from Yugipedia (docs/domain/roster.md §6).
const PORTRAITS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/portraits/*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.webp'.length),
    url,
  ]),
)

/** Only this card is published for Bastion, and it isn't his tournament self. */
const CARD_NOTES: Record<string, string> = {
  'bastion-misawa': 'This is the downloadable ghost’s card, so its deck and rating differ.',
}

/** The opponent card as the DS shows it (256×192): art, deck, rating when captured, stat pentagon. */
export function PortraitCard({ duelist }: { duelist: Duelist }) {
  const url = PORTRAITS[duelist.id]
  if (!url) return null
  const note = CARD_NOTES[duelist.id]
  return (
    <figure className="w-[258px] shrink-0 self-start">
      <img
        src={url}
        width={256}
        height={192}
        alt={`${duelist.name}'s opponent card in the game`}
        // box-content keeps the image at its native 256×192 inside the border, so pixels stay crisp.
        className="box-content rounded-lg border border-rule [image-rendering:pixelated]"
      />
      {note && <figcaption className="mt-1 text-xs text-ink-3">{note}</figcaption>}
    </figure>
  )
}

/** How far down the art to start the avatar crop, in card pixels, where the default shows mostly frame. */
const CROP_Y: Record<string, number> = {
  'kozaky': 20,
  'marcel-bonaparte': 40,
  'reaper-on-the-nightmare': 20,
  'sabersaurus': 40,
  'watapon': 40,
  'woodborg-inpachi': 20,
}

/** A round crop of the card's art, a 112 px square at its left edge. */
export function Avatar({ duelist, className }: { duelist: Duelist; className: string }) {
  const url = PORTRAITS[duelist.id]
  return (
    <span aria-hidden className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft ${className}`}>
      {url ? (
        <img src={url} alt="" loading="lazy" className="absolute left-0 w-[228.6%] max-w-none" style={{ top: `${-(CROP_Y[duelist.id] ?? 0) / 1.12}%` }} />
      ) : (
        <span className="text-xs font-semibold text-accent">{duelist.name[0]}</span>
      )}
    </span>
  )
}
