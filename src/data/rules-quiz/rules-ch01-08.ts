import { type QuizBatch } from '../../types'
import { ALL_MODES, OUTDOOR_ONLY } from './modes'

const AT_BRICK_MARK = 'At the brick mark'
const ON_GOAL_LINE = 'On the goal line'

export const rulesCh01to08: QuizBatch = {
  source: {
    title: 'WFDF Rules of Ultimate 2025-2028 (CC BY 4.0)',
    url: 'https://rules.wfdf.sport/wp-content/uploads/2024/12/WFDF-Rules-of-Ultimate-2025-2028.pdf'
  },
  questions: [
    // 1. Spirit of the Game
    {
      id: 'r1_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.11',
      question: 'Who is responsible for making and resolving calls during a game?',
      answer: 'The players and captains',
      wrong: ['The game advisors', 'The coaches', 'The tournament director'],
      explanation: 'Ultimate is self-officiated: players and captains are solely responsible for making and resolving all calls.'
    },
    {
      id: 'r1_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '1.12',
      question: "After discussion, the players can't agree on what happened in a play. What happens?",
      answer: 'The disc goes back to the last non-disputed thrower',
      wrong: ['The defence gets the disc', 'The offence keeps the disc where it landed', 'The captains flip a disc to decide'],
      explanation: 'If players cannot agree, or it is not clear what occurred or would most likely have occurred, the disc is returned to the last non-disputed thrower.'
    },
    {
      id: 'r1_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '1.6.6',
      question: 'Which of these is listed in the rules as a clear violation of the Spirit of the Game?',
      answer: 'Calling for a pass from an opposition player',
      wrong: ['Celebrating with your team after scoring', 'Asking an opponent to explain their call or a rule', 'Retracting a call you no longer believe in'],
      explanation: 'Calling for a pass from an opponent (e.g. a defender shouting "yes!" to trick the thrower) is a clear Spirit violation. Retracting a wrong call is an example of good Spirit.'
    },
    {
      id: 'r1_04',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.5.1',
      question: 'You realise the foul you called was not a foul. What does the Spirit of the Game encourage?',
      answer: 'Retract the call',
      wrong: ['Keep the call to avoid another stoppage', 'Let the captains decide', 'Admit it at the end of the point'],
      explanation: 'Retracting a call when you no longer believe it was correct is listed as an example of good Spirit.'
    },
    {
      id: 'r1_05',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.3.10',
      question: 'When should a player make a call?',
      answer: 'When the breach affects the outcome, or safety is at risk',
      wrong: ['Whenever they see any breach, however small', 'Only when the opponent agrees there was a breach', 'Only in the end zone'],
      explanation: 'Players should only make a call where a breach is significant enough to make a difference to the outcome of the action, or where a player\'s safety is at risk.'
    },
    {
      id: 'r1_06',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '1.10.1',
      question: "You weren't involved in a play, but you're sure your team-mate made an incorrect call. What should you do?",
      answer: 'Tell your team-mate',
      wrong: ['Nothing: only involved players may speak', 'Overrule the call yourself', 'Call a spirit stoppage'],
      explanation: 'Calls are discussed by the players involved, but a player who believes a team-mate made an incorrect call should inform them.'
    },
    {
      id: 'r1_07',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '1.10.2',
      question: 'Without being asked by a player, which non-player may get involved in resolving a call?',
      answer: 'The captains',
      wrong: ['The coaches', 'The first dog you see', 'The tournament director'],
      explanation: 'Non-players, apart from the captains, should refrain from getting involved. Others (e.g. people on the sideline) may only give their perspective when a player involved asks them.'
    },
    {
      id: 'r1_08',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.8',
      question: "A novice player breaks a rule they don't know. What should experienced players do?",
      answer: 'Explain the breach to them',
      wrong: ['Call a violation and move on', 'Ask them to sit out the next point', 'Ignore it'],
      explanation: 'When a novice is involved in a breach and does not know the rules, experienced players should help explain it.'
    },
    {
      id: 'r1_09',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '1.2.1',
      question: 'A player deliberately commits an egregious breach of the rules. What can happen?',
      answer: 'The captains agree on an outcome, even one not in the rules',
      wrong: ['The player is ejected by a game advisor', 'Only the normal rule outcome applies', 'The other team is awarded a goal automatically'],
      explanation: 'For a deliberate or egregious breach of the rules or Spirit, the captains should discuss and determine an appropriate outcome, even if it is not in accordance with a specific rule.'
    },
    {
      id: 'r1_10',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.7.2',
      question: 'As guardians of the Spirit of the Game, what must teams do?',
      answer: 'Discipline team-mates who display poor Spirit',
      wrong: ['Report opponents to the federation after each game', 'Let the captains handle all Spirit issues alone', 'Avoid giving feedback to other teams'],
      explanation: 'Teams must teach their players the rules and good Spirit, discipline team-mates with poor Spirit, give constructive feedback to other teams, and call Spirit stoppages when needed.'
    },

    // 2. Playing Field
    {
      id: 'r2_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '2.3',
      question: 'Are the perimeter lines (sidelines and end lines) part of the playing field?',
      answer: 'No, they are out-of-bounds',
      wrong: ['Yes, they are in-bounds', 'Only the sidelines are in-bounds', 'Only the end lines are in-bounds'],
      explanation: 'The perimeter lines are not part of the playing field: touching them is out-of-bounds.'
    },
    {
      id: 'r2_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '2.4',
      question: 'Is the goal line part of the end zone?',
      answer: 'No, it is part of the central zone',
      wrong: ['Yes, it is part of the end zone', 'It belongs to both zones', 'It is out-of-bounds'],
      explanation: 'The goal lines separate the central zone from the end zones and are part of the central zone. Catching the disc with a foot on the goal line is not a goal.'
    },
    {
      id: 'r2_03',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '2.5',
      question: 'Where is the brick mark?',
      answer: 'In the central zone, one end zone length from the goal line, centred',
      wrong: ['On the goal line, midway between the sidelines', 'In the end zone, midway between the sidelines', '10 metres from the goal line, on the sideline'],
      explanation: 'The brick marks are in the central zone, a distance equal to the end zone length away from each goal line, midway between the sidelines.'
    },
    {
      id: 'r2_04',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '2.7',
      question: 'A spectator standing 2 metres from the sideline gets in the way of a receiver. What can the receiver call?',
      answer: 'Violation',
      wrong: ['Foul', 'Pick', 'Nothing: the spectator is out-of-bounds'],
      explanation: 'If play is obstructed by non-players or objects within 3 metres of the perimeter line, the obstructed player or the thrower may call "Violation".'
    },
    {
      id: 'r2_05',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '2.6',
      question: 'How many cones mark the corners of the central zone and the end zones?',
      answer: '8',
      wrong: ['4', '6', '12'],
      explanation: 'Eight brightly-coloured, flexible objects (such as cones) mark the corners of the central zone and the end zones.'
    },

	{	
  id: 'r2_06',
  difficulty: 'medium',
  modes: OUTDOOR_ONLY,
  ref: '2.1',
  question: 'What are the dimensions of the outdoor playing field, including the end zones according to WFDF Rules?',
  answer: '100 m long and 37 m wide, with two end zones of 18 m each.',
  wrong: [
    '100 m long and 37 m wide, with two end zones of at least 18 m each.',
    '100 m long and 40 m wide, with two end zones of maximum 20 m each.',
    'twice as Long as wide, with two end zones of 18 m each.'
  ],
  explanation: 'The playing field is 100 m long and 37 m wide. Each end zone is 18 m deep, leaving a central zone of 64 m (100 − 2 × 18 m).'
},

    // 3. Equipment
    {
      id: 'r3_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '3.1',
      question: 'Which disc may be used in a game?',
      answer: 'Any disc acceptable to both captains',
      wrong: ['Only a WFDF-approved disc', "The home team's choice", 'Any 175 g disc'],
      explanation: 'Any flying disc acceptable to both captains may be used. WFDF may keep a list of recommended discs.'
    },
    {
      id: 'r3_02',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '3.3',
      question: "What must a player's uniform do?",
      answer: 'Distinguish their team',
      wrong: ['Show a player number', 'Be approved by WFDF', 'Contain at least one political statement'],
      explanation: 'Each player must wear a uniform that distinguishes their team.'
    },

    // 4. Point, Goal and Game
    {
      id: 'r4_01',
      difficulty: 'easy',
      modes: OUTDOOR_ONLY,
      ref: '4.2',
      question: 'Under the standard WFDF rules, how many goals win a game?',
      answer: '15',
      wrong: ['13', '17', '21'],
      explanation: 'A game is won by the first team to score 15 goals. Tournaments often use other caps, set in the Appendix or event rules.'
    },
    {
      id: 'r4_02',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '4.3',
      question: 'Under the standard WFDF rules, when is half time?',
      answer: 'When a team first scores 8 goals',
      wrong: ['When a team first scores 7 goals', 'After 50 minutes of play', 'When the total score reaches 15'],
      explanation: 'A game has two halves. Half time occurs when a team first scores 8 goals.'
    },
    {
      id: 'r4_03',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '4.5.3',
      question: 'After a goal, which team pulls next?',
      answer: 'The team that scored',
      wrong: ['The team that conceded', 'The team that pulled the previous point', 'Decided by a disc flip'],
      explanation: 'After a goal, the team that scored becomes defence and pulls next.'
    },
    {
      id: 'r4_04',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '4.5.2',
      question: 'After a goal, what happens to the end zones?',
      answer: 'Teams switch the end zone they defend',
      wrong: ['Teams only switch at half time', 'The team that conceded chooses', 'Nothing changes until the next game'],
      explanation: 'After each goal (unless the game is won or it is half time), the next point starts immediately and the teams switch the end zone they defend.'
    },

    // 5. Teams
    {
      id: 'r5_01',
      difficulty: 'easy',
      modes: OUTDOOR_ONLY,
      ref: '5.1',
      question: 'What is the maximum number of players a team can have on the field during a point?',
      answer: '7',
      wrong: ['5', '6', '8'],
      explanation: 'Each team puts a maximum of 7 and a minimum of 5 players on the field during each point.'
    },
    {
      id: 'r5_02',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '5.1',
      question: 'What is the minimum number of players a team must have on the field to play a point?',
      answer: '5',
      wrong: ['4', '6', '7'],
      explanation: 'Each team puts a maximum of 7 and a minimum of 5 players on the field during each point.'
    },
    {
      id: 'r5_03',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '5.3',
      question: 'When may a team make unlimited substitutions?',
      answer: 'After a goal, before signalling readiness for the pull',
      wrong: ['Any time play is dead', 'During a time-out', 'When there is one Injury-Call'],
      explanation: 'A team may make unlimited substitutions after a goal is scored and before it signals readiness for the pull. Outside that, a player can only be substituted for an injury or faulty equipment.'
    },
    {
      id: 'r5_04',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '5.2',
      question: 'Which two roles must each team designate?',
      answer: 'A captain and a spirit captain',
      wrong: ['A captain and a coach', 'A spirit captain and a game advisor', 'A captain and a timekeeper'],
      explanation: 'Each team must designate a captain and a spirit captain to represent the team.'
    },

    // 6. Starting a Game
    {
      id: 'r6_01',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '6.2',
      question: 'Before the game, the team that won the flip chooses to receive the first pull. What does the other team get to choose?',
      answer: 'Which end zone it defends first',
      wrong: ['Nothing: the winner makes both choices', 'Who pulls after half time', 'Which disc is used'],
      explanation: 'The team that wins chooses either to receive or throw the first pull, or which end zone to defend first. The other team gets the remaining choice.'
    },
    {
      id: 'r6_02',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '6.3',
      question: 'What happens to the initial choices (pull and end zone) at the start of the second half?',
      answer: 'They are switched',
      wrong: ['A new disc flip decides', 'They stay the same', 'The trailing team chooses'],
      explanation: 'At the start of the second half, the initial selections are switched.'
    },

    // 7. The Pull
    {
      id: 'r7_01',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '7.2',
      question: 'How do the teams signal they are ready for the pull?',
      answer: 'The puller and an offensive player each raise a hand above their head',
      wrong: ['A defense Player and an offensive player each raise a Hand Above their head', 'The puller holds the disc above their head', 'Bark aggressively across the field'],
      explanation: 'The pull may only be made after both teams have signalled readiness: the puller and a player on offence raise a hand above their head.'
    },
    {
      id: 'r7_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '7.3',
      question: 'After signalling readiness, where must the receiving team stand until the pull is released?',
      answer: 'With one foot on their defending goal line',
      wrong: ['Anywhere in their defending end zone', 'Behind their defending goal line', 'Anywhere in the central zone'],
      explanation: 'After signalling readiness, all offensive players must stand with one foot on their defending goal line, without changing position relative to one another, until the pull is released.'
    },
    {
      id: 'r7_03',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '7.5',
      question: 'Two receivers swap places along the goal line after signalling readiness but before the pull is released. What can the defence call?',
      answer: 'False start',
      wrong: ['Offside', 'Travel', 'Pick'],
      explanation: 'Offensive players must not change location relative to one another until the pull is released (7.3). Breaching this is a "false start" (7.5). It is recommended to warn the other team before enforcing it.'
    },
    {
      id: 'r7_04',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '7.5',
      question: "A defender's foot crosses the goal line before the pull is released. What can the offence call?",
      answer: 'Offside',
      wrong: ['False start', 'Pick', 'Foul'],
      explanation: 'Defensive players must keep their feet entirely behind the goal line until the pull is released (7.4). Breaching this is "offside" (7.5). It is recommended to warn the other team before enforcing it.'
    },
    {
      id: 'r7_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '7.5.2',
      question: 'The offence calls offside on the pull. What must they do with the disc?',
      answer: 'Let it land untouched, then play as if a brick was called',
      wrong: ['Catch it and restart with a check', 'Ask for the pull to be thrown again', 'Catch it and walk with it to the brick point'],
      explanation: 'If the offence calls offside, they must let the disc hit the ground untouched, then resume play as if a brick had been called, with no check needed.'
    },
    {
      id: 'r7_06',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '7.7',
      question: 'After the pull is released, when may a defender touch the disc?',
      answer: 'Once an offensive player has touched it or it has hit the ground',
      wrong: ['Any time after the release', 'Only once the offence has caught it', 'Never before the first pass'],
      explanation: 'No defender may touch the pull until a member of the offence contacts the disc or the disc hits the ground.'
    },
    {
      id: 'r7_07',
      difficulty: 'easy',
      modes: OUTDOOR_ONLY,
      ref: '7.8',
      question: 'A receiver touches the pull in the air but drops it. What happens?',
      answer: 'Turnover (dropped pull)',
      wrong: ['The pull is thrown again', 'The offence plays it where it lands', 'The offence takes a brick'],
      explanation: 'If an offensive player touches the pull before it hits the ground and the offence fails to establish possession, it is a turnover ("dropped pull").'
    },
    {
      id: 'r7_08',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '7.12',
      question: 'The pull lands out-of-bounds without touching the field or a player. Where may the offence put the disc into play?',
      answer: 'At the brick mark, or where it went out-of-bounds',
      wrong: ['The spot on the central zone closest to where the disc stopped', 'At the centre of their goal line', 'Where the disc landed'],
      explanation: 'The thrower may choose the brick mark closest to their defending end zone, or the spot on the central zone closest to where the disc went out-of-bounds.'
    },
    {
      id: 'r7_09',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '7.12',
      question: 'How does the offence signal that they want a brick?',
      answer: 'Any offensive player fully extends an arm overhead, before the disc is picked up',
      wrong: ['Pointing at the brick mark', 'Calling "brick" after picking up the disc', 'The Player who picks up the disc fully extends an arm overhead, before the disc is picked up'],
      explanation: 'The brick option must be signalled before the disc is picked up, by any offensive player fully extending one arm overhead, and they should call "brick".'
    },
    {
      id: 'r7_10',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '7.10',
      question: "The pull lands in-bounds, rolls into the offence's own end zone and stops there, without going out. Where is the pivot?",
      answer: 'Where the disc stopped, in the end zone',
      wrong: ['On the goal line, nearest to where it stopped', 'At the brick point', 'Where the disc first landed'],
      explanation: 'If the pull lands in-bounds and never goes out-of-bounds, the thrower establishes a pivot where the disc stops, even in their defending end zone.'
    },
    {
      id: 'r7_11',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '7.11',
      question: "The pull lands in-bounds, then rolls untouched out of the back of the offence's own end zone. Where is the pivot?",
      answer: 'On the central zone, nearest to where it went out',
      wrong: ['Where it crossed the end line', 'On the central zone, nearest to where it stopped', 'At the centre of the goal line'],
      explanation: 'The pivot is where the disc first crossed the perimeter line, or the nearest point in the central zone if that would be in the defending end zone. No brick: the pull touched the field first.'
    },
    {
      id: 'r7_12',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '7.11.1',
      question: 'The pull lands in-bounds, a receiver touches it on the ground, and it then rolls out of their own end zone. Where is the pivot?',
      answer: 'Where it crossed the perimeter line, even in the end zone',
      wrong: ['On the central zone, nearest to where it went out', 'At the brick point', 'Turnover: the defence takes it'],
      explanation: 'If an offensive player touched the disc before it went out-of-bounds, the pivot is where it crossed the perimeter line, even in the defending end zone. Not a turnover: it had already hit the ground.'
    },
    {
      id: 'r7_13',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '7.9',
      question: 'A receiver catches the pull while standing in their own end zone. Where is their pivot?',
      answer: 'Where they caught it, even in the end zone',
      wrong: ['One the goal line closest to where they caught it', 'At the brick point', 'Anywhere they choose in the end zone'],
      explanation: 'After catching the pull, the pivot is at the spot on the field nearest to where possession was established, even in the defending end zone.'
    },

    // 8. State of Play
    {
      id: 'r8_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '8.1.3',
      question: 'Which of these is a moment when play is dead?',
      answer: 'After a call that stops play, until the disc is checked in',
      wrong: ['While a pass is in the air', 'While the thrower is being stalled', 'When the spirit of the game is extremely low'],
      explanation: 'Play is dead after the start of a point until the pull, while the disc is carried to the pivot, after a call or stoppage until the check, and after the disc hits the ground until possession.'
    },
    {
      id: 'r8_02',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '8.1.5',
      question: 'Can players move during dead play?',
      answer: 'Yes, unless a rule says otherwise',
      wrong: ['No, everyone must freeze', 'Only the thrower', 'Only the defence'],
      explanation: 'Players are allowed to move during dead play, unless specified otherwise (e.g. before the pull, or after some calls).'
    },
    {
      id: 'r8_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '8.3',
      question: 'During dead play, may the thrower hand the disc to a team-mate?',
      answer: 'No, possession cannot be transferred during dead play',
      wrong: ['Yes, at any time', 'Yes, but only after a turnover', 'Only if the marker agrees'],
      explanation: 'The thrower may not transfer possession of the disc to another player during dead play.'
    },
    {
      id: 'r8_04',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '8.5.1.1',
      question: 'After a turnover, the disc comes to rest in the central zone. How long does the offence have to establish a pivot?',
      answer: '10 seconds',
      wrong: ['5 seconds', '20 seconds', 'No limit if they walk'],
      explanation: 'After a turnover, the thrower must establish a pivot within 10 seconds of the disc coming to rest in the central zone, or 20 seconds in an end zone.'
    },
    {
      id: 'r8_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '8.5.1.2',
      question: 'After a turnover, the disc comes to rest in an end zone. How long does the offence have to establish a pivot?',
      answer: '20 seconds',
      wrong: ['10 seconds', '15 seconds', '30 seconds'],
      explanation: 'After a turnover, the thrower must establish a pivot within 20 seconds of the disc coming to rest in an end zone, or 10 seconds in the central zone.'
    },
    {
      id: 'r8_06',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '8.5',
      question: 'After a turnover or a pull, how must the offence get to the disc?',
      answer: 'Directly, at walking pace or faster',
      wrong: ['At any pace, as long as they get there', 'Walking only', 'Only once the defence has set up'],
      explanation: 'After a turnover or a pull, an offensive player must move at walking pace or faster to directly retrieve the disc and establish a pivot. The defence may warn ("delay of game") or call a violation.'
    },
    {
      id: 'r8_07',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '8.5.4',
      question: "Players can't agree on where the pivot should be. Which spot is used?",
      answer: 'The midpoint between the two proposed spots',
      wrong: ["The defence's spot", "The offence's spot", 'The spot of the last completed pass'],
      explanation: 'If players cannot agree on the correct pivot location, the midpoint between the two proposed locations is used.'
    },
    {
      id: 'r8_08',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '8.4.1',
      question: 'A pull is rolling. A defender stops it, but kicks it far up the field. What may the offence request?',
      answer: 'To put the disc into play where the defender touched it',
      wrong: ['Nothing', 'A brick', 'To take the disc to the goal line'],
      explanation: 'Any player may stop a rolling disc (8.4). If they significantly alter its position, the opposition may ask for the pivot where the disc was contacted.'
    }
  ]
}
