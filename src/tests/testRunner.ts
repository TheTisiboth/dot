import { SeasonManager } from '../services/SeasonManager.js';
import { MessageGenerator } from '../services/MessageGenerator.js';
import { EMOJIS } from '../utils/constants.js';
import { DateHelpers } from '../utils/dateHelpers.js';

interface TestCase {
  date: string;
  expectedSeason: 'winter' | 'summer';
  expectedShouldSend: boolean;
  description: string;
}

export class TestRunner {
  private readonly seasonManager: SeasonManager;
  private readonly messageGenerator: MessageGenerator;

  constructor() {
    this.seasonManager = new SeasonManager();
    this.messageGenerator = new MessageGenerator();
  }

  async runAllTests(): Promise<void> {
    console.log(`${EMOJIS.TEST_TUBE} Running Ultimate Frisbee Bot Tests\n`);

    await this.runSeasonalLogicTests();
    await this.runSchedulingLogicTests();
    await this.runMessageGenerationTests();

    console.log(`\n${EMOJIS.CHECK_MARK} All tests completed!`);
  }

  private async runSchedulingLogicTests(): Promise<void> {
    console.log(`\n${EMOJIS.CLOCK} SCHEDULING LOGIC TESTS (24h Before)`);
    console.log('==========================================');

    interface ScheduleTestCase {
      currentDate: string;
      expectedShouldSend: boolean;
      description: string;
    }

    const scheduleTests: ScheduleTestCase[] = [
      // Winter practices: Tuesday 20:30, Saturday 21:00
      {
        currentDate: '2024-01-15T20:30:00', // Monday 20:30 -> Tomorrow is Tuesday (training day)
        expectedShouldSend: true,
        description: 'Monday 20:30 -> Tuesday training (should send)'
      },
      {
        currentDate: '2024-01-15T20:29:00', // Monday 20:29 -> Not time yet
        expectedShouldSend: true,
        description: 'Monday 20:29 -> Tuesday training (should send)'
      },
      {
        currentDate: '2024-01-16T20:30:00', // Tuesday 20:30 -> Tomorrow is Wednesday (no training)
        expectedShouldSend: false,
        description: 'Tuesday 20:30 -> Wednesday no training (should not send)'
      },
      {
        currentDate: '2024-01-19T21:00:00', // Friday 21:00 -> Tomorrow is Saturday (training day)
        expectedShouldSend: true,
        description: 'Friday 21:00 -> Saturday training (should send)'
      },
      {
        currentDate: '2024-01-20T21:00:00', // Saturday 21:00 -> Tomorrow is Sunday (no training)
        expectedShouldSend: false,
        description: 'Saturday 21:00 -> Sunday no training (should not send)'
      },
      // Summer practices: Sunday 19:00, Wednesday 19:30
      {
        currentDate: '2024-06-22T19:00:00', // Saturday 19:00 -> Tomorrow is Sunday (training day)
        expectedShouldSend: true,
        description: 'Saturday 19:00 -> Sunday training (should send)'
      },
      {
        currentDate: '2024-06-25T19:30:00', // Tuesday 19:30 -> Tomorrow is Wednesday (training day)
        expectedShouldSend: true,
        description: 'Tuesday 19:30 -> Wednesday training (should send)'
      },
    ];

    for (const testCase of scheduleTests) {
      const date = new Date(testCase.currentDate);
      const shouldSend = this.seasonManager.shouldSendMessage(date);
      const match = shouldSend === testCase.expectedShouldSend;
      const icon = match ? EMOJIS.CHECK_MARK : EMOJIS.CROSS_MARK;

      console.log(`${icon} ${testCase.description}`);

      if (!match) {
        console.log(`  Expected: ${testCase.expectedShouldSend}, Got: ${shouldSend}`);
      }
    }
  }

