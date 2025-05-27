import fs from 'fs/promises';
import path from 'path';
import { snowflakeService } from './snowflake';
import { storage } from '../storage';
import { SqlModel } from '@shared/schema';

export class SQLExecutorService {
  private sqlFolderPath = path.resolve(process.cwd(), 'sql');

  async loadSQLFiles(): Promise<void> {
    try {
      const layers = ['stg', 'int', 'core'];
      
      for (const layer of layers) {
        const layerPath = path.join(this.sqlFolderPath, layer);
        
        try {
          const files = await fs.readdir(layerPath);
          const sqlFiles = files.filter(file => file.endsWith('.sql'));

          for (const file of sqlFiles) {
            const filePath = path.join(layerPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const modelName = file.replace('.sql', '');

            // Check if model already exists
            const existingModels = await storage.getSqlModels();
            const existing = existingModels.find(m => m.name === modelName);

            if (existing) {
              // Update existing model
              await storage.updateSqlModel(existing.id, {
                sqlContent: content,
                layer,
                description: this.extractDescription(content)
              });
            } else {
              // Create new model
              await storage.createSqlModel({
                name: modelName,
                layer,
                description: this.extractDescription(content),
                sqlContent: content,
                status: 'not_deployed'
              });
            }
          }
        } catch (error) {
          console.warn(`Layer directory ${layer} not found, skipping...`);
        }
      }
    } catch (error) {
      console.error('Failed to load SQL files:', error);
    }
  }

  async deployModels(layers?: string[]): Promise<{ success: boolean; deployed: string[]; failed: string[] }> {
    const deployLayers = layers || ['stg', 'int', 'core'];
    const deployed: string[] = [];
    const failed: string[] = [];

    try {
      // Create pipeline run record
      const pipelineRun = await storage.createPipelineRun({
        type: 'model_deploy',
        status: 'running',
        metadata: { layers: deployLayers }
      });

      for (const layer of deployLayers) {
        const models = await storage.getSqlModelsByLayer(layer);
        
        for (const model of models) {
          try {
            const success = await snowflakeService.deployView(model.name, model.sqlContent);
            
            if (success) {
              await storage.updateSqlModel(model.id, {
                status: 'deployed',
                lastDeployed: new Date(),
                rowCount: await this.getRowCount(model.name)
              });
              deployed.push(model.name);
            } else {
              await storage.updateSqlModel(model.id, {
                status: 'error'
              });
              failed.push(model.name);
            }
          } catch (error) {
            console.error(`Failed to deploy model ${model.name}:`, error);
            await storage.updateSqlModel(model.id, {
              status: 'error'
            });
            failed.push(model.name);
          }
        }
      }

      // Update pipeline run
      await storage.updatePipelineRun(pipelineRun.id, {
        status: failed.length === 0 ? 'completed' : 'failed',
        endTime: new Date(),
        logs: `Deployed: ${deployed.join(', ')}${failed.length > 0 ? `\nFailed: ${failed.join(', ')}` : ''}`
      });

      return {
        success: failed.length === 0,
        deployed,
        failed
      };
    } catch (error) {
      console.error('Failed to deploy models:', error);
      return {
        success: false,
        deployed,
        failed: [...failed, 'Unknown error occurred']
      };
    }
  }

  async executeCustomSQL(sql: string, description?: string): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const result = await snowflakeService.executeQuery(sql);
      return { success: true, result };
    } catch (error) {
      console.error('Failed to execute custom SQL:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async createModelFromSQL(name: string, layer: string, sql: string, description?: string): Promise<SqlModel> {
    const model = await storage.createSqlModel({
      name,
      layer,
      sqlContent: sql,
      description: description || this.extractDescription(sql),
      status: 'not_deployed'
    });

    // Save to file system
    const filePath = path.join(this.sqlFolderPath, layer, `${name}.sql`);
    await this.ensureDirectoryExists(path.dirname(filePath));
    await fs.writeFile(filePath, sql, 'utf-8');

    return model;
  }

  private extractDescription(sqlContent: string): string {
    // Extract description from SQL comments
    const lines = sqlContent.split('\n');
    const commentLines = lines
      .filter(line => line.trim().startsWith('--'))
      .map(line => line.replace(/^--\s*/, ''))
      .slice(0, 3); // Take first 3 comment lines

    return commentLines.length > 0 
      ? commentLines.join(' ').trim()
      : 'No description available';
  }

  private async getRowCount(viewName: string): Promise<number> {
    try {
      const result = await snowflakeService.executeQuery(`SELECT COUNT(*) as count FROM ${viewName}`);
      return result[0]?.count || 0;
    } catch (error) {
      console.warn(`Failed to get row count for ${viewName}:`, error);
      return 0;
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async getModelDependencies(modelName: string): Promise<string[]> {
    const models = await storage.getSqlModels();
    const model = models.find(m => m.name === modelName);
    
    if (!model) return [];

    // Simple dependency analysis - look for table/view references in SQL
    const dependencies: string[] = [];
    const sqlContent = model.sqlContent.toLowerCase();
    
    for (const otherModel of models) {
      if (otherModel.id !== model.id && sqlContent.includes(otherModel.name.toLowerCase())) {
        dependencies.push(otherModel.name);
      }
    }

    return dependencies;
  }

  async validateSQL(sql: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Simple SQL validation - try to explain the query
      await snowflakeService.executeQuery(`EXPLAIN ${sql}`);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid SQL syntax' 
      };
    }
  }
}

export const sqlExecutorService = new SQLExecutorService();
