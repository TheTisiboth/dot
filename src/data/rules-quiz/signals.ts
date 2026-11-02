import { type QuizBatch, type QuizDifficulty, type QuizQuestion } from '../../types'
import { ALL_MODES } from './modes'

interface Signal {
  n: number;
  slug: string;
  name: string;
  description: string;
  /** What is called out loud with this signal, when the name alone doesn't say it */
  calls?: string;
  /** Signals easily confused with this one, used as wrong options */
  lookalikes: [number, number, number];
  /** One per generated question: photo → name, and name → description */
  difficulty: { image: QuizDifficulty; description: QuizDifficulty };
}

const SIGNALS: Signal[] = [
  { n: 1, slug: 'foul', name: 'Foul', description: 'Hold one arm straight out and chop the other forearm across it', lookalikes: [11, 10, 13], difficulty: { image: 'easy', description: 'medium' } },
  { n: 2, slug: 'violation', name: 'Violation', description: 'Hands above head forming a V, closed fists', lookalikes: [10, 3, 15], difficulty: { image: 'medium', description: 'medium' } },
  { n: 3, slug: 'goal', name: 'Goal', description: 'Raise both arms fully extended straight up, palms facing inwards', lookalikes: [2, 24, 9], difficulty: { image: 'easy', description: 'easy' } },
  { n: 4, slug: 'contest', name: 'Contest', description: 'Two fists bumped together in front of chest, backs of hands facing outward', lookalikes: [5, 11, 1], difficulty: { image: 'easy', description: 'medium' } },
  { n: 5, slug: 'accepted', name: 'Accepted', description: 'Forearms extended in front of body, elbows tight against torso, palms facing up', lookalikes: [4, 6, 13], difficulty: { image: 'medium', description: 'medium' } },
  { n: 6, slug: 'retracted', name: 'Retracted / play on', description: 'Sweeping crossover motion with both arms extended down in front of body', calls: 'Play on', lookalikes: [5, 21, 15], difficulty: { image: 'medium', description: 'hard' } },
  { n: 7, slug: 'in-out', name: 'In / out-of-bounds, out of end zone', description: 'One arm extended, flat palm, pointing towards (in) or away from (out) the field', lookalikes: [22, 24, 12], difficulty: { image: 'easy', description: 'medium' } },
  { n: 8, slug: 'disc-down', name: 'Disc down', description: 'Straight arm, index finger pointing down at 45 degrees', lookalikes: [9, 7, 13], difficulty: { image: 'medium', description: 'medium' } },
  { n: 9, slug: 'disc-up', name: 'Disc up', description: 'Elbow down, forearm vertical, index finger pointing upward', lookalikes: [8, 23, 16], difficulty: { image: 'medium', description: 'medium' } },
  { n: 10, slug: 'pick', name: 'Pick', description: 'Arms raised, elbows bent, fists facing head', lookalikes: [2, 18, 19], difficulty: { image: 'medium', description: 'medium' } },
  { n: 11, slug: 'travel', name: 'Travel', description: 'Closed fists, rotate wrists around in a vertical circle', lookalikes: [1, 4, 13], difficulty: { image: 'medium', description: 'medium' } },
  { n: 12, slug: 'marking-infraction', name: 'Marking infraction', description: 'Arms extended to the side, palms facing front', calls: 'Fast count, straddle, disc space, wrapping, double team, vision', lookalikes: [20, 7, 22], difficulty: { image: 'medium', description: 'hard' } },
  { n: 13, slug: 'turnover', name: 'Turnover', description: 'Right arm extended in front of body, palm up, then rotated to palm down', lookalikes: [8, 7, 5], difficulty: { image: 'medium', description: 'medium' } },
  { n: 14, slug: 'timing-violation', name: 'Timing violation', description: 'Tap head with open hand', calls: 'Stall, violation', lookalikes: [23, 18, 19], difficulty: { image: 'medium', description: 'hard' } },
  { n: 15, slug: 'offside', name: 'Offside / false start', description: 'Arms crossed overhead in an X, hands closed in a fist', lookalikes: [21, 2, 18], difficulty: { image: 'medium', description: 'hard' } },
  { n: 16, slug: 'time-out', name: 'Time-out', description: 'Form a T with the hands, or a hand and the disc', lookalikes: [17, 1, 18], difficulty: { image: 'easy', description: 'easy' } },
  { n: 17, slug: 'spirit-stoppage', name: 'Spirit stoppage', description: 'Upside down T formed by the hands', lookalikes: [16, 1, 11], difficulty: { image: 'hard', description: 'hard' } },
  { n: 18, slug: 'stoppage', name: 'Stoppage', description: 'Hands clasped and raised above head, arms bent', calls: 'Injury, technical', lookalikes: [10, 19, 15], difficulty: { image: 'medium', description: 'hard' } },
  { n: 19, slug: 'gender-male', name: 'Gender ratio: male matching', description: 'Hands cupped behind head, elbows out to the side', lookalikes: [10, 18, 14], difficulty: { image: 'hard', description: 'hard' } },
  { n: 20, slug: 'gender-female', name: 'Gender ratio: female matching', description: 'Arms extended to the side, hands closed in a fist', lookalikes: [12, 22, 7], difficulty: { image: 'hard', description: 'hard' } },
  { n: 21, slug: 'play-stopped', name: 'Play has stopped', description: 'Wave both extended arms crosswise overhead', lookalikes: [15, 6, 3], difficulty: { image: 'hard', description: 'hard' } },
  { n: 22, slug: 'who-made-call', name: 'Who made the call', calls: 'Offence / defence', description: 'Both arms pointing straight out towards the end zone defended by the calling team', lookalikes: [4, 12, 7], difficulty: { image: 'hard', description: 'hard' } },
  { n: 23, slug: 'no-effect', name: 'Did not affect the play', description: 'Open hand held above head, sweeping forward and back', lookalikes: [14, 9, 19], difficulty: { image: 'hard', description: 'hard' } },
  { n: 24, slug: 'match-point', name: 'Match point', description: 'Both arms pointing straight up to the left, palms facing down', lookalikes: [3, 7, 22], difficulty: { image: 'hard', description: 'hard' } }
]

