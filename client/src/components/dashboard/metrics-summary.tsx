import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricsSummaryProps {
  metrics: any[];
}

function getStatusColor(goalProgress: string) {
  const progress = parseInt(goalProgress);
  
  if (progress >= 90) {
    return "bg-green-500";
  } else if (progress >= 70) {
    return "bg-yellow-500";
  } else {
    return "bg-red-500";
  }
}

export default function MetricsSummary({ metrics }: MetricsSummaryProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Metrics Status
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {metrics.slice(0, 9).map((metric) => (
          <div
            key={metric.id}
            className="flex items-center space-x-2"
          >
            <div className={`w-3 h-3 rounded-full ${getStatusColor(metric.goalProgress)}`}></div>
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {metric.name.split(' ').slice(0, 2).join(' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}