import fs from "fs/promises";
import path from "path";
import { storage } from "../storage";
import { snowflakeService } from "./snowflake";

interface DeploymentResult {
  success: boolean;
  deployed: string[];
  failed: { name: string; error: string }[];
  skipped: string[];
}

class SqlRunner {
  private sqlDirectory: string;
  private layers = ["stg", "int", "core"];

  constructor() {
    this.sqlDirectory = path.resolve(process.cwd(), "sql");
  }

  async deployModels(): Promise<DeploymentResult> {
    const result: DeploymentResult = {
      success: true,
      deployed: [],
      failed: [],
      skipped: [],
    };

    try {
      // Deploy models in layer order: stg -> int -> core
      for (const layer of this.layers) {
        await this.deployLayer(layer, result);
      }

      // Log overall deployment activity
      await storage.createPipelineActivity({
        type: "deploy",
        description: `Model deployment completed: ${result.deployed.length} deployed, ${result.failed.length} failed`,
        status: result.failed.length === 0 ? "success" : "warning",
      });

      return result;
    } catch (error) {
      result.success = false;
      await storage.createPipelineActivity({
        type: "error",
        description: `Model deployment failed: ${error.message}`,
        status: "error",
      });
      throw error;
    }
  }

  private async deployLayer(layer: string, result: DeploymentResult): Promise<void> {
    const layerPath = path.join(this.sqlDirectory, layer);
    
    try {
      const files = await fs.readdir(layerPath);
      const sqlFiles = files.filter(file => file.endsWith(".sql"));

      for (const file of sqlFiles) {
        const modelName = file.replace(".sql", "");
        
        try {
          // Check if model already exists and is deployed
          const existingModel = await storage.getSqlModelByName(modelName);
          if (existingModel && existingModel.status === "deployed") {
            result.skipped.push(modelName);
            continue;
          }

          // Read SQL content
          const sqlContent = await fs.readFile(path.join(layerPath, file), "utf-8");

          // Create or update model in storage
          if (existingModel) {
            await storage.updateSqlModel(existingModel.id, {
              sqlContent,
              status: "pending",
            });
          } else {
            await storage.createSqlModel({
              name: modelName,
              layer,
              sqlContent,
              status: "pending",
              dependencies: this.extractDependencies(sqlContent),
            });
          }

          // Deploy to Snowflake
          const deployResult = await snowflakeService.createView(modelName, sqlContent);
          
          if (deployResult.success) {
            // Update model status
            const model = await storage.getSqlModelByName(modelName);
            if (model) {
              await storage.updateSqlModel(model.id, {
                status: "deployed",
                deployedAt: new Date(),
              });
            }
            
            result.deployed.push(modelName);
            
            await storage.createPipelineActivity({
              type: "deploy",
              description: `Successfully deployed ${modelName}`,
              status: "success",
            });
          } else {
            throw new Error(deployResult.error || "Deployment failed");
          }
        } catch (error) {
          result.failed.push({ name: modelName, error: error.message });
          
          // Update model status to error
          const model = await storage.getSqlModelByName(modelName);
          if (model) {
            await storage.updateSqlModel(model.id, {
              status: "error",
            });
          }

          await storage.createPipelineActivity({
            type: "error",
            description: `Failed to deploy ${modelName}: ${error.message}`,
            status: "error",
          });
        }
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        console.warn(`SQL layer directory not found: ${layerPath}`);
      } else {
        throw error;
      }
    }
  }

  private extractDependencies(sqlContent: string): string[] {
    const dependencies: string[] = [];
    const refPattern = /{{[\s]*ref\(['"]([^'"]+)['"]\)[\s]*}}/g;
    
    let match;
    while ((match = refPattern.exec(sqlContent)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  async validateDependencies(): Promise<{ valid: boolean; errors: string[] }> {
    const models = await storage.getSqlModels();
    const errors: string[] = [];

    for (const model of models) {
      for (const dep of model.dependencies) {
        const depModel = await storage.getSqlModelByName(dep);
        if (!depModel) {
          errors.push(`Model ${model.name} depends on ${dep} which does not exist`);
        } else if (depModel.status !== "deployed") {
          errors.push(`Model ${model.name} depends on ${dep} which is not deployed`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async executeQuery(sql: string): Promise<any> {
    return await snowflakeService.executeQuery(sql);
  }
}

export const sqlRunner = new SqlRunner();
