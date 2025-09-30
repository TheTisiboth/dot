import { DAY_NAMES } from './constants.js';
import { TrainingInfo, SeasonType } from '../types/index.js';

export class DateHelpers {
  static getDayName(dayIndex: number): string {
    return DAY_NAMES[dayIndex];
  }

  static formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  static isValidDate(date: Date): boolean {
    return !isNaN(date.getTime());
  }

  static createTrainingInfo(
    date: Date,
    location: string,
    time: string,
    season: SeasonType
  ): TrainingInfo {
    return {
      date,
      dayName: this.getDayName(date.getDay()),
      location,
      time,
      season
    };
  }

  static parseTestDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (!this.isValidDate(date)) {
      throw new Error('Invalid date format');
    }
    return date;
  }

  static getCurrentYear(): number {
    return new Date().getFullYear();
  }

  static createDateFromMonthDay(month: number, day: number, year?: number): Date {
    const currentYear = year || this.getCurrentYear();
    return new Date(currentYear, month - 1, day);
  }
}