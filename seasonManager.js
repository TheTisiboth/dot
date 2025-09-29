const { config } = require('./config');

class SeasonManager {
  constructor() {
    this.seasons = config.seasons;
  }

  /**
   * Determines the current season based on the date
   * @param {Date} date - The date to check (defaults to current date)
   * @returns {string} - 'winter' or 'summer'
   */
  getCurrentSeason(date = new Date()) {
    const currentYear = date.getFullYear();
    
    // Parse season start dates for current year
    const winterStart = new Date(`${currentYear}-${this.seasons.winter.startDate.slice(5)}`);
    const summerStart = new Date(`${currentYear}-${this.seasons.summer.startDate.slice(5)}`);
    
    // Handle year boundaries - if winter start is in December and we're in January-May
    if (winterStart.getMonth() >= 11 && date.getMonth() <= 4) {
      // Check if we're before summer or after previous year's winter
      if (date >= summerStart) {
        return 'summer';
      } else {
        return 'winter';
      }
    }
    
    // Standard case
    if (date >= winterStart || date < summerStart) {
      return 'winter';
    } else {
      return 'summer';
    }
  }

  /**
   * Gets the current season configuration
   * @returns {Object} - Season configuration object
   */
  getCurrentSeasonConfig() {
    const currentSeason = this.getCurrentSeason();
    return {
      name: currentSeason,
      ...this.seasons[currentSeason]
    };
  }

  /**
   * Gets the message template for the current season
   * @returns {string} - Message template
   */
  getCurrentMessageTemplate() {
    return this.getCurrentSeasonConfig().messageTemplate;
  }

  /**
   * Gets the schedule for the current season
   * @returns {Array} - Array of schedule objects
   */
  getCurrentSchedule() {
    return this.getCurrentSeasonConfig().schedule;
  }

  /**
   * Converts day of week number to cron format
   * @param {number} dayOfWeek - Day of week (0=Sunday, 1=Monday, etc.)
   * @returns {number} - Cron day of week (0=Sunday, 1=Monday, etc.)
   */
  toCronDayOfWeek(dayOfWeek) {
    return dayOfWeek;
  }

  /**
   * Generates cron expressions for the current season
   * @returns {Array} - Array of cron expressions
   */
  getCurrentCronExpressions() {
    const schedule = this.getCurrentSchedule();
    return schedule.map(item => {
      const [hour, minute] = item.time.split(':');
      const dayOfWeek = this.toCronDayOfWeek(item.dayOfWeek);
      // Format: minute hour * * dayOfWeek
      return `${minute} ${hour} * * ${dayOfWeek}`;
    });
  }
}

module.exports = SeasonManager;