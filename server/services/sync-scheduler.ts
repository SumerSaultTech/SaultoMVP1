/**
 * Sync Scheduler Service
 * Automatically syncs Jira and other connectors on a schedule
 */

import { pythonConnectorService } from './python-connector-service';
import { storage } from '../storage';
import { PostgresAnalyticsService } from './postgres-analytics';
import { MetricsTimeSeriesETL } from './metrics-time-series-etl';

interface ScheduledSync {
  companyId: number;
  connectorType: string;
  interval: number; // minutes
  lastSyncAt: Date | null;
  nextSyncAt: Date;
  enabled: boolean;
}

class SyncScheduler {
  private scheduledSyncs: ScheduledSync[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval = 60000; // Check every 1 minute
  private etlService: MetricsTimeSeriesETL;

  constructor() {
    // Initialize ETL service
    const postgres = new PostgresAnalyticsService();
    this.etlService = new MetricsTimeSeriesETL(postgres);
    
    // Initialize scheduler
    this.start();
  }

  /**
   * Start the sync scheduler
   */
  start() {
    if (this.intervalId) {
      console.log('🔄 Sync scheduler already running');
      return;
    }

    console.log('🚀 Starting sync scheduler...');
    
    // Load existing connectors and set up schedules
    this.loadConnectorsAndSetupSchedules();
    
    // Start the scheduler loop
    this.intervalId = setInterval(() => {
      this.checkAndRunScheduledSyncs();
    }, this.checkInterval);

    console.log('✅ Sync scheduler started - checking every minute');
  }

  /**
   * Stop the sync scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Sync scheduler stopped');
    }
  }

  /**
   * Load all configured connectors and set up 15-minute schedules
   * Supports: Jira, Salesforce, HubSpot, and any future integrations
   */
  private async loadConnectorsAndSetupSchedules() {
    try {
      // Hardcoded fix: Add known Jira connector immediately
      console.log('🔧 Adding hardcoded Jira connector for company 1756502314139...');
      this.addScheduledSync(1756502314139, 'jira', 15);
      console.log('✅ Added Jira sync schedule (15 min intervals)');
      
      // Get all companies from the database
      const companies = await storage.getCompanies();
      
      for (const company of companies) {
        // Get all data sources for this company
        const dataSources = await storage.getDataSources(company.id);
        
        for (const dataSource of dataSources) {
          // Skip non-connector data sources (like manual uploads)
          if (!this.isSyncableConnector(dataSource.type)) {
            continue;
          }
          
          console.log(`📋 Setting up 15-minute ${dataSource.type} sync for company ${company.id} (${company.name})`);
          
          // Add to scheduled syncs with 15-minute interval
          const scheduledSync: ScheduledSync = {
            companyId: company.id,
            connectorType: dataSource.type,
            interval: 15, // 15 minutes for all integrations
            lastSyncAt: dataSource.lastSyncAt,
            nextSyncAt: new Date(Date.now() + (15 * 60 * 1000)), // Next sync in 15 minutes
            enabled: true
          };
          
          this.scheduledSyncs.push(scheduledSync);
          
          console.log(`⏰ Scheduled ${dataSource.type} sync for company ${company.id}: every ${scheduledSync.interval} minutes`);
        }
      }

      console.log(`✅ Loaded ${this.scheduledSyncs.length} scheduled syncs across all integrations`);

    } catch (error) {
      console.error('❌ Error loading connectors for scheduling:', error);
    }
  }

  /**
   * Check if a data source type is a syncable connector
   * Add new connector types here as they're implemented
   */
  private isSyncableConnector(type: string): boolean {
    const syncableTypes = [
      'jira',
      'salesforce', 
      'hubspot',
      'github',
      'slack',
      'microsoft',
      'google'
    ];
    
    return syncableTypes.includes(type.toLowerCase());
  }

  /**
   * Check for and run any scheduled syncs that are due
   */
  private async checkAndRunScheduledSyncs() {
    const now = new Date();
    
    for (const scheduledSync of this.scheduledSyncs) {
      if (!scheduledSync.enabled) {
        continue;
      }

      // Check if it's time for the next sync
      if (now >= scheduledSync.nextSyncAt) {
        console.log(`🔄 Running scheduled ${scheduledSync.connectorType} sync for company ${scheduledSync.companyId}`);
        
        try {
          // Run the sync
          const result = await pythonConnectorService.syncConnector(
            scheduledSync.companyId,
            scheduledSync.connectorType
          );

          if (result.success) {
            console.log(`✅ Scheduled sync completed: ${result.records_synced} records, ${result.tables_synced.length} tables`);
            
            // Run daily ETL processing after successful sync
            console.log(`🔄 Running daily ETL processing for company ${scheduledSync.companyId}...`);
            try {
              await this.runDailyETLForCompany(scheduledSync.companyId);
              console.log(`✅ Daily ETL completed for company ${scheduledSync.companyId}`);
            } catch (etlError) {
              console.error(`⚠️ Daily ETL failed for company ${scheduledSync.companyId}:`, etlError);
              // Continue with sync scheduling even if ETL fails
            }
            
            // Update last sync time and schedule next sync
            scheduledSync.lastSyncAt = now;
            scheduledSync.nextSyncAt = new Date(now.getTime() + (scheduledSync.interval * 60 * 1000));
            
            // Update the database with last sync time
            await storage.updateDataSourceSyncTime(scheduledSync.companyId, scheduledSync.connectorType, now);
            
          } else {
            console.error(`❌ Scheduled sync failed: ${result.error_message}`);
            
            // Schedule retry in 5 minutes on failure
            scheduledSync.nextSyncAt = new Date(now.getTime() + (5 * 60 * 1000));
          }

        } catch (error) {
          console.error(`❌ Error during scheduled sync for company ${scheduledSync.companyId}:`, error);
          
          // Schedule retry in 5 minutes on error
          scheduledSync.nextSyncAt = new Date(now.getTime() + (5 * 60 * 1000));
        }
      }
    }
  }

  /**
   * Add a new scheduled sync
   */
  addScheduledSync(companyId: number, connectorType: string, intervalMinutes: number = 15) {
    const existingIndex = this.scheduledSyncs.findIndex(
      s => s.companyId === companyId && s.connectorType === connectorType
    );

    const scheduledSync: ScheduledSync = {
      companyId,
      connectorType,
      interval: intervalMinutes,
      lastSyncAt: null,
      nextSyncAt: new Date(Date.now() + (intervalMinutes * 60 * 1000)),
      enabled: true
    };

    if (existingIndex >= 0) {
      // Update existing
      this.scheduledSyncs[existingIndex] = scheduledSync;
      console.log(`📝 Updated scheduled sync: ${connectorType} for company ${companyId} every ${intervalMinutes} minutes`);
    } else {
      // Add new
      this.scheduledSyncs.push(scheduledSync);
      console.log(`➕ Added scheduled sync: ${connectorType} for company ${companyId} every ${intervalMinutes} minutes`);
    }
  }

  /**
   * Remove a scheduled sync
   */
  removeScheduledSync(companyId: number, connectorType: string) {
    const index = this.scheduledSyncs.findIndex(
      s => s.companyId === companyId && s.connectorType === connectorType
    );

    if (index >= 0) {
      this.scheduledSyncs.splice(index, 1);
      console.log(`🗑️ Removed scheduled sync: ${connectorType} for company ${companyId}`);
    }
  }

  /**
   * Get all scheduled syncs
   */
  getScheduledSyncs(): ScheduledSync[] {
    return [...this.scheduledSyncs];
  }

  /**
   * Run daily ETL processing for a company to update metrics_time_series
   * Only runs daily period to avoid interfering with quarterly/yearly accumulation
   */
  private async runDailyETLForCompany(companyId: number): Promise<void> {
    // Only run daily ETL to avoid interference with quarterly/yearly running sums
    // Quarterly and yearly ETL should be run separately when needed
    const result = await this.etlService.runETLJob({
      companyId: companyId,
      periodType: 'daily',
      forceRefresh: true
    });
    
    if (!result.success) {
      throw new Error(`Daily ETL failed: ${result.message}`);
    }
  }

  /**
   * Trigger immediate sync (bypasses schedule)
   */
  async triggerImmediateSync(companyId: number, connectorType: string): Promise<any> {
    console.log(`🚀 Triggering immediate ${connectorType} sync for company ${companyId}`);
    
    try {
      const result = await pythonConnectorService.syncConnector(companyId, connectorType);
      
      if (result.success) {
        // Run daily ETL processing after successful immediate sync
        console.log(`🔄 Running daily ETL processing after immediate sync for company ${companyId}...`);
        try {
          await this.runDailyETLForCompany(companyId);
          console.log(`✅ Daily ETL completed after immediate sync for company ${companyId}`);
        } catch (etlError) {
          console.error(`⚠️ Daily ETL failed after immediate sync for company ${companyId}:`, etlError);
          // Continue with sync completion even if ETL fails
        }
        
        // Update the scheduled sync's last sync time
        const scheduledSync = this.scheduledSyncs.find(
          s => s.companyId === companyId && s.connectorType === connectorType
        );
        
        if (scheduledSync) {
          scheduledSync.lastSyncAt = new Date();
          scheduledSync.nextSyncAt = new Date(Date.now() + (scheduledSync.interval * 60 * 1000));
        }
        
        // Update database
        await storage.updateDataSourceSyncTime(companyId, connectorType, new Date());
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error during immediate sync:`, error);
      throw error;
    }
  }
}

export const syncScheduler = new SyncScheduler();