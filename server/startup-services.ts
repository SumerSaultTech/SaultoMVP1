/**
 * Startup services utility - automatically starts Python services if not running
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import net from 'net';

const execAsync = promisify(exec);

/**
 * Detect available Python command
 */
async function detectPythonCommand(): Promise<string | null> {
  const pythonCommands = [
    process.env.PYTHON_COMMAND || '',
    'python3',
    'python',
    'py'
  ].filter(Boolean);

  for (const cmd of pythonCommands) {
    try {
      await execAsync(`${cmd} --version`);
      console.log(`🐍 Found Python: ${cmd}`);
      return cmd;
    } catch (error) {
      // Command not found, try next
    }
  }
  
  console.warn('⚠️ No Python command found. Tried:', pythonCommands.join(', '));
  return null;
}

/**
 * Check if a port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Start Python connector service if not already running
 */
async function startConnectorService(pythonCmd: string): Promise<boolean> {
  try {
    console.log('🔍 Checking Python Connector Service (port 5002)...');
    
    if (await isPortInUse(5002)) {
      console.log('✅ Python Connector Service already running');
      return true;
    }

    console.log('🚀 Starting Python Connector Service...');
    
    // Create virtual environment and install dependencies
    try {
      console.log('🔧 Setting up Python virtual environment...');
      await execAsync(`${pythonCmd} -m venv venv`);

      const pipPath = process.platform === 'win32'
        ? path.join('venv', 'Scripts', 'pip.exe')
        : path.join('venv', 'bin', 'pip');

      if (fs.existsSync(pipPath)) {
        await execAsync(`"${pipPath}" install -q -r requirements_simple_connectors.txt`);
        console.log('✅ Virtual environment ready with dependencies');
      } else {
        // Fallback to system pip
        await execAsync(`${pythonCmd} -m pip install -q -r requirements_simple_connectors.txt`);
      }
    } catch (error) {
      console.warn('⚠️ Warning: Could not setup virtual environment, trying system Python');
      try {
        await execAsync(`${pythonCmd} -m pip install -q -r requirements_simple_connectors.txt`);
      } catch (pipError) {
        console.warn('⚠️ Warning: Could not install Python dependencies');
      }
    }

    // Start the simplified connector service using venv Python if available
    const venvPython = process.platform === 'win32'
      ? path.join('venv', 'Scripts', 'python.exe')
      : path.join('venv', 'bin', 'python');

    let connectorProcess;
    if (process.platform === 'win32') {
      const pythonExec = fs.existsSync(venvPython) ? `"${venvPython}"` : pythonCmd;
      connectorProcess = spawn(pythonExec, ['python_services/start_simple_connector_service.py'], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });
    } else {
      const pythonExec = fs.existsSync(venvPython) ? `"${venvPython}"` : pythonCmd;
      connectorProcess = spawn(pythonExec, ['python_services/start_simple_connector_service.py'], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });
    }

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

// Removed Snowflake service startup - now using PostgreSQL only

/**
 * Start Python connector service
 */
export async function startPythonServices(): Promise<void> {
  console.log('🔧 Auto-starting Python connector service...');
  
  // Check if Python auto-start is disabled
  if (process.env.DISABLE_PYTHON_AUTOSTART === 'true') {
    console.log('⏭️ Python auto-start disabled via DISABLE_PYTHON_AUTOSTART=true');
    console.log('💡 App will use fallback responses for connector service');
    return;
  }
  
  // Detect available Python command
  const pythonCmd = await detectPythonCommand();
  if (!pythonCmd) {
    console.log('❌ Python not found. Skipping Python service startup.');
    console.log('💡 Install Python or set PYTHON_COMMAND environment variable');
    console.log('💡 App will use fallback responses for connector service');
    return;
  }
  
  // Start connector service only (PostgreSQL handles analytics data)
  const connectorStarted = await startConnectorService(pythonCmd);

  if (connectorStarted) {
    console.log('🎉 Python Connector Service started successfully!');
    console.log('📊 Analytics data will be stored in PostgreSQL schemas');
  } else {
    console.log('⚠️ Python connector service failed to start automatically');
    console.log('💡 You can start it manually:');
    console.log(`   - ${pythonCmd} python_services/start_simple_connector_service.py`);
  }
}

/**
 * Check status of all services
 */
export async function checkServiceStatus(): Promise<{
  main: boolean;
  connectors: boolean;
  postgres: boolean;
}> {
  const connectors = await isPortInUse(5002);

  return {
    main: true, // If this code is running, main service is up
    connectors,
    postgres: true // PostgreSQL is always available via DATABASE_URL
  };
}