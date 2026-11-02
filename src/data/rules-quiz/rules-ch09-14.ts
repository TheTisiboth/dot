import { type QuizBatch } from '../../types'
import { ALL_MODES, OUTDOOR_ONLY } from './modes'

const STALLING_ONE = 'Stalling one'
const MAX_SIX = 'Where it stopped plus one, maximum 6'
const MAX_NINE = 'Where it stopped plus one, maximum 9'
const AT_BRICK_MARK = 'At the brick mark'
const GOAL_LINE_NEAREST = 'On the nearest point of the goal line'
const MINUS_TWO = 'Where it stopped minus two'
const OB_TURNOVER = 'Out-of-bounds turnover'
const PASS_REPLAYED = 'The pass is replayed'
const CENTRAL_ZONE_NEAREST = 'On the central zone, nearest to where it went out'

export const rulesCh09to14: QuizBatch = {
  source: {
    title: 'WFDF Rules of Ultimate 2025-2028 (CC BY 4.0)',
    url: 'https://rules.wfdf.sport/wp-content/uploads/2024/12/WFDF-Rules-of-Ultimate-2025-2028.pdf'
  },
  questions: [
    // 9. Stall Count
    {
      id: 'r9_01',
      difficulty: 'easy',
      modes: OUTDOOR_ONLY,
      ref: '9.1',
      question: 'Up to which number does the marker count in a stall count?',
      answer: '10',
      wrong: ['8', '9', '12'],
      explanation: 'The marker announces "Stalling" and counts from 1 to 10. It is a stall-out if the thrower has not released the disc when the marker starts saying "ten".'
    },
    {
      id: 'r9_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '9.1',
      question: 'What is the minimum time between two numbers of the stall count?',
      answer: '1 second',
      wrong: ['Half a second', '2 seconds', 'No minimum, as long as it is clear'],
      explanation: 'The interval between the start of each number in the stall count must be at least one second. Counting faster is a fast count.'
    },
    {
      id: 'r9_03',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '9.3.2',
      question: "How close to the thrower's pivot must the marker be to stall?",
      answer: 'Within 3 metres',
      wrong: ['Within 1 metre', 'Within 2 metres', 'Within 5 metres'],
      explanation: "The marker may only stall when within 3 metres of the thrower's pivot point (or the pivot location if the thrower is not there), and all defenders are legally positioned."
    },
    {
      id: 'r9_04',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '9.4',
      question: 'The defence switches markers in the middle of a stall count. Where does the new marker start?',
      answer: STALLING_ONE,
      wrong: ['Where the previous marker stopped', MINUS_TWO, 'Stalling five'],
      explanation: 'If a different player becomes the marker, or the marker moves beyond 3 metres, the stall count restarts at "Stalling one".'
    },
    {
      id: 'r9_05',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '9.5.1',
      question: 'The thrower calls a marking foul and the marker accepts it. Where does the stall count restart?',
      answer: STALLING_ONE,
      wrong: ['Where it stopped', 'Where it stopped plus one', MINUS_TWO],
      explanation: 'After an accepted breach by the defence, the stall count restarts at "Stalling one".'
    },
    {
      id: 'r9_06',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '9.5.2',
      question: 'The thrower accepts a travel call. Where does the stall count restart?',
      answer: MAX_NINE,
      wrong: [STALLING_ONE, MAX_SIX, 'Stalling eight'],
      explanation: 'After an accepted breach by the offence, the stall count restarts at maximum 9: the last agreed number plus one, but never higher than 9.'
    },
    {
      id: 'r9_07',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '9.5.3',
      question: 'The thrower contests a stall-out. Where does the stall count restart?',
      answer: 'Stalling eight',
      wrong: [STALLING_ONE, MAX_SIX, 'Stalling nine'],
      explanation: 'After a contested stall-out, the stall count restarts at "Stalling eight".'
    },
    {
      id: 'r9_08',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '9.5.5',
      question: 'After a pick call, where does the stall count restart?',
      answer: MAX_SIX,
      wrong: [STALLING_ONE, MAX_NINE, 'Where it stopped'],
      explanation: 'After all other calls, including "pick", the stall count restarts at maximum 6.'
    },
    {
      id: 'r9_09',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '9.6',
      question: 'A foul is contested at "Stalling 4". Where does the stall count restart?',
      answer: 'Stalling 5',
      wrong: ['Stalling 4', 'Stalling 6', 'Stalling 1'],
      explanation: 'A contested foul restarts at maximum 6: the last agreed number plus one (4 + 1 = 5), or 6, whichever is lower.'
    },
    {
      id: 'r9_10',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '9.6',
      question: 'A foul is contested at "Stalling 8". Where does the stall count restart?',
      answer: 'Stalling 6',
      wrong: ['Stalling 8', 'Stalling 9', 'Stalling 1'],
      explanation: 'A contested foul restarts at maximum 6: the last agreed number plus one (8 + 1 = 9), or 6, whichever is lower.'
    },
    {
      id: 'r9_11',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '9.5.5.2',
      question: 'Before the check, a defender moves and the offence calls a violation. Where does the stall count restart?',
      answer: 'At the count already agreed before that violation',
      wrong: [STALLING_ONE, 'Where it stopped plus one', MINUS_TWO],
      explanation: 'After a violation related to the check, the stall count resumes at the count determined before that violation, even if the violation was by the defence.'
    },
    {
      id: 'r9_12',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '9.3.1',
      question: 'After an interception, when may the marker start stalling?',
      answer: 'Once the thrower has established a pivot',
      wrong: ['As soon as the interceptor catches the disc', 'Only after a check', 'After 3 seconds'],
      explanation: 'The marker may only stall while play is live, or once a pivot is established after a turnover. An interceptor who is still running must stop and establish a pivot first.'
    },

    // 10. The Check
    {
      id: 'r10_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '10.6.1.1',
      question: 'Play restarts with the thrower holding the disc and a defender within reach. How is the disc checked in?',
      answer: 'The defender touches the disc',
      wrong: ['The thrower touches the disc to the ground', 'The thrower taps the defender with the disc', 'The marker calls "disc in" without touching it'],
      explanation: 'When the thrower has the disc and a defender is within reach, the defender must touch the disc. The thrower cannot start the check by tapping the defender.'
    },
    {
      id: 'r10_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '10.6.1.2',
      question: 'Play restarts with no defender within reach of the thrower. How is the disc checked in?',
      answer: 'The thrower touches the disc to the ground',
      wrong: ['The nearest defender calls "disc in"', 'The thrower waits for a defender to come', 'Play restarts after 5 seconds'],
      explanation: 'If no defender is within reach, the thrower must touch the disc to the ground, and may call "disc in".'
    },
    {
      id: 'r10_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '10.6.2',
      question: 'The disc is on the ground when play restarts. How is it checked in?',
      answer: 'The defender nearest to the disc calls "disc in"',
      wrong: ['The nearest offensive player calls "disc in"', 'The thrower picks it up', 'Any player touches it'],
      explanation: 'When the disc is on the ground, the defender nearest to the disc must call "disc in".'
    },
    {
      id: 'r10_04',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '10.7.5',
      question: 'The thrower restarts without a check and completes a pass. The defence calls a violation. What happens?',
      answer: "The pass doesn't count and the disc goes back to the thrower",
      wrong: ['The pass stands', 'Turnover', 'The receiver keeps the disc and play restarts with a check'],
      explanation: 'After a violation regarding the check, any pass does not count, complete or not, and possession goes back to the thrower.'
    },
    {
      id: 'r10_05',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '10.2.1',
      question: 'Play stops for a call before any pass is thrown. Where must the players be for the check?',
      answer: 'Where they were when the call was made',
      wrong: ['Anywhere, as long as they are stationary', 'Where they were at the last catch', 'Where they are now'],
      explanation: 'If play stops before a pass is thrown, all players return to where they were when the call was made, and stay stationary until the check.'
    },
    {
      id: 'r10_06',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '10.2.2.1',
      question: 'After a long pass, a receiving foul is contested and the disc goes back to the thrower. Where do players restart?',
      answer: 'Where they were when the pass was released (or the call, if earlier)',
      wrong: ['Where they stopped after the play', 'Where the disc landed', 'Anywhere, as long as they are stationary'],
      explanation: 'If the disc goes back to the thrower, players return to where they were when the pass was released, or at the time of the call if that was earlier.'
    },
    {
      id: 'r10_07',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '10.5',
      question: 'The defence keeps delaying the check even after a "delay of game" warning. What may the offence do?',
      answer: 'Check the disc in themselves by calling "disc in"',
      wrong: ['Claim a turnover', 'Ask the captains to decide', 'Throw without any check'],
      explanation: 'If the delay continues after a warning, the team that warned may check the disc in by calling "disc in", without verification, as long as they are stationary and correctly positioned.'
    },
    {
      id: 'r10_08',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '10.3',
      question: 'Your shoelace comes undone. When may you stop play to fix it?',
      answer: 'Only by briefly extending an existing stoppage',
      wrong: ['Any time, by calling "equipment"', 'Only after a time-out', 'Never'],
      explanation: 'Any player may briefly extend a stoppage to fix faulty equipment ("equipment"), but active play may not be stopped for this.'
    },

    // 11. Out-of-Bounds
    {
      id: 'r11_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '11.4.1',
      question: 'A receiver catches the disc with one foot touching the sideline. What happens?',
      answer: OB_TURNOVER,
      wrong: ['Catch: the line is in-bounds', 'Catch, if the other foot is in-bounds', PASS_REPLAYED],
      explanation: 'The perimeter lines are out-of-bounds. If any part of the receiver is out-of-bounds when they contact the disc, it is an out-of-bounds turnover.'
    },
    {
      id: 'r11_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '11.2',
      question: 'A defender is standing out-of-bounds. Are they considered out-of-bounds?',
      answer: 'No, defenders are always in-bounds',
      wrong: ['Yes, like any player', 'Only if they touch the disc', 'Only behind the end line'],
      explanation: 'Defensive players are always considered "in-bounds". A defender touching the disc while standing outside the field does not make the disc out.'
    },
    {
      id: 'r11_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '11.3.1',
      question: 'A receiver jumps from in-bounds, catches the disc and throws it before landing out-of-bounds. Is the pass valid?',
      answer: 'Yes, they stay in-bounds until they land',
      wrong: ['No, it is a turnover', 'Only if the pass is caught in the end zone', 'Only if no defender touched it'],
      explanation: 'An airborne player keeps their in-bounds status until they touch the ground. This "greatest" is a valid pass, but the thrower may not catch it themselves.'
    },
    {
      id: 'r11_04',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '11.3.2',
      question: 'A receiver catches the disc in-bounds and their momentum carries them out-of-bounds. Is it a catch?',
      answer: 'Yes, if they keep the catch until establishing possession',
      wrong: ['No, it is an out-of-bounds turnover', 'Only if they stop within 3 metres', 'Only in the central zone'],
      explanation: 'A player who caught the disc in-bounds and then goes out-of-bounds is still in-bounds, as long as they maintain the catch until they establish possession.'
    },
    {
      id: 'r11_05',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '11.3.2.1',
      question: 'A receiver catches in-bounds and their momentum carries them out over the sideline. Where do they put the disc into play?',
      answer: 'Where they crossed the sideline',
      wrong: ['Where they caught it', AT_BRICK_MARK, 'Anywhere along the sideline'],
      explanation: 'If they leave the playing field after a catch, they must establish a pivot where they crossed the perimeter line.'
    },
    {
      id: 'r11_06',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '11.4.2',
      question: 'An airborne receiver catches the disc and their first foot lands out-of-bounds, still holding it. What happens?',
      answer: OB_TURNOVER,
      wrong: ['Catch, with a pivot where they crossed the line', 'Catch, if their second foot lands in-bounds', PASS_REPLAYED],
      explanation: "If, after catching while airborne, the receiver's first contact is out-of-bounds while still holding the disc, it is an out-of-bounds turnover and no catch occurred."
    },
    {
      id: 'r11_07',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '11.7',
      question: 'A pass flies outside the sideline, then curves back in and is caught in-bounds. What happens?',
      answer: 'Valid catch, play on',
      wrong: [OB_TURNOVER, 'Turnover unless a defender touched it', PASS_REPLAYED],
      explanation: 'The disc may fly outside a perimeter line and return to the field. It only becomes out when it contacts the out-of-bounds area or an out-of-bounds offensive player.'
    },
    {
      id: 'r11_08',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '11.3.4',
      question: 'A receiver standing in-bounds catches the disc while leaning on a team-mate who is out-of-bounds. Is the catch in?',
      answer: "Yes, contact doesn't pass on out-of-bounds status",
      wrong: ['No, it is out-of-bounds', 'Only if the receiver is airborne', PASS_REPLAYED],
      explanation: 'Contact between players does not confer the state of being in- or out-of-bounds from one to another.'
    },
    {
      id: 'r11_09',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '11.9',
      question: 'The disc rolls far out-of-bounds. May someone on the sideline fetch it?',
      answer: 'Yes, but the thrower carries it the last 3 metres',
      wrong: ['No, only the thrower may touch it', 'Yes, and hand it straight to the thrower on the line', 'Only a defender may fetch it'],
      explanation: 'If the disc is out-of-bounds and more than 3 metres from the pivot location, non-players may retrieve it. The thrower must carry it the last 3 metres to the field.'
    },
    {
      id: 'r11_10',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '11.3.3',
      question: 'Holding the disc, the thrower steps on the sideline while pivoting. What happens?',
      answer: 'Nothing: they are in-bounds until they throw',
      wrong: [OB_TURNOVER, 'Travel', 'They must step back before the stall continues'],
      explanation: 'A thrower who contacts an out-of-bounds area is considered in-bounds until they make a pass.'
    },

    // 12. Receivers and Positioning
    {
      id: 'r12_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '12.1',
      question: 'What counts as a catch?',
      answer: 'A non-spinning disc trapped between at least two body parts',
      wrong: ['Any touch with both hands', 'A spinning disc held in one hand', 'Holding the disc for 3 seconds'],
      explanation: 'A catch occurs when a player has a non-spinning disc trapped between at least two body parts.'
    },
    {
      id: 'r12_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '12.3',
      question: 'An offensive and a defensive player catch the disc at the same time. Who gets it?',
      answer: 'The offence',
      wrong: ['The defence', PASS_REPLAYED, 'Decided by a disc flip'],
      explanation: 'If offensive and defensive players catch the disc simultaneously, the offence retains possession.'
    },
    {
      id: 'r12_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '12.6.1',
      question: 'A defender collides with a stationary receiver while going for the disc. Is "I was making a play for the disc" an excuse?',
      answer: 'No, it never justifies initiating contact',
      wrong: ['Yes, if they touched the disc first', 'Yes, in the end zone', 'Yes, if the receiver did not see them'],
      explanation: '"Making a play for the disc" is not a valid excuse for initiating contact. There is no situation where a player may justify initiating contact.'
    },
    {
      id: 'r12_04',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '12.7.3',
      question: 'It is unclear who initiated a contact, but one of the two players dived. Who is deemed to have initiated it?',
      answer: 'The player who dived',
      wrong: ['The player who was standing', 'The offensive player', 'Nobody: play on'],
      explanation: 'If it is unclear who initiated contact and one player dived, leaped or jumped away from their position, that player is deemed to have initiated contact.'
    },
    {
      id: 'r12_05',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '12.8',
      question: 'Two players run towards the same spot and bump shoulders lightly. Is it a foul?',
      answer: 'No, minor contact is not a foul',
      wrong: ['Yes, always', 'Yes, against the defender', 'Yes, against the slower player'],
      explanation: 'Some minor contact may occur when players move towards a single point simultaneously. It should be minimised but is not a foul.'
    },
    {
      id: 'r12_06',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '12.9',
      question: "May a player stick out their arms to block an opponent's path?",
      answer: 'No, never',
      wrong: ['Yes, when guarding someone', 'Yes, if they are stationary', 'Only on defence'],
      explanation: 'Players may not use extended arms or legs to obstruct the movement of opponents. Arms are not considered extended during normal running and jumping.'
    },
    {
      id: 'r12_07',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '12.5.1',
      question: 'While the disc is in the air, may a player move only to stop an opponent reaching the disc, without playing it themselves?',
      answer: 'No, not solely to block their path',
      wrong: ['Yes, anything goes while the disc is in the air', 'Yes, as long as there is no contact', 'Only defenders may do it'],
      explanation: 'When the disc is in the air, a player may not move in a manner solely to prevent an opponent from taking an unoccupied path to make a play on the disc.'
    },
    {
      id: 'r12_08',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '12.4',
      question: 'A player is standing still in an established position. May an opponent run into them?',
      answer: 'No, they are entitled to that position',
      wrong: ['Yes, if going for the disc', 'Yes, in the end zone', 'Yes, if they are on offence'],
      explanation: 'A player in an established position is entitled to remain there and must not be contacted by an opponent.'
    },
    {
      id: 'r12_09',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '12.10',
      question: 'A defender throws their hat and knocks down a pass. What happens?',
      answer: 'Violation: the intended receiver gets the disc',
      wrong: ['Turnover: it counts as a block', PASS_REPLAYED, 'Foul: the disc goes back to the thrower'],
      explanation: 'No player may use an item of equipment or object to contact the disc. For a defender this is a violation, and the intended receiver is awarded possession.'
    },

    // 13. Turnovers
    {
      id: 'r13_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '13.1.2',
      question: 'A defender catches a pass. What is this turnover called?',
      answer: 'An interception',
      wrong: ['A down', 'A handover', 'A deflection'],
      explanation: 'A defensive player establishing possession of a pass is an "interception".'
    },
    {
      id: 'r13_02',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '13.2.2',
      question: 'When exactly is it a stall-out?',
      answer: 'If the disc is not released when the marker starts saying "ten"',
      wrong: ['Once the marker has finished saying "ten"', 'When the marker says "nine"', 'After 10 seconds, whatever the count'],
      explanation: 'It is a stall-out if the thrower has not released the pass before the marker first starts to say the word "ten".'
    },
    {
      id: 'r13_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '13.2.5',
      question: 'The thrower throws, then catches their own pass before anyone else touches it. What happens?',
      answer: 'Turnover (self-catch)',
      wrong: ['Legal: play on', 'Travel', PASS_REPLAYED],
      explanation: 'Catching your own pass before another player touches it is a "self-catch" turnover.'
    },
    {
      id: 'r13_04',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '13.2.3',
      question: 'The thrower hands the disc to a team-mate, both holding it at the same time. What happens?',
      answer: 'Turnover (handover)',
      wrong: ['Legal pass', 'Travel', 'Violation: the disc goes back to the thrower'],
      explanation: 'Intentionally transferring the disc to a team-mate without it ever being completely untouched by both players is a "handover" turnover.'
    },
    {
      id: 'r13_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '13.1.1.1',
      question: 'A receiver catches the disc, then the disc touches the ground while they still hold it. Is it a down?',
      answer: 'No, as long as they keep the catch',
      wrong: ['Yes, it is a turnover', 'Only in the end zone', 'Yes, unless they caught it with two hands'],
      explanation: 'It is not "down" if a receiver catches a pass before the disc contacts the ground, and maintains the catch while the disc touches the ground.'
    },
    {
      id: 'r13_06',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '13.5.1',
      question: 'After an interception, may a team-mate of the interceptor take the disc instead?',
      answer: 'No, the interceptor must keep it',
      wrong: ['Yes, any team-mate', 'Yes, if they are closer to the end zone', 'Only if the interceptor drops it'],
      explanation: 'After an interception, the player who made the interception must maintain possession.'
    },
    {
      id: 'r13_07',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '13.7.1',
      question: 'A pass falls incomplete in the central zone and rolls. Where is the pivot?',
      answer: 'Where the disc stops, or is picked up',
      wrong: ['Where it first touched the ground', 'Where the thrower stood', 'On the nearest sideline'],
      explanation: 'The turnover location is where the disc comes to a stop or is picked up by an offensive player. In the central zone, the pivot is at that location.'
    },
    {
      id: 'r13_08',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '13.10',
      question: 'After a turnover, the disc stops in the end zone the new offence is attacking. Where is the pivot?',
      answer: GOAL_LINE_NEAREST,
      wrong: ['Where the disc stopped', AT_BRICK_MARK, 'At the centre of the goal line'],
      explanation: "If the turnover location is in the offence's attacking end zone, the pivot is at the nearest point on the goal line."
    },
    {
      id: 'r13_09',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '13.11',
      question: 'After a turnover, the disc stops in the end zone the new offence is defending. Where may the pivot be?',
      answer: 'Where it stopped, or on the nearest point of the goal line',
      wrong: ['Only on the goal line', 'Only where it stopped', AT_BRICK_MARK],
      explanation: 'In the defending end zone, the thrower chooses: stay at the turnover location (or fake a pass), or move to the nearest point on the goal line. The choice cannot be reversed.'
    },
    {
      id: 'r13_10',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '13.11.2.1',
      question: 'After a turnover in their defending end zone, how can the thrower signal they want to take the disc to the goal line?',
      answer: 'Fully extend one arm above their head',
      wrong: ['Point at the goal line', 'Call "line"', 'Tap the disc on the ground'],
      explanation: 'Before picking up the disc, the intended thrower may signal the goal line option by fully extending one arm above their head.'
    },
    {
      id: 'r13_11',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '13.8',
      question: 'A pass sails out-of-bounds over the sideline. Where is the new pivot?',
      answer: CENTRAL_ZONE_NEAREST,
      wrong: ['Where the disc landed', AT_BRICK_MARK, 'Where the thrower stood'],
      explanation: 'If the disc went out-of-bounds, the pivot is at the spot on the central zone nearest to where it went out-of-bounds.'
    },
    {
      id: 'r13_12',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '13.6',
      question: 'After a turnover, the new thrower deliberately puts the disc down on the ground. What happens?',
      answer: 'They must pick it up again and restart with a check',
      wrong: ['Turnover', 'Play on', 'Any team-mate may pick it up and play on'],
      explanation: 'If the player in possession after a turnover intentionally drops or places the disc on the ground, they must re-establish possession and restart play with a check.'
    },

    // 14. Scoring
    {
      id: 'r14_01',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '14.1.1',
      question: 'A receiver catches the disc with one foot in the end zone and the other on the goal line. Is it a goal?',
      answer: 'No, the goal line is not part of the end zone',
      wrong: ['Yes', 'Yes, if the end zone foot landed first', PASS_REPLAYED],
      explanation: 'All ground contacts must be entirely within the attacking end zone. The goal line belongs to the central zone, so the receiver takes the disc to the goal line.'
    },
    {
      id: 'r14_02',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '14.3',
      question: 'A receiver catches the disc in the central zone and their momentum carries them into the end zone. What happens?',
      answer: 'No goal: they take the disc to the nearest point on the goal line',
      wrong: ['Goal', 'Goal, if they stop in the end zone', 'Turnover'],
      explanation: 'A player in possession who ends up in their attacking end zone without scoring must establish a pivot at the nearest point on the goal line.'
    },
    {
      id: 'r14_03',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '14.1.1',
      question: 'An airborne receiver catches the disc and lands on both feet at once: one in the end zone, one in the central zone. Is it a goal?',
      answer: 'No, all first ground contacts must be in the end zone',
      wrong: ['Yes', 'Yes, if their weight is in the end zone', PASS_REPLAYED],
      explanation: 'For an airborne player, all of their first simultaneous points of ground contact after the catch must be entirely within the attacking end zone.'
    },
    {
      id: 'r14_04',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '14.1.2',
      question: 'A receiver dives, catches the disc in the end zone, then loses it when hitting the ground. Is it a goal?',
      answer: 'No, they must keep the catch through ground contact',
      wrong: ['Yes, the catch counts', 'Yes, if a team-mate picks it up', PASS_REPLAYED],
      explanation: 'A goal requires establishing possession and maintaining the catch throughout all ground contact related to the catch.'
    },
    {
      id: 'r14_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '14.4',
      question: 'At what moment is a goal deemed to be scored?',
      answer: 'When the receiver establishes possession',
      wrong: ['When the disc crosses the goal line', 'When the pass is released', 'When someone calls "goal"'],
      explanation: 'A goal is deemed scored when the player establishes possession of the disc.'
    }
  ]
}