  private async runSeasonalLogicTests(): Promise<void> {
    console.log(`${EMOJIS.CALENDAR} SEASONAL LOGIC TESTS`);
    console.log('========================');

    const testCases: TestCase[] = [
      {
        date: '2024-01-15',
        expectedSeason: 'winter',
        expectedShouldSend: false, // Monday
        description: 'Winter - Monday (no training)'
      },
      {
        date: '2024-01-16',
        expectedSeason: 'winter',
        expectedShouldSend: true, // Tuesday
        description: 'Winter - Tuesday (training day)'
      },
      {
        date: '2024-01-13',
        expectedSeason: 'winter',
        expectedShouldSend: true, // Saturday
        description: 'Winter - Saturday (training day)'
      },
      {
        date: '2024-01-14',
        expectedSeason: 'winter',
        expectedShouldSend: false, // Sunday
        description: 'Winter - Sunday (no training)'
      },
      {
        date: '2024-07-14',
        expectedSeason: 'summer',
        expectedShouldSend: true, // Sunday
        description: 'Summer - Sunday (training day)'
      },
      {
        date: '2024-07-17',
        expectedSeason: 'summer',
        expectedShouldSend: true, // Wednesday
        description: 'Summer - Wednesday (training day)'
      },
      {
        date: '2024-07-16',
        expectedSeason: 'summer',
        expectedShouldSend: false, // Tuesday
        description: 'Summer - Tuesday (no training)'
      },
      {
        date: '2024-09-15',
        expectedSeason: 'winter',
        expectedShouldSend: false, // Sunday, start of winter
        description: 'Start of winter season'
      },
      {
        date: '2024-05-20',
        expectedSeason: 'summer',
        expectedShouldSend: false, // Monday, start of summer
        description: 'Start of summer season'
      },
    ];

    for (const testCase of testCases) {
      const date = new Date(testCase.date);
      const season = this.seasonManager.getCurrentSeason(date);
      const shouldSend = this.seasonManager.shouldSendMessage(date);

      const seasonMatch = season === testCase.expectedSeason;
      const shouldSendMatch = shouldSend === testCase.expectedShouldSend;
      const dayName = DateHelpers.getDayName(date.getDay());

      const seasonIcon = seasonMatch ? EMOJIS.CHECK_MARK : EMOJIS.CROSS_MARK;
      const messageIcon = shouldSendMatch ? EMOJIS.CHECK_MARK : EMOJIS.CROSS_MARK;

      console.log(`${testCase.date} (${dayName}): ${season} season ${seasonIcon} - Send message: ${shouldSend ? EMOJIS.CHECK_MARK : EMOJIS.CROSS_MARK} ${messageIcon}`);

      if (!seasonMatch) {
        console.log(`  Expected season: ${testCase.expectedSeason}, got: ${season}`);
      }
      if (!shouldSendMatch) {
        console.log(`  Expected shouldSend: ${testCase.expectedShouldSend}, got: ${shouldSend}`);
      }
    }
  }

  private async runMessageGenerationTests(): Promise<void> {
    console.log(`\n${EMOJIS.MEMO} MESSAGE GENERATION TESTS`);
    console.log('============================');

    const winterConfig = {
      season: 'winter' as const,
      location: 'Park Arena',
      practices: [
        { day: 2, time: '20:30' }, // Tuesday
        { day: 6, time: '21:00' }  // Saturday
      ]
    };

    const summerConfig = {
      season: 'summer' as const,
      location: 'Beach Courts',
      practices: [
        { day: 0, time: '19:00' }, // Sunday
        { day: 3, time: '19:30' }  // Wednesday
      ]
    };

    console.log(`${EMOJIS.WINTER} Winter Template Message:`);
    console.log('----------------------------');
    const winterMessage = await this.messageGenerator.generateMessage(winterConfig, { useLLM: false });
    console.log(winterMessage);

    console.log(`\n${EMOJIS.SUMMER} Summer Template Message:`);
    console.log('----------------------------');
    const summerMessage = await this.messageGenerator.generateMessage(summerConfig, { useLLM: false });
    console.log(summerMessage);

    // Test LLM if available
    if (this.messageGenerator.isLLMAvailable()) {
      console.log(`\n${EMOJIS.ROBOT} LLM Generated Messages:`);
      console.log('==========================');

      console.log(`${EMOJIS.WINTER} Winter LLM Message:`);
      console.log('----------------------');
      const winterLLMMessage = await this.messageGenerator.generateMessage(winterConfig, { useLLM: true });
      console.log(winterLLMMessage);

      console.log(`\n${EMOJIS.SUMMER} Summer LLM Message:`);
      console.log('----------------------');
      const summerLLMMessage = await this.messageGenerator.generateMessage(summerConfig, { useLLM: true });
      console.log(summerLLMMessage);
    } else {
      console.log(`\n${EMOJIS.WARNING} OpenAI API key not set - skipping LLM tests`);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testRunner = new TestRunner();
  testRunner.runAllTests().catch(console.error);
}