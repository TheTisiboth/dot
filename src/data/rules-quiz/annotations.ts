import { type QuizBatch } from '../../types'
import { ALL_MODES, OUTDOOR_ONLY } from './modes'

const BACK_TO_THROWER = 'The disc goes back to the thrower'
const TURNOVER_STANDS = 'The turnover stands'
const A_TURNOVER = 'A turnover'
const ALLOWED = 'Nothing: it is allowed'
const POINT_REPLAYED = 'The point is replayed'

// Each ref is the rule the annotation explains; its urules.org page shows the annotation inline
export const annotations: QuizBatch = {
  source: {
    title: 'WFDF Rules of Ultimate 2025-2028 - Official Annotations (CC BY 4.0)',
    url: 'https://rules.wfdf.sport/wp-content/uploads/2026/07/WFDF-Rules-of-Ultimate-2025-2028-Official-Annotations.pdf'
  },
  questions: [
    // Spirit of the Game
    {
      id: 'ann_01',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '1.3.9',
      question: 'Minor travels were not called early in the game. Now the score is close near the end. Should players start calling them?',
      answer: 'No, calls should stay consistent all game',
      wrong: ['Yes, the end of the game matters more', 'Yes, but only in the end zone', 'Only if the captains agree'],
      explanation: 'Players should make calls without taking the game context into account. If minor travels were not called at the start, they should not be called later.'
    },
    {
      id: 'ann_02',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.3.10',
      question: 'The thrower set their pivot 1 cm away from the correct spot. Should the marker call travel?',
      answer: 'No, it is too small to matter',
      wrong: ['Yes, any wrong pivot is a travel', 'Yes, and restart the count at one', 'Only if the thrower then completes a pass'],
      explanation: 'Players should tolerate minor breaches involving small differences in distance or time. A pivot 1 cm off does not affect the outcome.'
    },
    {
      id: 'ann_03',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '1.6.3',
      question: 'A defender yells loudly at a receiver just as they are about to catch, to distract them. What is it?',
      answer: 'Intimidation, a clear Spirit violation',
      wrong: [ALLOWED, 'A foul', 'A marking infraction'],
      explanation: 'Yelling at an opponent to distract them as they catch is intimidating behaviour, a clear Spirit of the Game violation. Normal actions, like bidding in front of someone, are not.'
    },
    {
      id: 'ann_04',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.6.4',
      question: "After scoring, a player spikes the disc at an opponent's feet. What is it?",
      answer: 'Disrespectful celebration, a Spirit violation',
      wrong: [ALLOWED, 'A foul', A_TURNOVER],
      explanation: 'Spiking directed at an opponent, or taunting them by "showing" them the disc, is disrespectful celebration and must be avoided.'
    },
    {
      id: 'ann_05',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '1.12',
      question: 'What is the suggested maximum length of a stoppage to discuss a call?',
      answer: '45 seconds',
      wrong: ['30 seconds', '75 seconds', '2 minutes'],
      explanation: 'Discussions should be as brief as possible. The suggested maximum is 45 seconds; once no agreement is in sight, the disc goes back to the last non-disputed thrower.'
    },
    {
      id: 'ann_06',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '1.10.2',
      question: 'A spectator on the sideline shouts "Foul!" during play. Does play stop?',
      answer: 'No, non-players cannot make calls',
      wrong: ['Yes, any call stops play', 'Yes, if they had a good view', 'Only if a captain agrees'],
      explanation: 'Non-players must not make calls, or use call terms or hand signals towards the field. They may only give their perspective when a player involved asks them.'
    },

    // Field and equipment
    {
      id: 'ann_07',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '2.1',
      question: 'How big is a full-size outdoor field?',
      answer: '100 × 37 m, with 18 m end zones',
      wrong: ['100 × 37 m, with 25 m end zones', '110 × 40 m, with 20 m end zones', '80 × 30 m, with 15 m end zones'],
      explanation: 'The field is 100 m long by 37 m wide: a 64 m central zone and two 18 m end zones. If space is short, end zones are shortened before the central zone.'
    },
    {
      id: 'ann_08',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '2.1',
      question: 'There are no lines, and the sideline cones are not in a straight line. Where is the sideline?',
      answer: 'The line between the two cones of the zone you are in',
      wrong: ['A straight line between the two corner cones', 'Wherever the closest cone is', 'Whatever the captains agree before each point'],
      explanation: 'Without markings, the sideline is the line between the two cones of the zone the player is in: the goal line cones in the central zone, the end zone cones in an end zone.'
    },
    {
      id: 'ann_09',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '3.4',
      question: 'Which footwear is not allowed?',
      answer: 'Fully metallic studs',
      wrong: ['Moulded plastic studs', 'Indoor court shoes', 'Running shoes'],
      explanation: 'Fully metallic, long, or sharp-edged studs are not allowed, nor are items like watches, bracelets or protruding jewellery that could harm players.'
    },

    // Pull and state of play
    {
      id: 'ann_10',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '7.2',
      question: 'After signalling readiness, may the pulling team switch to a different puller?',
      answer: 'Yes, any time before the pull',
      wrong: ['No, the puller is fixed once ready', 'Only after a time-out', 'Only if the offence agrees'],
      explanation: 'The puller is the defender who throws the pull. The pulling team may designate a new puller at any time before the pull.'
    },
    {
      id: 'ann_11',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '7.12',
      question: 'One receiver signals and calls "brick". May a different receiver pick up the disc?',
      answer: 'Yes',
      wrong: ['No, the player who signalled must take it', 'Only if the defence agrees', 'Only from the brick mark'],
      explanation: 'If an offensive player signals and calls brick, a different offensive player may pick up the disc.'
    },
    {
      id: 'ann_12',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '8.1.4',
      question: 'After a turnover, the new offence tries to pick up the disc from the ground but fumbles it. Is it another turnover?',
      answer: 'No, unless they had full control of it',
      wrong: ['Yes, always', 'Yes, if it touches the ground again', 'Only in the central zone'],
      explanation: 'After a turnover or pull that hit the ground, a failed pick-up is not a new turnover, unless the offence had full control of the disc first.'
    },

    // Stall count and check
    {
      id: 'ann_13',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '9.3',
      question: 'A receiver dives for a catch and is still on the ground. When may the marker start the stall count?',
      answer: 'As soon as the catch is made',
      wrong: ['Once the thrower is standing', 'Once a pivot is established', 'After a check'],
      explanation: 'The marker may start the count as soon as the thrower has caught the disc, even if they still need to stop or get up after a dive. After an interception, they must wait for the pivot.'
    },
    {
      id: 'ann_14',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '9.6',
      question: 'Thrower and marker disagree on the restart count: one says 4, the other says 7. Which count is used?',
      answer: 'Stalling 5',
      wrong: ['Stalling 4', 'Stalling 6', 'Stalling 7'],
      explanation: 'If players cannot agree on the restart count, the midpoint is used, rounded down: (4 + 7) / 2 = 5.5, so 5.'
    },
    {
      id: 'ann_15',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '10.1',
      question: 'Does play restart with a check after a turnover?',
      answer: 'No, the thrower can play as soon as the pivot is set',
      wrong: ['Yes, always', 'Only after an out-of-bounds turnover', 'Only if the defence asks for it'],
      explanation: 'No check is needed after a pull or a turnover. The thrower can pass, and the marker can count, as soon as the pivot is established at the correct spot.'
    },
    {
      id: 'ann_16',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '10.7',
      question: 'A defender notices their own team-mate moving before the check. Can they call a violation?',
      answer: 'No, not against their own team',
      wrong: ['Yes, any player can', 'Yes, but only the marker', 'Only if the offence agrees'],
      explanation: 'A player cannot call a check violation because someone on their own team (including themselves) is in the wrong position or moving.'
    },

    // Out-of-bounds
    {
      id: 'ann_17',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '11.4.1',
      question: 'As a receiver catches the disc in-bounds, their hair touches the ground out-of-bounds. Is it a catch?',
      answer: 'No, they are out-of-bounds',
      wrong: ['Yes, only feet count', 'Yes, hair and clothing never count', 'Only if they were airborne'],
      explanation: 'Any part of the receiver touching out-of-bounds counts: if their hair or clothing touches the ground out-of-bounds, they are out-of-bounds.'
    },
    {
      id: 'ann_18',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '11.4',
      question: 'A defender shouts "Check feet!" after a catch near the sideline. Does play stop?',
      answer: 'No, "check feet" is not a call',
      wrong: ['Yes, it is an out-of-bounds call', 'Yes, until the receiver answers', 'Only if the thrower heard it'],
      explanation: '"Check feet" is not a call and does not stop play. If you think the receiver was out, call "Out" immediately, but only if you are reasonably certain.'
    },
    {
      id: 'ann_19',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '11.2',
      question: 'A defender jumps, intercepts a pass and lands out-of-bounds. What happens?',
      answer: 'The defence keeps the disc',
      wrong: ['Out-of-bounds: the offence gets it back', BACK_TO_THROWER, 'The pass is replayed'],
      explanation: 'Defenders are always in-bounds, so this is not a "double turnover": the defender keeps possession.'
    },
    {
      id: 'ann_20',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '11.3.2',
      question: 'A receiver catches in-bounds, runs out-of-bounds, fumbles the disc before establishing possession, and grabs it again. What happens?',
      answer: 'Out-of-bounds turnover',
      wrong: ['Catch: they got it back before it hit the ground', 'Catch, with a pivot where they crossed the line', 'The pass is replayed'],
      explanation: 'Once they touch out-of-bounds, fumbling before establishing possession is an out-of-bounds turnover, even if they regain the disc before it hits the ground.'
    },
    {
      id: 'ann_21',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '13.8',
      question: 'After an out-of-bounds turnover, may the thrower set their pivot right on the sideline?',
      answer: 'Yes, that is acceptable',
      wrong: ['No, it must be 1 metre inside', 'No, that is a travel', 'Only if the defence agrees'],
      explanation: 'The official spot is just inside the line, but a pivot on the line is also acceptable: the difference is too small to matter.'
    },

    // Receivers and positioning
    {
      id: 'ann_22',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '12.7.1',
      question: 'Player A, chasing the disc, slows down to stay between Player B and the disc. B runs into the back of A and they both fall. Who fouled?',
      answer: 'Player B',
      wrong: ['Player A', 'Both: offsetting fouls', 'Nobody: it is minor contact'],
      explanation: 'A may slow down to make a play on the disc. B could reasonably have avoided A, so B initiated the contact. A trailing player running into the player in front is nearly always the one fouling.'
    },
    {
      id: 'ann_23',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '12.5.1',
      question: "Two team-mates chase a pass. The one who isn't going for the disc moves side to side to block a defender. What can the defender call?",
      answer: 'A violation',
      wrong: [ALLOWED, 'A pick', 'A foul, even without contact'],
      explanation: 'A player not making a play on the disc may not move to impede an opponent who is. Standing still is fine, but moving (or sticking arms out) to block is a violation.'
    },

    // Turnovers and scoring
    {
      id: 'ann_24',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '13.11.3',
      question: 'After a turnover in their defending end zone, the thrower picks up the disc, looks downfield for options, then walks to the goal line. Is that allowed?',
      answer: 'No, it is a travel',
      wrong: ['Yes, the choice is free until they throw', 'Yes, if they signalled first', 'Only if the defence is not set'],
      explanation: 'Staying, faking or moving decides the pivot location immediately and cannot be reversed. Picking up, looking, then moving to the goal line is a travel.'
    },
    {
      id: 'ann_25',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '14.1',
      question: 'A defender intercepts a pass inside the end zone they are attacking. What happens?',
      answer: 'Goal for the defence (a "Callahan")',
      wrong: ['The defender takes the disc to the goal line', 'Turnover, play on', BACK_TO_THROWER],
      explanation: 'A goal is scored when a player catches a legal pass in their attacking end zone. The pass does not have to come from a team-mate.'
    },
    {
      id: 'ann_26',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '14.1',
      question: "A receiver catches in the end zone without realising it, throws another pass, and it is dropped. What's the result?",
      answer: 'Goal',
      wrong: [TURNOVER_STANDS, BACK_TO_THROWER, POINT_REPLAYED],
      explanation: 'The scorer does not need to know they scored. The disc cannot be thrown after a goal, so the extra pass is disregarded.'
    },
    {
      id: 'ann_27',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '14.1.2',
      question: 'In the end zone, a receiver claps the disc between their hands for an instant, then loses it and it hits the ground. Is it a goal?',
      answer: 'No, it is a "clap spike"',
      wrong: ['Yes, the disc was caught', 'Yes, if both feet were in', BACK_TO_THROWER],
      explanation: 'The catch was not maintained for more than one noticeable instant, so possession was never established: no goal, and the disc is down.'
    },
    {
      id: 'ann_28',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '14.2',
      question: 'A receiver thinks they scored and starts celebrating, but one foot was on the goal line. What does the celebration count as?',
      answer: 'A "goal" call: play stops',
      wrong: ['Nothing: play continues', A_TURNOVER, 'A Spirit violation'],
      explanation: 'Behaving as if you scored (e.g. celebrating) is treated as a "goal" call. It stops play, and any play after it does not stand.'
    },

    // Calls and continuation
    {
      id: 'ann_29',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '15.1',
      question: 'Two players collide by accident, with non-minor contact. Can it be a foul?',
      answer: 'Yes, a foul does not need to be intentional',
      wrong: ['No, only intentional contact is a foul', 'Only if someone is hurt', 'No, it is a violation'],
      explanation: 'Non-minor contact that happens accidentally is still a foul. In fact there should be no intentional contact in Ultimate.'
    },
    {
      id: 'ann_30',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.5',
      question: 'A receiver sees the marker straddling and shouts "Straddle!". What effect does it have?',
      answer: 'None: only the thrower can call it',
      wrong: ['The stall count is reduced', 'Play stops', 'The marker must step back'],
      explanation: 'Only the thrower may call marking infractions, except double team. Others may alert the thrower, and the thrower can then make the call.'
    },
    {
      id: 'ann_31',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.8',
      question: 'The marker notices at "Stalling 6" that the thrower set the pivot in the wrong spot. Can they still call travel?',
      answer: 'No, it is too late',
      wrong: ['Yes, any time before the throw', 'Yes, and the count restarts at one', 'Only if the thrower agrees'],
      explanation: 'Calls must be made immediately. A player who had a reasonable chance to notice the breach but played on should not call it later.'
    },
    {
      id: 'ann_32',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '15.9.2',
      question: 'A defender wrongly tells a receiver to stop, and the pass to that receiver falls incomplete. What happens?',
      answer: 'The disc goes back to the thrower, stall count at one',
      wrong: [TURNOVER_STANDS, POINT_REPLAYED, 'The receiver gets the disc where they stopped'],
      explanation: 'After an incorrect stoppage, if the other team did not keep possession, the disc goes back to the thrower. The stall count resumes as after an accepted breach by the defender: "Stalling 1".'
    },
    {
      id: 'ann_33',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '16.3',
      question: 'The thrower calls a foul on the marker while throwing. The pass flies perfectly to an open receiver, who drops it. What happens?',
      answer: TURNOVER_STANDS,
      wrong: [BACK_TO_THROWER, 'The receiver gets the disc', POINT_REPLAYED],
      explanation: 'The foul did not affect the turnover: the receiver dropped an easy catch. If the foul had changed the throw, the disc would go back to the thrower.'
    },
    {
      id: 'ann_34',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '16.3',
      question: 'A pick is called in the stack while a pass is in the air on the other side of the field. The pass is caught. What happens?',
      answer: 'The catch stands; the picked defender recovers their position',
      wrong: [BACK_TO_THROWER, 'Turnover', POINT_REPLAYED],
      explanation: 'The pick did not affect the possession, so the completion stands, and the defender who called pick moves to where they should have been.'
    },
    {
      id: 'ann_35',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '16.2',
      question: 'While the thrower is in the act of throwing, the dump receiver calls a foul. What should happen?',
      answer: 'Play stops immediately',
      wrong: ['Play continues until possession is established', 'Turnover', 'Nothing: only the thrower can stop play'],
      explanation: 'Continuation does not apply to calls not involving the thrower made during the throw. If the pass was clearly not affected by the call, its result can still stand (16.3).'
    },

    // Fouls
    {
      id: 'ann_36',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.1.1',
      question: 'You could have reached the disc, but only by crashing into an opponent, so you hold back. Can you call dangerous play?',
      answer: 'No, you just refrain from the play',
      wrong: ['Yes, you were prevented from playing the disc', 'Yes, if the opponent was moving', 'Only if contact happens'],
      explanation: 'You cannot call dangerous play because you yourself would have had to initiate contact to make the play. In that case, just refrain from making it.'
    },
    {
      id: 'ann_37',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.2',
      question: "Player A pushes opponent B into A's team-mate C. Can C call a foul on B?",
      answer: 'No, B did not initiate the contact',
      wrong: ['Yes, B touched C', 'Yes, offsetting fouls', 'Only if C was going for the disc'],
      explanation: 'If A initiates contact that causes B to hit C, C cannot call a foul on B: B did not initiate the contact.'
    },
    {
      id: 'ann_38',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.3.1',
      question: 'A defender hits the disc in the air just as it reaches the receiver, who then drops it. Is it a strip foul?',
      answer: 'No, hitting the disc in flight is legal',
      wrong: ['Yes, the receiver lost the disc', 'Yes, if the receiver had touched it', 'It is a receiving foul'],
      explanation: 'A defender may hit a disc in flight. It can only be a strip when the disc had already been caught by the receiver.'
    },
    {
      id: 'ann_39',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.3.2',
      question: 'A defender intercepts in their attacking end zone, then an attacker knocks the disc out of their hands. The strip foul is accepted. What happens?',
      answer: 'Goal for the defence',
      wrong: ['The defender gets the disc on the goal line', BACK_TO_THROWER, TURNOVER_STANDS],
      explanation: 'An accepted strip foul on a reception that would have been a goal awards the goal, including a defensive "Callahan" interception.'
    },
    {
      id: 'ann_40',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.5.1.2',
      question: 'A receiver catches in the end zone but is fouled before establishing possession, loses control, and only secures the disc in the central zone. The foul is accepted. Result?',
      answer: 'Goal (force-out foul)',
      wrong: ['Possession where they secured it', 'Possession on the goal line', BACK_TO_THROWER],
      explanation: 'Force-out fouls are not only for airborne players: the foul made them establish possession in the central zone instead of the end zone, so it is a goal.'
    },
    {
      id: 'ann_41',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '17.8.2',
      question: 'Before the throw, an attacker accidentally knocks over a defender away from the disc. The defender calls a foul. What happens?',
      answer: 'Play stops; the defender makes up their lost position',
      wrong: ['Turnover', BACK_TO_THROWER, 'Nothing: play continues'],
      explanation: 'The contact was not part of a play on the disc, so it is an indirect foul, not a receiving foul: no turnover, the fouled defender just recovers their position.'
    },

    // Infractions and violations
    {
      id: 'ann_42',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.3',
      question: 'A marking infraction is called at "Stalling 1". Where does the count resume?',
      answer: 'Stalling 1',
      wrong: ['Stalling 0', 'Stalling 2', 'The marker must wait 2 seconds first'],
      explanation: 'The count normally resumes at the last number minus one, but never below 1: there is no "negative stall count".'
    },
    {
      id: 'ann_43',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.1.1.4',
      question: 'May the marker hold their arms out wide to force the thrower to throw one way?',
      answer: 'Yes, as long as they are legally positioned',
      wrong: ['No, that is wrapping', 'No, that is vision', 'Only if they are not counting'],
      explanation: 'A marker may stretch out their arms to "force" a direction, as long as they do not wrap, straddle or break disc space.'
    },
    {
      id: 'ann_44',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '18.1.1.5',
      question: 'May several defenders guard the same receiver?',
      answer: 'Yes, any number',
      wrong: ['No, only one', 'Two at most', 'Only in a zone defence'],
      explanation: 'Any number of defenders may guard the same offensive receiver. Near the thrower, each extra defender must really be guarding someone, or it is a double team.'
    },
    {
      id: 'ann_45',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.1.3',
      question: 'The marker counts "Stalling one, two, three", then the thrower calls "Fast count". What is the next number?',
      answer: 'Two',
      wrong: ['One', 'Three', 'Four'],
      explanation: 'The count resumes with the last number fully said minus one, which is the same as taking 2 seconds off: "…three, Fast count, two, three…".'
    },
    {
      id: 'ann_46',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.2.1',
      question: 'After catching on the run, what is the most steps a player should ever need to stop?',
      answer: '5',
      wrong: ['2', '3', '8'],
      explanation: 'The defence should only call travel with evidence that the player was not trying to stop. It should never take more than 5 steps to stop, and strides should get shorter.'
    },
    {
      id: 'ann_47',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.2.4.5',
      question: 'A receiver deliberately tips the disc to themselves so they can catch it inside the end zone. What is it?',
      answer: 'A travel',
      wrong: ['A goal', A_TURNOVER, 'A violation'],
      explanation: 'Intentionally tipping the disc to yourself to move into the end zone is a travel. Tipping it to a team-mate who catches it in the end zone is a goal.'
    },
    {
      id: 'ann_48',
      difficulty: 'easy',
      modes: ALL_MODES,
      ref: '18.3.1',
      question: 'Can the offence call a pick?',
      answer: 'No, only the obstructed defender can',
      wrong: ['Yes, any player can', 'Only the thrower', 'Only in the end zone'],
      explanation: 'A pick can only be called by a defender who is obstructed from following the player they guard. The offence cannot call a pick.'
    },
    {
      id: 'ann_49',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '18.3.1',
      question: 'How close must a defender be to the player they guard, when obstructed, to call a pick?',
      answer: 'Within 3 metres',
      wrong: ['Within 1 metre', 'Within 5 metres', 'Any distance'],
      explanation: 'A pick should only be called if the defender was within 3 metres of their player when obstructed. They can be further away by the time they call it.'
    },

    // Safety and time-outs
    {
      id: 'ann_50',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '19.1.2',
      question: 'A player is injured, not by an opponent, and wants to stay on, but their team has no time-outs left. What happens?',
      answer: 'They must be substituted',
      wrong: ['They can stay on anyway', 'The other team loses a time-out', POINT_REPLAYED],
      explanation: 'They normally choose between a substitution and charging their team a time-out. With no time-outs left, they must be substituted.'
    },
    {
      id: 'ann_51',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '19.2.2',
      question: 'Which disc damage allows the thrower to call a technical stoppage during play?',
      answer: 'A cracked or badly warped ("tacoed") disc',
      wrong: ['A wet disc', 'A dirty disc', 'A slightly warped disc'],
      explanation: 'A severely damaged disc is cracked, torn, deeply gouged, creased, punctured or badly warped. A slightly warped, wet or dirty disc does not qualify.'
    },
    {
      id: 'ann_52',
      difficulty: 'hard',
      modes: OUTDOOR_ONLY,
      ref: '20.3',
      question: 'After a turnover in the end zone, the new thrower picks up the disc. May they call a time-out before walking to the goal line?',
      answer: 'Yes, placing the disc where the pivot will be',
      wrong: ['No, the pivot must be set first', 'Only after a check', 'No, only between points'],
      explanation: 'If the thrower must move to a different spot to set the pivot, they can call a time-out first. The disc is then placed where the pivot will be.'
    },
    {
      id: 'ann_53',
      difficulty: 'medium',
      modes: OUTDOOR_ONLY,
      ref: '20.4',
      question: 'A team with no time-outs left calls one between points. What happens?',
      answer: 'Nothing: the call has no effect',
      wrong: ['The other team pulls immediately', 'The other team gets a point', '2 is added to the next stall count'],
      explanation: 'Between points or during a stoppage, a time-out call with none remaining has no effect. During play, it would stop play and add 2 to the stall count.'
    }
  ]
}
