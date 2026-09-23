export const PLAYER_ID = 'player'

export type TournamentLevel = 1 | 2 | 3
export type DuelistCategory = 'monster' | 'anime-character'

export const ROUNDS = ['quarterfinal', 'semifinal', 'final'] as const
export type Round = (typeof ROUNDS)[number]

export interface Duelist {
  id: string
  name: string
  /** Documented classification / unlock tier. Not an eligibility limit. */
  tournamentLevel: TournamentLevel
  initialRating: number | null
  unlocked: boolean
  category: DuelistCategory
  aliases?: string[]
  notes?: string
}

export interface Tournament {
  id: string
  number: number
  playedAt: Date
  tournamentLevel: TournamentLevel
  /** Seats 0–7 in bracket order: duelist id, PLAYER_ID, or null (unknown). */
  entrants: (string | null)[]
  title?: string
  notes?: string
  createdAt: Date
}

export interface Match {
  id: string
  tournamentId: string
  round: Round
  slot: number
  playerAId: string
  playerBId: string
  winnerId: string
  notes?: string
  createdAt: Date
}

export type ObservationSource = 'entered' | 'derived'

export interface RatingObservation {
  id: string
  duelistId: string
  rating: number
  observedAt: Date
  tournamentId?: string
  matchId?: string
  source: ObservationSource
  note?: string
  createdAt: Date
}

export interface Dataset {
  duelists: Duelist[]
  tournaments: Tournament[]
  matches: Match[]
  observations: RatingObservation[]
}
