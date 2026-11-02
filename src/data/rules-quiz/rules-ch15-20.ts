import { type QuizBatch } from '../../types'
import { ALL_MODES, OUTDOOR_ONLY } from './modes'

const BACK_TO_THROWER = 'The disc goes back to the thrower'
const PLAY_STANDS = 'The play stands'
const TURNOVER_STANDS = 'The turnover stands'
const NOT_FOUL_AVOID = 'No, but it should be avoided'
const UP_TO_TWO_SECONDS = 'Up to 2 seconds'
const PASS_REPLAYED = 'The pass is replayed'
const POINT_REPLAYED = 'The point is replayed'
const STALLING_ONE = 'Stalling one'
const MAX_SIX = 'Where it stopped plus one, maximum 6'
const MAX_NINE = 'Where it stopped plus one, maximum 9'

export const rulesCh15to20: QuizBatch = {
  source: {
    title: 'WFDF Rules of Ultimate 2025-2028 (CC BY 4.0)',
    url: 'https://rules.wfdf.sport/wp-content/uploads/2024/12/WFDF-Rules-of-Ultimate-2025-2028.pdf'
  },
  questions: [
    // 15. Calling Fouls, Infractions and Violations
    {
      id: 'r15_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '15.1',
      question: 'What makes a breach of the rules a foul?',
      answer: 'Non-minor contact between opposing players',
      wrong: ['Any contact between players', 'Any breach called by the thrower', 'A breach by the marker'],
      explanation: 'A foul is a breach of the rules due to non-minor contact between opposing players. Marking and travel breaches are infractions, everything else is a violation.'
    },
    {
      id: 'r15_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '15.2',
      question: 'Which breaches are "infractions", which do not stop play?',
      answer: 'Marking and travel breaches',
      wrong: ['Fouls and violations', 'Picks and travels', 'Any breach called by the defence'],
      explanation: 'Marking and travel breaches are infractions, and infractions do not stop play.'
    },
    {
      id: 'r15_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '15.4',
      question: 'Who may call a foul?',
      answer: 'Only the player who was fouled',
      wrong: ['Any player who saw it', "The fouled player's captain", 'Any player on the fouled team'],
      explanation: 'Only the player fouled may claim a foul, by calling "Foul".'
    },
    {
      id: 'r15_04',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.5.1',
      question: 'Who may call a double team?',
      answer: 'Any offensive player',
      wrong: ['Only the thrower', 'Only the captain', 'Any player on the field'],
      explanation: 'In general only the thrower calls infractions, but any offensive player may call a double team, and any defensive player may call a travel.'
    },
    {
      id: 'r15_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.5.1',
      question: 'Who may call a travel?',
      answer: 'Any defensive player',
      wrong: ['Only the marker', 'Only the defence captain', 'Any player on the field'],
      explanation: 'In general only the thrower calls infractions, but any defensive player may call a travel, and any offensive player may call a double team.'
    },
    {
      id: 'r15_06',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.1.1',
      question: "A defender keeps a hand resting on a receiver's back to feel where they are. What is it?",
      answer: 'A violation',
      wrong: ['Nothing: the contact is minor', 'A foul', 'An infraction'],
      explanation: 'Intentionally initiating minor contact is still a breach of the rules. It is treated as a violation, not a foul.'
    },
    {
      id: 'r15_07',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.11',
      question: 'You retract a call you no longer believe in. How does play resume?',
      answer: 'As if you had committed a breach that was accepted',
      wrong: ['As if no call had been made', 'As if the call had been contested', 'With the point replayed'],
      explanation: 'After "Retracted", play resumes as if the player who retracted had caused an accepted breach (e.g. for the stall count).'
    },
    {
      id: 'r15_08',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.12',
      question: 'Several breaches happen on the same play. In which order are they resolved?',
      answer: 'Latest breach first, earliest breach last',
      wrong: ['Earliest breach first', 'Fouls first, then violations', 'Only the first breach counts'],
      explanation: 'If multiple breaches occur on the same play, the outcomes are resolved in reverse sequence: latest breach first, earliest breach last.'
    },
    {
      id: 'r15_09',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.9.1',
      question: 'A defender mishears a call and stops play, while the offence keeps the disc. What happens to the play?',
      answer: PLAY_STANDS,
      wrong: ['The disc goes back to the last thrower', 'Turnover', PASS_REPLAYED],
      explanation: 'After a player stops play incorrectly, if the opposition gains or retains possession, the play stands. The stall count resumes as if the player who stopped play caused an accepted breach.'
    },
    {
      id: 'r15_10',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '15.8',
      question: 'When must a call be made?',
      answer: 'Immediately after the breach is recognised',
      wrong: ['At the end of the point', 'Once the disc has been caught', 'Within 5 seconds'],
      explanation: 'Calls must be made immediately after the breach is recognised. Waiting to see the outcome is not allowed (except the 2-second delay for indirect fouls and picks).'
    },
    {
      id: 'r15_11',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '15.10',
      question: 'You disagree with a call made against you. What do you call?',
      answer: 'Contest',
      wrong: ['Retracted', 'Play on', 'Violation'],
      explanation: 'If the player against whom a call was made disagrees, they may call "Contest".'
    },

    // 16. Continuation after a Call
    {
      id: 'r16_01',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '16.2.3',
      question: 'A foul is called while the disc is in the air. What happens?',
      answer: 'Play continues until someone establishes possession',
      wrong: ['Play stops immediately', 'The disc goes straight back to the thrower', 'Turnover'],
      explanation: 'If a foul or violation is called while the disc is in the air (or against the thrower, who then throws), play continues until possession is established, then the call is resolved.'
    },
    {
      id: 'r16_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '16.2.4.1',
      question: 'A receiver calls a foul while the disc is in the air, but catches it anyway. What should they call to keep play going?',
      answer: 'Play on',
      wrong: ['Contest', 'Stop', 'Disc in'],
      explanation: 'If the team that made the call gains possession anyway, the play stands. The caller should say "Play on" as soon as possible so play does not stop.'
    },
    {
      id: 'r16_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '16.3',
      question: 'Both players involved agree that a call did not affect the outcome of the play. What happens?',
      answer: PLAY_STANDS,
      wrong: [BACK_TO_THROWER, POINT_REPLAYED, 'Turnover'],
      explanation: 'Whenever the players involved from both teams agree that the event or call did not affect the outcome, the play stands. If it was a goal, the goal stands. No other rule overrides this.'
    },

    // 17. Fouls
    {
      id: 'r17_01',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.1.1',
      question: 'A player dives recklessly into a crowd of players but touches nobody. Can it be a foul?',
      answer: 'Yes, dangerous play is a foul even without contact',
      wrong: ['No, no contact means no foul', 'Only if someone gets hurt', 'No, it is only a violation'],
      explanation: 'Reckless disregard for the safety of others is dangerous play and must be treated as a foul, regardless of whether or when contact occurs.'
    },
    {
      id: 'r17_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '17.2.2',
      question: 'After an accepted receiving foul, where does the fouled receiver get the disc?',
      answer: 'Where the foul happened, even in an end zone',
      wrong: ['Where the disc landed', 'Back with the thrower', 'On the nearest goal line'],
      explanation: 'After an accepted receiving foul, the fouled player gets possession at the location of the breach, even in an end zone, and play restarts with a check. If it is in the attacking end zone, they then go to the goal line before the stall starts.'
    },
    {
      id: 'r17_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '17.2.2',
      question: 'A receiving foul is contested. What happens?',
      answer: BACK_TO_THROWER,
      wrong: ['The receiver gets the disc where the foul happened', TURNOVER_STANDS, POINT_REPLAYED],
      explanation: 'If a receiving foul is contested, the disc is returned to the thrower.'
    },
    {
      id: 'r17_04',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.3.2',
      question: 'A receiver catches the disc in the end zone, then a defender knocks it out of their hands. The strip foul is accepted. What happens?',
      answer: 'Goal',
      wrong: ['The receiver gets the disc on the goal line', BACK_TO_THROWER, 'Turnover'],
      explanation: 'A strip foul makes a player drop a disc they caught. If the reception would otherwise have been a goal and the foul is accepted, a goal is awarded.'
    },
    {
      id: 'r17_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.5.2',
      question: 'A receiver jumps to catch the disc and would have landed in the end zone, but a defender pushes them and they land in the central zone. The foul is accepted. What happens?',
      answer: 'Goal',
      wrong: ['Possession on the goal line', 'Possession where they landed', BACK_TO_THROWER],
      explanation: 'This is a force-out foul: the contact made the receiver catch in the central zone instead of the end zone. If they would have caught it in the end zone, it is a goal.'
    },
    {
      id: 'r17_06',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.5.3',
      question: 'A receiver claims a defender pushed them out-of-bounds while catching. The defender contests. What happens?',
      answer: BACK_TO_THROWER,
      wrong: ['The receiver keeps the disc in-bounds', 'Turnover', 'The receiver gets the disc where they were pushed'],
      explanation: 'If a force-out foul is contested, the disc goes back to the thrower if the receiver ended up out-of-bounds. Otherwise the disc stays with the receiver.'
    },
    {
      id: 'r17_07',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '17.6.1.3',
      question: 'The marker bumps the thrower (non-minor contact) before they start a throw. What can the thrower call instead of a foul, so play does not stop?',
      answer: 'Contact',
      wrong: ['Disc space', 'Play on', 'Wrapping'],
      explanation: 'For a defensive throwing foul before the throwing motion, the thrower may call the "Contact" infraction instead. Play does not stop, and the stall count resumes at one.'
    },
    {
      id: 'r17_08',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.6.1.3',
      question: 'The thrower calls "Contact" and the marker does not contest. Where does the stall count resume?',
      answer: STALLING_ONE,
      wrong: ['The last number said, minus one', MAX_SIX, 'Where it stopped'],
      explanation: 'After an uncontested contact infraction, play does not stop and the marker must resume the stall count at one.'
    },
    {
      id: 'r17_09',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '17.7.2',
      question: "The thrower's arm hits the marker during their follow-through. Is it a foul?",
      answer: NOT_FOUL_AVOID,
      wrong: ['Yes, an offensive throwing foul', 'Yes, a defensive throwing foul', 'It is a violation'],
      explanation: "Contact during the thrower's follow-through is not a sufficient basis for a foul, but should be avoided."
    },
    {
      id: 'r17_10',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.8.1.1',
      question: 'A receiver is bumped away from the disc (an indirect foul). How long may they wait before calling it, to see if it affects the play?',
      answer: UP_TO_TWO_SECONDS,
      wrong: ['No wait: immediately', 'Up to 5 seconds', 'Until the pass is caught'],
      explanation: 'Since 2025, a player may delay an "Indirect Foul" call by up to 2 seconds to determine if the breach will affect the play.'
    },
    {
      id: 'r17_11',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '17.8.2',
      question: 'After an accepted indirect foul, what does the fouled player get?',
      answer: 'The chance to make up their lost position',
      wrong: ['Possession of the disc', 'A free pass without a marker', 'A time-out for their team'],
      explanation: 'An indirect foul is contact that does not directly affect a play on the disc. If accepted, the fouled player may make up any positional disadvantage it caused.'
    },
    {
      id: 'r17_12',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.9.1',
      question: 'An offensive and a defensive player both call fouls on the same play, and both are accepted. What happens?',
      answer: 'Offsetting fouls: back to the last non-disputed thrower',
      wrong: ['Only the first foul counts', 'Turnover', POINT_REPLAYED],
      explanation: 'Accepted fouls by offence and defence on the same play are offsetting fouls, and the disc goes back to the last non-disputed thrower.'
    },
    {
      id: 'r17_13',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '17.2.1.1',
      question: 'Right after a receiver has caught the disc, a defender hits their arm without making them drop it. Is it a foul?',
      answer: NOT_FOUL_AVOID,
      wrong: ['Yes, a receiving foul', 'Yes, a strip foul', 'It is a violation'],
      explanation: 'Contact with the arms or hands after the disc has been caught is not a sufficient basis for a foul, but should be avoided. If it makes them drop the disc, it is a strip foul.'
    },

    // 18. Infractions and Violations
    {
      id: 'r18_01',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.1.1.2',
      question: 'What is a "straddle"?',
      answer: "A line between the marker's feet comes within one disc diameter of the pivot",
      wrong: ['The marker touches the thrower', 'Two defenders stand within 3 metres of the thrower', "The marker's arms wrap around the thrower"],
      explanation: "Straddle: a line between a defender's feet comes within one disc diameter of the thrower's pivot point."
    },
    {
      id: 'r18_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.1.1.3',
      question: "How close may the marker be to the thrower's torso?",
      answer: 'No closer than one disc diameter',
      wrong: ['No closer than half a disc diameter', 'No closer than 1 metre', 'As close as they like without contact'],
      explanation: "Disc space: no part of a defender may be less than one disc diameter from the thrower's torso, unless caused solely by the thrower's movement."
    },
    {
      id: 'r18_03',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '18.1.1.5',
      question: 'What is a "double team"?',
      answer: 'A second defender within 3 m of the pivot, not guarding anyone else',
      wrong: ['Two defenders guarding the same receiver', 'A defender within 1 metre of the thrower', 'Two markers counting at once'],
      explanation: "Double team: a defender other than the marker is within 3 metres of the thrower's pivot point without also guarding another offensive player."
    },
    {
      id: 'r18_04',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.1.5.2',
      question: 'A defender runs across the 3-metre area around the thrower while following a cut. Is it a double team?',
      answer: 'No, just running across is not a double team',
      wrong: ['Yes, always', 'Yes, if the marker is counting', 'Only if they raise their arms'],
      explanation: 'Merely running across the 3-metre area around the thrower is not a double team.'
    },
    {
      id: 'r18_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.1.5.1',
      question: 'A defender guarding a receiver stands 2 metres from the thrower and tries to block a pass. Is it a double team?',
      answer: 'No, as long as they keep guarding their receiver',
      wrong: ['Yes, they are within 3 metres', 'Yes, if they raise their arms', 'Only if the marker is counting'],
      explanation: 'Since 2025, a defender guarding another offensive player can try to prevent a pass from the thrower, as long as they keep guarding that player.'
    },
    {
      id: 'r18_06',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.1.1.6',
      question: "The marker deliberately waves a hand in front of the thrower's eyes. Which call is it?",
      answer: 'Vision',
      wrong: ['Disc space', 'Wrapping', 'Foul'],
      explanation: "Vision: a defender uses any part of their body to intentionally obstruct the thrower's vision."
    },
    {
      id: 'r18_07',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.1.4',
      question: 'What is "wrapping"?',
      answer: "A line between the marker's hands comes within one disc diameter of the thrower's torso",
      wrong: ["The marker's feet straddle the pivot", "The marker blocks the thrower's view", 'Two defenders surround the thrower'],
      explanation: "Wrapping: a line between the defender's hands or arms comes within one disc diameter of the thrower's torso, or part of their body is above the pivot point."
    },
    {
      id: 'r18_08',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.3',
      question: 'The thrower calls "disc space" and play continues. Where does the marker resume the stall count?',
      answer: 'The last number fully said, minus one',
      wrong: [STALLING_ONE, 'The same number', MAX_SIX],
      explanation: 'After a marking infraction where play has not stopped, the marker resumes with the last number fully uttered minus one, once any illegal position is corrected.'
    },
    {
      id: 'r18_09',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.5',
      question: 'The thrower calls "disc space" and throws at the same time. The pass is incomplete. What happens?',
      answer: TURNOVER_STANDS,
      wrong: [BACK_TO_THROWER, PASS_REPLAYED, 'The receiver gets the disc'],
      explanation: 'If the thrower attempts a pass before, during or after a marking infraction call, the call has no consequence, and an incomplete pass is a turnover.'
    },
    {
      id: 'r18_10',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.2.1',
      question: 'The thrower calls a marking infraction, then completes a pass. The defence contests the call. What happens?',
      answer: BACK_TO_THROWER,
      wrong: ['The completion stands', 'Turnover', 'The receiver keeps the disc and play restarts with a check'],
      explanation: 'If a pass was completed, a contested or retracted marking infraction is treated as a violation by the offence, and the disc goes back to the thrower.'
    },
    {
      id: 'r18_11',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.2.1.1.2',
      question: 'A receiver catches the disc while running and throws without stopping. How many ground contacts may they make after the catch?',
      answer: 'At most 2',
      wrong: ['At most 1', 'At most 3', 'Any number, if they keep the same direction'],
      explanation: 'A player catching on the run may throw without slowing down, as long as they do not change direction or speed up, and make at most 2 ground contacts after the catch.'
    },
    {
      id: 'r18_12',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.2.3.1',
      question: 'A thrower who dived for the catch is on the ground. Is standing up a travel?',
      answer: 'No, if the pivot stays at the same spot',
      wrong: ['Yes, always', 'No, they may stand up anywhere', 'Only if the marker is counting'],
      explanation: 'A thrower who is not standing can use any part of their body as the pivot. Standing up is not a travel, as long as the pivot is at the same location.'
    },
    {
      id: 'r18_13',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.2.6',
      question: 'After a travel call, the thrower completes a pass before correcting their pivot. What can the defence do?',
      answer: 'Call a travel violation: the disc goes back to the thrower',
      wrong: ['Nothing: the completion stands', 'Claim a turnover', 'Ask for the pass to be replayed'],
      explanation: 'If the thrower completes a pass after a travel but before correcting the pivot, the defence may call a travel violation. Play stops, the disc goes back to the thrower and restarts with a check.'
    },
    {
      id: 'r18_14',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.2.7',
      question: 'After a travel call, the thrower throws an incomplete pass. What happens?',
      answer: TURNOVER_STANDS,
      wrong: [BACK_TO_THROWER, PASS_REPLAYED, 'Travel violation'],
      explanation: 'If, after a travel infraction, the thrower throws an incomplete pass, play continues: it is a turnover.'
    },
    {
      id: 'r18_15',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.3.1',
      question: 'When can a defender call "Pick"?',
      answer: 'When another player blocks them from following the player they guard',
      wrong: ['Whenever they lose their player', 'When their player runs around them', 'When two defenders collide'],
      explanation: 'A defender guarding one offensive player may call "Pick" if another player prevents them from moving towards or with that player.'
    },
    {
      id: 'r18_16',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.3.1',
      question: 'A defender is blocked by another player, but both the player they guard and the blocking player are going for the disc. Is it a pick?',
      answer: 'No',
      wrong: ['Yes', 'Only if there was contact', 'Only in the end zone'],
      explanation: 'It is not a pick if both the player being guarded and the obstructing player are making a play on the disc at the time of the obstruction.'
    },
    {
      id: 'r18_17',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.3.1.1',
      question: 'How long may a defender wait before calling "Pick", to see if the obstruction affects the play?',
      answer: UP_TO_TWO_SECONDS,
      wrong: ['No wait: immediately', 'Up to 5 seconds', 'Until the pass is caught'],
      explanation: 'A defender may delay a pick call by up to 2 seconds to determine if the obstruction will affect the play.'
    },
    {
      id: 'r18_18',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.3.2',
      question: 'Play stops for a pick. What may the obstructed defender do?',
      answer: 'Move to the agreed position they would have had',
      wrong: ['Nothing: stay where they are', 'Take the disc', 'Switch to guarding another player'],
      explanation: 'After a pick stops play, the obstructed player may move to the agreed position they would have occupied without the obstruction.'
    },

    // 19. Safety Stoppages
    {
      id: 'r19_01',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '19.1.2',
      question: 'A player is injured without an opponent causing it. What must they choose?',
      answer: 'Be substituted, or charge their team a time-out',
      wrong: ['Stay on at no cost', 'Have the point replayed', 'Have the opponent sub a player too'],
      explanation: 'If the injury was not caused by an opponent, the player must be substituted or charge their own team a time-out. If an opponent caused it, they may stay or be substituted.'
    },
    {
      id: 'r19_02',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '19.1.4',
      question: 'A thrower drops the disc because they got injured. Who has possession after the stoppage?',
      answer: 'The injured player keeps possession',
      wrong: ['The defence: it is a turnover', 'Any player of their team', POINT_REPLAYED],
      explanation: 'If the injured player had established possession and dropped the disc due to the injury, they retain possession.'
    },
    {
      id: 'r19_03',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '19.2.1.2',
      question: 'A player has a bleeding wound. How long do they have to deal with it before having to sub or use a time-out?',
      answer: '70 seconds',
      wrong: ['30 seconds', '75 seconds', '2 minutes'],
      explanation: 'A player with an open or bleeding wound has 70 seconds to address it. If they need longer, they must be substituted or charge their team a time-out.'
    },
    {
      id: 'r19_04',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '19.2.2',
      question: 'Can the thrower stop play to replace a badly damaged disc?',
      answer: 'Yes, by calling a technical stoppage',
      wrong: ['No, only between points', 'Only with a time-out', 'Only if the defence agrees'],
      explanation: 'The thrower may call a technical stoppage during play to replace a severely damaged disc.'
    },
    {
      id: 'r19_05',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '19.3',
      question: 'A player is substituted because of an injury. May the other team substitute too?',
      answer: 'Yes, one player',
      wrong: ['No', 'Yes, any number of players', 'Only if they also have an injury'],
      explanation: 'If a player is substituted after an injury or for faulty equipment, the opposing team may also substitute one player. Substitutes take over the full state of the player they replace.'
    },
    {
      id: 'r19_06',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '19.2.1',
      question: 'A dog runs onto the field during a point. What should a player call?',
      answer: 'Technical (or "Stop")',
      wrong: ['Injury', 'Violation', 'Time-out'],
      explanation: 'Any player who sees a condition that endangers players should call a technical stoppage ("Technical" or "Stop"). Play stops immediately.'
    },

    // 20. Time-Outs (indoor time-outs work differently, see the EUF appendix questions)
    {
      id: 'r20_01',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '20.3',
      question: 'After the pull, who may call a time-out?',
      answer: 'Only a thrower holding the disc',
      wrong: ['Any player during a stoppage', 'The captain of either team', 'Any player on the team with the disc'],
      explanation: 'Before the pull, a player from either team may call a time-out. After the pull, only a thrower in possession of the disc may.'
    },
    {
      id: 'r20_02',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '20.3',
      question: 'How long does a time-out last?',
      answer: '75 seconds',
      wrong: ['60 seconds', '90 seconds', '2 minutes'],
      explanation: 'A time-out lasts 75 seconds. Before the pull, it extends the time until the pull by 75 seconds.'
    },
    {
      id: 'r20_03',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '20.3.6',
      question: "After a thrower's time-out, with the same marker, where does the stall count restart?",
      answer: MAX_NINE,
      wrong: [STALLING_ONE, MAX_SIX, 'Where it stopped'],
      explanation: 'After a time-out the stall count restarts at maximum 9. If the marker has been switched, it restarts at "Stalling one".'
    },
    {
      id: 'r20_04',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '20.3.5',
      question: "After a thrower's time-out, how do players set up before play restarts?",
      answer: 'The offence picks positions first, then the defence',
      wrong: ['The defence sets up first', 'Everyone goes back to where they were', 'Both teams set up at the same time'],
      explanation: 'The thrower stays the same at the pivot. The other offensive players take stationary positions anywhere, then the defence takes theirs.'
    },
    {
      id: 'r20_05',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '20.4',
      question: 'During play, the thrower calls a time-out, but their team has none left. What happens?',
      answer: 'Play stops, and 2 is added to the stall count',
      wrong: ['Nothing: play continues', 'Turnover', 'The time-out is granted anyway'],
      explanation: 'Play stops and the marker adds 2 to the stall count they would have restarted on. If that reaches 10 or more, it is a stall-out.'
    },
    {
      id: 'r20_06',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '20.3.1',
      question: "During a thrower's time-out, may the teams make substitutions?",
      answer: 'Only for an injury',
      wrong: ['Yes, unlimited', 'Yes, one per team', 'No, never'],
      explanation: 'After a time-out called after the pull, substitutions are not allowed, except for injury.'
    }
  ]
}