const byNumber = (n: number): Signal => {
  const signal = SIGNALS.find(s => s.n === n)
  if (!signal) throw new Error(`Unknown hand signal ${n}`)
  return signal
}

const pad = (n: number): string => String(n).padStart(2, '0')

const explain = (s: Signal): string =>
  `${s.name}: ${s.description.charAt(0).toLowerCase()}${s.description.slice(1)}.${s.calls ? ` Calls: ${s.calls.toLowerCase()}.` : ''}`

const toQuestions = (s: Signal): QuizQuestion[] => {
  const lookalikes = s.lookalikes.map(byNumber)

  return [
    {
      id: `sig_${pad(s.n)}`,
      difficulty: s.difficulty.image,
      modes: ALL_MODES,
      question: 'Which call does this hand signal show?',
      answer: s.name,
      wrong: lookalikes.map(l => l.name),
      explanation: explain(s),
      image: `assets/signals/${pad(s.n)}-${s.slug}.png`
    },
    {
      id: `sig_${pad(s.n)}_r`,
      difficulty: s.difficulty.description,
      modes: ALL_MODES,
      question: `What is the hand signal for "${s.name}"?`,
      answer: s.description,
      wrong: lookalikes.map(l => l.description),
      explanation: explain(s)
    }
  ]
}

export const signals: QuizBatch = {
  source: {
    title: 'WFDF Rules of Ultimate 2025-2028 - Hand Signals (CC BY 4.0)',
    url: 'https://rules.wfdf.sport/wp-content/uploads/2025/03/WFDF-Rules-of-Ultimate-2025-2028-Hand-Signals.pdf'
  },
  questions: SIGNALS.flatMap(toQuestions)
}
