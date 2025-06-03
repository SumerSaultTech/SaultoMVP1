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
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
          Metrics Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {metrics.slice(0, 10).map((metric) => (
          <div
            key={metric.id}
            className="flex items-center justify-between py-1"
          >
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(metric.goalProgress)}`}></div>
              <div className="text-sm text-gray-900 dark:text-white truncate">
                {metric.name}
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {metric.goalProgress}%
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}