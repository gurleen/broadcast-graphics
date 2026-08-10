import { Colors } from '#/graphics/colors'

export type BasketballScorebugTeam = {
  teamCode: string
  primaryColor: string
  score: number | string
}

export type BasketballScorebugProps = {
  home: BasketballScorebugTeam
  away: BasketballScorebugTeam
  clock: string
  period: string
  shotClock: number | string
  shotClockColor?: string
}

export const basketballScorebugDefaultProps: BasketballScorebugProps = {
  home: {
    teamCode: 'DREXEL',
    primaryColor: Colors.DrexelPrimary,
    score: 88,
  },
  away: {
    teamCode: 'DELAWARE',
    primaryColor: Colors.DrexelSecondary,
    score: 88,
  },
  clock: '10:36',
  period: '2ND',
  shotClock: 24,
  shotClockColor: Colors.DrexelSecondary,
}
