import { config } from '../config/index.js';
import { SeasonConfig, SeasonType, TrainingInfo } from '../types/index.js';
import { DateHelpers } from '../utils/dateHelpers.js';

export class SeasonManager {
  private readonly seasons = config.seasons;

  getCurrentSeason(date: Date = new Date()): SeasonType {
    // If testing mode is enabled and override date is set
    if (config.testing.enabled && config.testing.overrideDate) {
      date = new Date(config.testing.overrideDate);
    }

    const winterStart = this.seasons.winter.startDate;
    const summerStart = this.seasons.summer.startDate;

    // Create date objects for comparison (using the date's year)
    const currentYear = date.getFullYear();
    const winterStartDate = DateHelpers.createDateFromMonthDay(
      winterStart.month,
      winterStart.day,
      currentYear
    );
    const summerStartDate = DateHelpers.createDateFromMonthDay(
      summerStart.month,
      summerStart.day,
      currentYear
    );

    // Handle year-wrap logic: winter runs from Sep 15 to May 19 (next year)
    // Summer runs from May 20 to Sep 14

    // If date is after Sep 15 of current year, it's winter
    if (date >= winterStartDate) {
      return 'winter';
    }

    // If date is before May 20 of current year, it's still winter (from previous year)
    if (date < summerStartDate) {
      return 'winter';
    }

    // Otherwise it's summer (May 20 to Sep 14)
    return 'summer';
  }

  getCurrentSeasonConfig(date: Date = new Date()): SeasonConfig {
    const season = this.getCurrentSeason(date);
    return {
      season,
      ...this.seasons[season]
    };
  }

  shouldSendMessage(date: Date = new Date()): boolean {
    // If testing mode is enabled and override date is set
    if (config.testing.enabled && config.testing.overrideDate) {
      date = new Date(config.testing.overrideDate);
    }

    const seasonConfig = this.getCurrentSeasonConfig(date);
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.

    return seasonConfig.practices.some(practice => practice.day === dayOfWeek);
  }

  getPracticeForDay(date: Date = new Date()) {
    // If testing mode is enabled and override date is set
    if (config.testing.enabled && config.testing.overrideDate) {
      date = new Date(config.testing.overrideDate);
    }

    const seasonConfig = this.getCurrentSeasonConfig(date);
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.

    return seasonConfig.practices.find(practice => practice.day === dayOfWeek);
  }

  getNextTrainingDate(date: Date = new Date()): Date {
    const seasonConfig = this.getCurrentSeasonConfig(date);
    const currentDay = date.getDay();

    // Find the next training day
    let daysUntilNext: number | null = null;

    for (const practice of seasonConfig.practices) {
      const daysToAdd = (practice.day - currentDay + 7) % 7;
      if (daysToAdd === 0) {
        // Today is a training day, so next training is tomorrow
        daysUntilNext = 1;
        break;
      }
      if (daysUntilNext === null || daysToAdd < daysUntilNext) {
        daysUntilNext = daysToAdd;
      }
    }

    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + (daysUntilNext || 0));

    return nextDate;
  }

  getNextTrainingInfo(date: Date = new Date()): TrainingInfo {
    const nextDate = this.getNextTrainingDate(date);
    const seasonConfig = this.getCurrentSeasonConfig(nextDate);

    // Find the practice for the next training date
    const nextPractice = seasonConfig.practices.find(practice => practice.day === nextDate.getDay());
    const location = nextPractice?.location || seasonConfig.location;
    const time = nextPractice?.time || seasonConfig.practices[0]?.time || '20:00';

    const trainingInfo: TrainingInfo = {
      ...DateHelpers.createTrainingInfo(nextDate, location, time, seasonConfig.season)
    };

    if (nextPractice) {
      trainingInfo.practiceDay = nextPractice;
    }

    return trainingInfo;
  }

  getTrainingDaysString(season?: SeasonType): string {
    const seasonConfig = season ?
      { season, ...this.seasons[season] } :
      this.getCurrentSeasonConfig();

    return seasonConfig.practices
      .map(practice => `${DateHelpers.getDayName(practice.day)} at ${practice.time}`)
      .join(', ');
  }
}