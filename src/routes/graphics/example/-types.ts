export type ScorebugTeam = {
  /** Short code shown stacked vertically in the end cap, e.g. `'DRE'`. */
  abbr: string
  score: number | string
  /** Record line shown in the footer, e.g. `'16-4  (2ND IN CAA)'`. */
  record: string
  logo: string
}

export type ExampleGraphicProps = {
  away?: ScorebugTeam
  home?: ScorebugTeam
  /** Game clock, pre-formatted. */
  clock?: string
  period?: string
  shotClock?: number | string
  /** Centered footer wordmark. */
  title?: string
}
