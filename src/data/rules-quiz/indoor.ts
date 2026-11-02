import { type QuizBatch } from '../../types'
import { INDOOR_ONLY } from './modes'

const STALLING_ONE = 'Stalling one'
const MAX_FIVE = 'Where it stopped plus one, maximum 5'
const MAX_SIX = 'Where it stopped plus one, maximum 6'
const MAX_SEVEN = 'Where it stopped plus one, maximum 7'
const MAX_NINE = 'Where it stopped plus one, maximum 9'
const AT_BRICK_MARK = 'At the brick mark'
const GOAL_LINE_CENTRE = 'At the centre of the goal line'
const RE_PULL = 'The pull is thrown again'
const INVALID_BRICK = 'Invalid pull: the receivers may take a brick'

// No ref: these rules are not in the WFDF rules, so answers link to the appendix itself
export const indoor: QuizBatch = {
  source: {
    title: 'EUF Indoor Rules Appendix v10',
    url: 'https://www.ultimatefederation.eu/s/EUF-Indoor-Rules-Appendix-version-10.pdf'
  },
  questions: [
    // Field and teams
    {
      id: 'in_01',
      difficulty: 'easy',
      modes: INDOOR_ONLY,
      question: 'What is the standard size of an indoor field (EUF)?',
      answer: '40 × 20 metres',
      wrong: ['100 × 37 metres', '60 × 30 metres', '30 × 15 metres'],
      explanation: 'Indoors (EUF), the field is 40 × 20 metres: length 36 to 44 m, width 18 to 22 m. Outdoors it is 100 × 37 m.'
    },
    {
      id: 'in_02',
      difficulty: 'medium',
      modes: INDOOR_ONLY,
      question: 'How deep are the end zones on an indoor field (EUF)?',
      answer: '6 metres',
      wrong: ['8 metres', '10 metres', '18 metres'],
      explanation: 'Indoors (EUF), end zones are 6 metres deep. Outdoors they are 18 metres.'
    },
    {
      id: 'in_03',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Where is the brick mark on an indoor field (EUF)?',
      answer: '8 metres in front of the end zone',
      wrong: ['On the goal line', '6 metres in front of the end zone', 'At the centre of the field'],
      explanation: 'Indoors (EUF), the brick mark is 8 metres in front of the end zone, so 14 metres from the end line. Outdoors it is one end zone length (18 m) from the goal line.'
    },
    {
      id: 'in_04',
      difficulty: 'easy',
      modes: INDOOR_ONLY,
      question: 'How many players per team are on the field during an indoor point (EUF)?',
      answer: '5',
      wrong: ['4', '6', '7'],
      explanation: 'Indoors (EUF), each team puts 5 players on the field during each point. Outdoors it is up to 7.'
    },

    // Pull
    {
      id: 'in_05',
      difficulty: 'medium',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), what makes a pull valid?',
      answer: 'It passes through a 2 m high box above the receiving end zone before touching anything',
      wrong: ['It lands anywhere in-bounds', 'It first touches the floor in the central zone', 'It is caught by the receivers in the central zone'],
      explanation: 'A valid pull passes through any part of a 2 m high box over the receiving end zone without touching the ground or anything out-of-bounds first. It is also valid if a receiver touches it in the air.'
    },
    {
      id: 'in_06',
      difficulty: 'medium',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), the pull lands in the central zone, short of the end zone. What may the receiving team do?',
      answer: 'Take a brick, or stop the disc and start play immediately',
      wrong: ['Only play it where it stops', RE_PULL, 'Take it to the centre of the goal line'],
      explanation: 'Indoors, a pull that does not pass through the 2 m box above the end zone is invalid and may be bricked. The receivers may also stop the disc and start play immediately.'
    },
    {
      id: 'in_07',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), the pull first touches the floor in the end zone, then slides out of it. Is it a valid pull?',
      answer: 'Yes, it is a valid pull',
      wrong: [INVALID_BRICK, RE_PULL, 'It is a turnover'],
      explanation: 'A pull that first touches the floor in the end zone and then slides out is valid. If it lands before the end zone and slides out of it, it is invalid and may be bricked.'
    },
    {
      id: 'in_08',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a roller pull lands before the end zone and rolls on into it. What is it?',
      answer: INVALID_BRICK,
      wrong: ['A valid pull', 'A turnover', RE_PULL],
      explanation: 'A roller pull that lands in the end zone and rolls out is valid. One that lands before the end zone and rolls on is invalid: it may be bricked, or the receivers may stop it and play immediately.'
    },
    {
      id: 'in_09',
      difficulty: 'easy',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a receiver tries to catch the pull but drops it. What happens?',
      answer: 'No turnover: they play it from where the disc stops',
      wrong: ['Turnover (dropped pull)', RE_PULL, 'The receivers take a brick'],
      explanation: 'Indoors, a dropped pull is not a turnover as long as it was an attempt at a catch. The player who dropped it brings the disc into play where it stops. Outdoors, it is a turnover.'
    },
    {
      id: 'in_10',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a receiver deliberately bats the pull to the floor instead of catching it. What happens?',
      answer: 'Turnover',
      wrong: ['No turnover: play it where it stops', 'The receivers take a brick', RE_PULL],
      explanation: 'A deliberate mac (bat) of the pull instead of catching it is a turnover, unlike a dropped pull while trying to catch it.'
    },
    {
      id: 'in_11',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), the receivers call brick on the pull and the defence contests it. Where does the offence put the disc into play?',
      answer: GOAL_LINE_CENTRE,
      wrong: [AT_BRICK_MARK, 'Where the disc stopped', RE_PULL],
      explanation: 'If a brick call is contested by the defence, or the offence contests a valid pull, the receiving team brings the disc into play at the centre of the goal line.'
    },

    // Stall count
    {
      id: 'in_12',
      difficulty: 'easy',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), up to which number does the marker count in a stall count?',
      answer: '8',
      wrong: ['6', '9', '10'],
      explanation: 'Indoors (EUF), the stall count goes to 8 instead of 10, so every restart number is lower too.'
    },
    {
      id: 'in_13',
      difficulty: 'medium',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), the thrower contests a stall-out. Where does the stall count restart?',
      answer: 'Stalling six',
      wrong: [STALLING_ONE, 'Stalling seven', 'Stalling eight'],
      explanation: 'Indoors, a contested stall-out restarts at "Stalling six". Outdoors it restarts at 8.'
    },
    {
      id: 'in_14',
      difficulty: 'medium',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), the marker calls a foul on the thrower, who accepts it. Where does the stall count restart?',
      answer: MAX_SEVEN,
      wrong: [MAX_NINE, MAX_FIVE, STALLING_ONE],
      explanation: 'Indoors, after an uncontested breach by the offence, the stall count restarts at maximum 7. Outdoors it is maximum 9.'
    },
    {
      id: 'in_15',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), after a pick call, where does the stall count restart?',
      answer: MAX_FIVE,
      wrong: [MAX_SIX, MAX_SEVEN, STALLING_ONE],
      explanation: 'Indoors, after all other calls (pick, contested foul...), the stall count restarts at maximum 5. Outdoors it is maximum 6.'
    },
    {
      id: 'in_16',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a foul is contested at "Stalling 3". Where does the stall count restart?',
      answer: 'Stalling 4',
      wrong: ['Stalling 3', 'Stalling 5', 'Stalling 1'],
      explanation: 'Indoors, a contested foul restarts at maximum 5: the last agreed number plus one (3 + 1 = 4), or 5, whichever is lower.'
    },
    {
      id: 'in_17',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a foul is contested at "Stalling 6". Where does the stall count restart?',
      answer: 'Stalling 5',
      wrong: ['Stalling 6', 'Stalling 7', 'Stalling 1'],
      explanation: 'Indoors, a contested foul restarts at maximum 5: the last agreed number plus one (6 + 1 = 7), or 5, whichever is lower.'
    },

    // Walls and ceilings
    {
      id: 'in_18',
      difficulty: 'easy',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a pass touches a wall. What is it?',
      answer: 'Out-of-bounds',
      wrong: ['Still in play', 'The pass is replayed', 'In-bounds, if it comes back onto the field'],
      explanation: 'A disc touching the wall is out-of-bounds. Play resumes where the disc left the playing field.'
    },
    {
      id: 'in_19',
      difficulty: 'medium',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a pass hits the ceiling above the field. Where does play resume?',
      answer: 'On the field, right under where it touched the ceiling',
      wrong: ['Where the thrower stood', 'On the nearest sideline', AT_BRICK_MARK],
      explanation: 'A disc touching the ceiling is out-of-bounds. If that spot is above the field, play resumes right underneath it, otherwise from where the disc left the field.'
    },
    {
      id: 'in_20',
      difficulty: 'medium',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), after the disc goes out-of-bounds, where may the thrower set their pivot?',
      answer: '1 metre inside the field',
      wrong: ['On the perimeter line', '3 metres inside the field', AT_BRICK_MARK],
      explanation: 'Indoors, when the disc is out-of-bounds, the player who restarts play can set their pivot foot 1 metre inside the playing field, away from the wall.'
    },

    // Time-outs
    {
      id: 'in_21',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), how many time-outs does each team get, and when?',
      answer: 'One, only after a goal and before the next pull',
      wrong: ['Two, at any time', 'One, at any stoppage', 'None'],
      explanation: 'Indoors, each team has one 1-minute time-out, which can only be taken after a goal and before the next pull. None can start in the last 5 minutes or during the cap.'
    },
    {
      id: 'in_22',
      difficulty: 'hard',
      modes: INDOOR_ONLY,
      question: 'Indoors (EUF), a player calls a time-out during play. What happens?',
      answer: 'Play stops, then restarts with the stall count + 2',
      wrong: ['Nothing: play continues', 'Turnover', 'Play stops and the stall count restarts at one'],
      explanation: 'Indoors, time-outs are only allowed between points. If one is called during play, play stops and continues with stall + 2.'
    }
  ]
}
