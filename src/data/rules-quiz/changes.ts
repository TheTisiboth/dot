import { type QuizBatch } from '../../types'
import { ALL_MODES } from './modes'

// Most 2025 changes are already asked in the chapter batches; these are the remaining ones
export const changes: QuizBatch = {
  source: {
    title: 'WFDF Rules of Ultimate 2025-2028 - Summary of Changes (CC BY 4.0)',
    url: 'https://rules.wfdf.sport/wp-content/uploads/2025/03/WFDF-Rules-of-Ultimate-2025-2028-Summary-of-Changes.pdf'
  },
  questions: [
    {
      id: 'chg_01',
      difficulty: 'medium',
      modes: ALL_MODES,
      ref: '18.1.4',
      question: 'Defenders keep double teaming the thrower. Since 2025, may a receiver (not the thrower) stop play with a marking violation?',
      answer: 'Yes',
      wrong: ['No, only the thrower', 'Only the captain', 'Only after a time-out'],
      explanation: 'Since 2025, a player other than the thrower can call a marking violation and stop play for a double team, e.g. when it is repeated or egregious.'
    },
    {
      id: 'chg_02',
      difficulty: 'hard',
      modes: ALL_MODES,
      ref: '9.5.4',
      question: 'After a call, both teams agree it did not affect the play, and players make up their lost positions. Where does the stall count restart?',
      answer: 'Stalling one',
      wrong: ['Where it stopped plus one, maximum 6', 'Where it stopped plus one, maximum 9', 'Where it stopped'],
      explanation: 'After play continues this way (16.3.2), the stall count restarts at "Stalling one". This was clarified in 2025.'
    },
    {
      id: 'chg_03',
      difficulty: 'hard',
      modes: ALL_MODES,
      question: 'When is a defender "guarding" an offensive player?',
      answer: 'Within 3 m of them, and primarily focused on and reacting to them',
      wrong: ['Within 1 m of them', 'Whenever they face them', 'When assigned to them before the point'],
      explanation: 'Since 2025, a defender is guarding a player when within 3 metres and "primarily focused on and reacting to" that player. This matters for double team calls.'
    }
  ]
}
