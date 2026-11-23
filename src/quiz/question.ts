export type QuizDifficulty = 'easy' | 'medium' | 'hard'
export type QuizMode = 'outdoor' | 'indoor'

export interface QuizQuestion {
  /** Hashtag-safe and never renamed once posted: the bot remembers asked questions by it */
  id: string;
  difficulty: QuizDifficulty;
  modes: QuizMode[];
  /** WFDF rule number (e.g. 9.5.1), linked on urules.org; without it the batch source is linked */
  ref?: string;
  question: string;
  answer: string;
  /** Options are shuffled when posting */
  wrong: string[];
  /** Left out when the answer speaks for itself (hand signals) */
  explanation?: string;
  /** Sent as a photo before the poll, relative to the app root */
  image?: string;
  /** Sent as a photo with the answer, relative to the app root */
  answerImage?: string;
}

export interface QuizBatch {
  /** Short, as /quiz_stats shows it */
  name: string;
  source: { title: string; url: string };
  questions: QuizQuestion[];
}
