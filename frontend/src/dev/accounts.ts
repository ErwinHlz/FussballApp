/**
 * Test accounts of the local development data (`npm run seed:dev`). Shared by the seed script
 * and the debug account switcher; only used in development builds. No real personal data.
 */
export const DEV_PASSWORD = 'rondo-dev-1234'

/** Dev clubs and their teams, in the order the switcher shows them. */
export const DEV_CLUBS = {
  'SV Rondo 1920': ['U17', 'Damen'],
  'SV Ottweiler': [
    'SV Ottweiler 1',
    'SV Ottweiler 2',
    'A-Jugend (U19)',
    'C-Jugend (U15)',
    'E-Jugend (U11)',
    'Alte Herren',
  ],
} as const

export type DevClub = keyof typeof DEV_CLUBS
export type DevTeam = (typeof DEV_CLUBS)[DevClub][number]
export type DevRole = 'admin' | 'coach' | 'player'

export type DevAccount = {
  email: string
  name: string
  role: DevRole
  club: DevClub
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
  club: DevClub = 'SV Rondo 1920',
): DevAccount => ({
  email: `${key}@rondo.test`,
  name,
  role: 'player',
  club,
  team,
  shirtNumber,
  positions,
})

const coach = (key: string, name: string, team: DevTeam, club: DevClub): DevAccount => ({
  email: `${key}@rondo.test`,
  name,
  role: 'coach',
  club,
  team,
})

export const DEV_ACCOUNTS: DevAccount[] = [
  {
    email: 'vorstand@rondo.test',
    name: 'Vera Vorstand',
    role: 'admin',
    club: 'SV Rondo 1920',
    team: null,
  },
  coach('trainer.u17', 'Tom Trainer', 'U17', 'SV Rondo 1920'),
  coach('trainerin.damen', 'Tina Trainerin', 'Damen', 'SV Rondo 1920'),

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

  {
    email: 'vorstand.ottweiler@rondo.test',
    name: 'Olaf Obermann',
    role: 'admin',
    club: 'SV Ottweiler',
    team: null,
  },
  coach('trainer.ottweiler1', 'Stefan Lorenz', 'SV Ottweiler 1', 'SV Ottweiler'),
  coach('trainer.ottweiler2', 'Marco Klein', 'SV Ottweiler 2', 'SV Ottweiler'),
  coach('trainer.a-jugend', 'Jan Peters', 'A-Jugend (U19)', 'SV Ottweiler'),
  coach('trainerin.c-jugend', 'Sandra Busch', 'C-Jugend (U15)', 'SV Ottweiler'),
  coach('trainer.e-jugend', 'Kai Möller', 'E-Jugend (U11)', 'SV Ottweiler'),
  coach('trainer.ah', 'Rolf Albrecht', 'Alte Herren', 'SV Ottweiler'),

  player('nico', 'Nico Baumann', 'SV Ottweiler 1', 1, ['GK'], 'SV Ottweiler'),
  player('tim', 'Tim Engel', 'SV Ottweiler 1', 5, ['DF'], 'SV Ottweiler'),
  player('jannik', 'Jannik Roth', 'SV Ottweiler 1', 8, ['MF'], 'SV Ottweiler'),
  player('lukas', 'Lukas Simon', 'SV Ottweiler 1', 9, ['FW'], 'SV Ottweiler'),
  player('felix', 'Felix Haas', 'SV Ottweiler 2', 7, ['MF'], 'SV Ottweiler'),
  player('moritz', 'Moritz Franke', 'SV Ottweiler 2', 10, ['FW'], 'SV Ottweiler'),
]
