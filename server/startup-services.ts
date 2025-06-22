/**
 * Startup services utility - automatically starts Python services if not running
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if a port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`lsof -Pi :${port} -sTCP:LISTEN -t`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Start Python connector service if not already running
 */
async function startConnectorService(): Promise<boolean> {
  try {
    console.log('🔍 Checking Python Connector Service (port 5002)...');
    
    if (await isPortInUse(5002)) {
      console.log('✅ Python Connector Service already running');
      return true;
    }

    console.log('🚀 Starting Python Connector Service...');
    
    // Install dependencies first
    try {
      await execAsync('pip install -q -r requirements_simple_connectors.txt');
    } catch (error) {
      console.warn('⚠️ Warning: Could not install Python dependencies');
    }

    // Start the simplified connector service (no pandas dependency)
    const connectorProcess = spawn('python', ['start_simple_connector_service.py'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Log output for debugging
    connectorProcess.stdout?.on('data', (data) => {
      console.log(`[Connector] ${data.toString().trim()}`);
    });
    
    connectorProcess.stderr?.on('data', (data) => {
      console.log(`[Connector Error] ${data.toString().trim()}`);
    });

    // Wait a bit and check if it started
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (await isPortInUse(5002)) {
      console.log('✅ Python Connector Service started successfully');
      return true;
    } else {
      console.warn('⚠️ Python Connector Service may have failed to start');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to start Python Connector Service:', error);
    return false;
  }
}

/**
 * Start Snowflake Python service if not already running
 */
async function startSnowflakeService(): Promise<boolean> {
  try {
    console.log('🔍 Checking Snowflake Python Service (port 5001)...');
    
    if (await isPortInUse(5001)) {
      console.log('✅ Snowflake Python Service already running');
      return true;
    }

    console.log('🚀 Starting Snowflake Python Service...');
    
    const snowflakeProcess = spawn('python', ['start_python_service.py'], {
      detached: true,
      stdio: 'pipe'
    });

    // Wait a bit and check if it started
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (await isPortInUse(5001)) {
      console.log('✅ Snowflake Python Service started successfully');
      return true;
    } else {
      console.warn('⚠️ Snowflake Python Service may have failed to start');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to start Snowflake Python Service:', error);
    return false;
  }
}

/**
 * Start all Python services
 */
export async function startPythonServices(): Promise<void> {
  console.log('🔧 Auto-starting Python services...');
  
  // Start services in parallel
  const [connectorStarted, snowflakeStarted] = await Promise.all([
    startConnectorService(),
    startSnowflakeService()
  ]);

  if (connectorStarted && snowflakeStarted) {
    console.log('🎉 All Python services started successfully!');
  } else if (connectorStarted) {
    console.log('✅ Python Connector Service started (Snowflake service failed)');
  } else if (snowflakeStarted) {
    console.log('✅ Snowflake Python Service started (Connector service failed)');
  } else {
    console.log('⚠️ Python services failed to start automatically');
    console.log('💡 You can start them manually:');
    console.log('   - python start_simple_connector_service.py');
    console.log('   - python start_python_service.py');
  }
}

/**
 * Check status of all services
 */
export async function checkServiceStatus(): Promise<{
  main: boolean;
  connectors: boolean;
  snowflake: boolean;
}> {
  const [connectors, snowflake] = await Promise.all([
    isPortInUse(5002),
    isPortInUse(5001)
  ]);

  return {
    main: true, // If this code is running, main service is up
    connectors,
    snowflake
  };
}