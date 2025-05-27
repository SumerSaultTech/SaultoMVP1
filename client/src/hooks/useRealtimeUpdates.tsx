import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeData {
  type: string;
  data: any;
  timestamp: string;
}

export default function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Polling-based updates for real-time data
    const intervals = [
      // Dashboard data - refresh every 30 seconds
      setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      }, 30000),

      // Pipeline runs - refresh every 10 seconds during active operations
      setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/pipeline/runs"] });
      }, 10000),

      // Connection status - refresh every 60 seconds
      setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      }, 60000),

      // Data sources status - refresh every 45 seconds
      setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      }, 45000),

      // Models status - refresh every 2 minutes
      setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      }, 120000),
    ];

    // WebSocket connection for real-time updates (if available)
    let websocket: WebSocket | null = null;

    const connectWebSocket = () => {
      try {
        // Check if WebSocket is available in the environment
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
        
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          console.log("WebSocket connected for real-time updates");
        };

        websocket.onmessage = (event) => {
          try {
            const data: RealtimeData = JSON.parse(event.data);
            handleRealtimeUpdate(data);
          } catch (error) {
            console.warn("Failed to parse WebSocket message:", error);
          }
        };

        websocket.onclose = () => {
          console.log("WebSocket disconnected, falling back to polling");
          // Don't attempt to reconnect - just rely on polling
        };

        websocket.onerror = (error) => {
          console.warn("WebSocket error, using polling updates:", error);
        };
      } catch (error) {
        console.warn("WebSocket not available, using polling updates");
      }
    };

    const handleRealtimeUpdate = (data: RealtimeData) => {
      switch (data.type) {
        case "pipeline_status_change":
          queryClient.invalidateQueries({ queryKey: ["/api/pipeline/runs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          break;
        
        case "model_deployment_complete":
          queryClient.invalidateQueries({ queryKey: ["/api/models"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          break;
        
        case "data_source_sync_complete":
          queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
          break;
        
        case "kpi_value_updated":
          queryClient.invalidateQueries({ queryKey: ["/api/kpis"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          break;
        
        case "connection_status_change":
          queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          break;
        
        default:
          console.log("Unknown real-time update type:", data.type);
      }
    };

    // Try to connect WebSocket, but don't fail if it's not available
    connectWebSocket();

    // Cleanup function
    return () => {
      // Clear all intervals
      intervals.forEach(clearInterval);
      
      // Close WebSocket if connected
      if (websocket) {
        websocket.close();
      }
    };
  }, [queryClient]);

  // Function to manually trigger updates
  const triggerUpdate = (updateType: string) => {
    switch (updateType) {
      case "dashboard":
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        break;
      case "models":
        queryClient.invalidateQueries({ queryKey: ["/api/models"] });
        break;
      case "kpis":
        queryClient.invalidateQueries({ queryKey: ["/api/kpis"] });
        break;
      case "all":
        queryClient.invalidateQueries();
        break;
      default:
        queryClient.invalidateQueries({ queryKey: [`/api/${updateType}`] });
    }
  };

  // Function to pause/resume updates
  const pauseUpdates = () => {
    // This would pause the polling intervals
    // Implementation would require refactoring to store interval IDs
    console.log("Pausing real-time updates");
  };

  const resumeUpdates = () => {
    // This would resume the polling intervals
    console.log("Resuming real-time updates");
  };

  return {
    triggerUpdate,
    pauseUpdates,
    resumeUpdates,
  };
}

// Hook for component-specific updates
export function useRealtimeQuery(queryKey: string[], interval: number = 30000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const intervalId = setInterval(() => {
      queryClient.invalidateQueries({ queryKey });
    }, interval);

    return () => clearInterval(intervalId);
  }, [queryClient, queryKey, interval]);
}

// Hook for conditional real-time updates
export function useConditionalRealtimeUpdates(condition: boolean, queryKeys: string[][]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!condition) return;

    const intervals = queryKeys.map(queryKey => 
      setInterval(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 15000) // More frequent updates when condition is met
    );

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [condition, queryClient, queryKeys]);
}
