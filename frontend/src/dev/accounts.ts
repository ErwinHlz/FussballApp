/**
 * Test accounts of the local development data (`npm run seed:dev`). Shared by the seed script
 * and the debug account switcher; only used in development builds. No real personal data.
 */
export const DEV_PASSWORD = 'rondo-dev-1234'

export type DevTeam = 'U17' | 'Damen'
export type DevRole = 'admin' | 'coach' | 'player'

export type DevAccount = {
  email: string
  name: string
  role: DevRole
  /** Team of coaches and players; the admin only runs the club. */
  team: DevTeam | null
  shirtNumber?: number
  positions?: string[]
}

const player = (
  key: string,
  name: string,
  team: DevTeam,
  shirtNumber: number,
  positions: string[],
): DevAccount => ({
  email: `${key}@rondo.test`,
  name,
  role: 'player',
  team,
  shirtNumber,
  positions,
})

export const DEV_ACCOUNTS: DevAccount[] = [
  { email: 'vorstand@rondo.test', name: 'Vera Vorstand', role: 'admin', team: null },
  { email: 'trainer.u17@rondo.test', name: 'Tom Trainer', role: 'coach', team: 'U17' },
  { email: 'trainerin.damen@rondo.test', name: 'Tina Trainerin', role: 'coach', team: 'Damen' },

  player('jonas', 'Jonas Keller', 'U17', 1, ['GK']),
  player('luca', 'Luca Brandt', 'U17', 2, ['DF']),
  player('noah', 'Noah Fischer', 'U17', 3, ['DF']),
  player('elias', 'Elias Wagner', 'U17', 4, ['DF']),
  player('mats', 'Mats Becker', 'U17', 5, ['DF']),
  player('finn', 'Finn Hoffmann', 'U17', 6, ['MF']),
  player('leon', 'Leon Schäfer', 'U17', 7, ['MF', 'FW']),
  player('ben', 'Ben Koch', 'U17', 8, ['MF']),
  player('paul', 'Paul Richter', 'U17', 9, ['FW']),
  player('emil', 'Emil Wolf', 'U17', 10, ['MF']),
  player('anton', 'Anton Neumann', 'U17', 11, ['FW']),
  player('karim', 'Karim Aydin', 'U17', 13, ['DF', 'MF']),
  player('milan', 'Milan Kovač', 'U17', 14, ['MF']),
  player('theo', 'Theo Schulz', 'U17', 17, ['FW']),
  player('david', 'David Lange', 'U17', 21, ['GK']),

  player('lena', 'Lena Krüger', 'Damen', 1, ['GK']),
  player('mia', 'Mia Hartmann', 'Damen', 4, ['DF']),
  player('sophie', 'Sophie Weber', 'Damen', 6, ['MF']),
  player('hannah', 'Hannah Braun', 'Damen', 8, ['MF']),
  player('emma', 'Emma Zimmermann', 'Damen', 9, ['FW']),
  player('clara', 'Clara Schmitt', 'Damen', 10, ['MF', 'FW']),
]
