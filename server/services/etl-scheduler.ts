/**
 * ETL Scheduler Service
 * Runs metrics time-series ETL on a 15-minute cadence per company
 */

import { startOfMonth } from 'date-fns';
import { storage } from '../storage';
import { PostgresAnalyticsService } from './postgres-analytics';
import { MetricsTimeSeriesETL } from './metrics-time-series-etl';

interface ScheduledEtl {
  companyId: number;
  periods: Array<'weekly' | 'monthly' | 'quarterly' | 'yearly'>;
  interval: number; // minutes
  lastRunAt: Date | null;
  nextRunAt: Date;
  enabled: boolean;
}

class EtlScheduler {
  private scheduledEtls: ScheduledEtl[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval = 60_000; // 1 minute
  private etlService: MetricsTimeSeriesETL;

  constructor() {
    const postgres = new PostgresAnalyticsService();
    this.etlService = new MetricsTimeSeriesETL(postgres);
    this.start();
  }

  start() {
    if (this.intervalId) {
      console.log('🔄 ETL scheduler already running');
      return;
    }

    console.log('🚀 Starting ETL scheduler...');
    this.loadCompaniesAndScheduleEtls();

    this.intervalId = setInterval(() => {
      this.checkAndRunScheduledEtls();
    }, this.checkInterval);

    console.log('✅ ETL scheduler started - checking every minute');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 ETL scheduler stopped');
    }
  }

  private async loadCompaniesAndScheduleEtls() {
    try {
      const companies = await storage.getCompanies();
      let count = 0;

      for (const company of companies) {
        // Default: run monthly ETL every 15 minutes
        this.addScheduledEtl(company.id, ['monthly'], 15);
        count++;
      }

      console.log(`✅ Loaded ${count} scheduled ETL jobs (15-minute cadence)`);
    } catch (error) {
      console.error('❌ Error loading companies for ETL scheduling:', error);
    }
  }

  private async checkAndRunScheduledEtls() {
    const now = new Date();

    for (const job of this.scheduledEtls) {
      if (!job.enabled) continue;

      if (now >= job.nextRunAt) {
        console.log(`🔄 Running scheduled ETL for company ${job.companyId} (periods: ${job.periods.join(', ')})`);
        try {
          for (const period of job.periods) {
            const end = new Date();
            let start: Date;
            switch (period) {
              case 'monthly':
                start = startOfMonth(end);
                break;
              case 'weekly':
                start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
                break;
              case 'quarterly':
                start = new Date(end);
                start.setMonth(start.getMonth() - 3);
                break;
              case 'yearly':
                start = new Date(end.getFullYear(), 0, 1);
                break;
              default:
                start = startOfMonth(end);
            }

            const result = await this.etlService.runETLJob({
              companyId: job.companyId,
              periodType: period,
              forceRefresh: true,
            });
            if (!result.success) {
              console.warn(`⚠️ ETL for company ${job.companyId} (${period}) reported failure:`, result.message);
            } else {
              console.log(
                `✅ ETL completed for company ${job.companyId} (${period}) — window ${start.toISOString().slice(0, 10)}..${end
                  .toISOString()
                  .slice(0, 10)}`
              );
            }
          }
        } catch (error) {
          console.error(`❌ Error during scheduled ETL for company ${job.companyId}:`, error);
          // Retry in 5 minutes on error
          job.nextRunAt = new Date(now.getTime() + 5 * 60 * 1000);
          continue;
        }

        // Advance next run
        job.lastRunAt = now;
        job.nextRunAt = new Date(now.getTime() + job.interval * 60 * 1000);
      }
    }
  }

  addScheduledEtl(
    companyId: number,
    periods: Array<'weekly' | 'monthly' | 'quarterly' | 'yearly'>,
    intervalMinutes: number = 15
  ) {
    const existingIndex = this.scheduledEtls.findIndex((e) => e.companyId === companyId);
    const etl: ScheduledEtl = {
      companyId,
      periods,
      interval: intervalMinutes,
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + intervalMinutes * 60 * 1000),
      enabled: true,
    };

    if (existingIndex >= 0) {
      this.scheduledEtls[existingIndex] = etl;
      console.log(
        `📝 Updated scheduled ETL for company ${companyId} every ${intervalMinutes} minutes (periods: ${periods.join(', ')})`
      );
    } else {
      this.scheduledEtls.push(etl);
      console.log(
        `➕ Added scheduled ETL for company ${companyId} every ${intervalMinutes} minutes (periods: ${periods.join(', ')})`
      );
    }
  }
}

export const etlScheduler = new EtlScheduler();
