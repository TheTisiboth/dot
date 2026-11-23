import { type Training } from '../season'
import { MARKERS } from '../markers'
import { escapeHtml, locationLink } from '../../shared/formatters'
import { type LlmWriter } from './llmWriter'
import * as prompts from './prompts'
import * as templates from './templates'
import { type Attendance } from './templates'

export type TrainingMessages = ReturnType<typeof trainingMessages>

/** LLM text is untrusted: escaped whole, then the location name is linked. */
const toHtml = (message: string, training: Training): string =>
  escapeHtml(message).replaceAll(escapeHtml(training.location.name), locationLink(training.location))

/** The messages the LLM may write: its text when it answers, the template otherwise. */
export const trainingMessages = (writer: Pick<LlmWriter, 'write'>) => {
  const write = async (label: string, prompt: string, training: Training): Promise<string | null> => {
    const text = await writer.write(label, prompt)
    return text === null ? null : toHtml(text, training)
  }

  return {
    announcement: async (training: Training): Promise<string> =>
      await write('Announcement', prompts.announcement(training), training) ?? templates.announcement(training),

    trainerRequest: async (training: Training): Promise<string> =>
      await write('Trainer request', prompts.trainerRequest(training), training) ?? templates.trainerRequest(training),

    async attendanceReminder(training: Training, attendance: Attendance): Promise<string> {
      const message = await write('Attendance reminder', prompts.attendanceReminder(training, attendance), training)
      if (message === null) return templates.attendanceReminder(training, attendance)

      // The marker must never depend on the LLM: it is how we recognise our own attendance reminder in chat history
      return message.startsWith(MARKERS.ATTENDANCE_REMINDER) ? message : `${MARKERS.ATTENDANCE_REMINDER} ${message}`
    }
  }
}
