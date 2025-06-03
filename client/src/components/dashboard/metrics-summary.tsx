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
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
          Metrics Status Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {metrics.slice(0, 12).map((metric) => (
            <div
              key={metric.id}
              className="flex flex-col items-center text-center p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
            >
              <div className={`w-4 h-4 rounded-full mb-2 ${getStatusColor(metric.goalProgress)}`}></div>
              <div className="text-xs font-medium text-gray-900 dark:text-white mb-1">
                {metric.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {metric.goalProgress}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}