import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface MetricsSummaryProps {
  metrics: any[];
}

function getStatusIcon(goalProgress: string) {
  const progress = parseInt(goalProgress);
  
  if (progress >= 90) {
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  } else if (progress >= 70) {
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  } else {
    return <XCircle className="h-4 w-4 text-red-600" />;
  }
}

function getStatusText(goalProgress: string) {
  const progress = parseInt(goalProgress);
  
  if (progress >= 90) {
    return "On Track";
  } else if (progress >= 70) {
    return "At Risk";
  } else {
    return "Behind";
  }
}

function getStatusColor(goalProgress: string) {
  const progress = parseInt(goalProgress);
  
  if (progress >= 90) {
    return "text-green-600 bg-green-50 border-green-200";
  } else if (progress >= 70) {
    return "text-yellow-600 bg-yellow-50 border-yellow-200";
  } else {
    return "text-red-600 bg-red-50 border-red-200";
  }
}

export default function MetricsSummary({ metrics }: MetricsSummaryProps) {
  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
          Metrics Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.slice(0, 8).map((metric) => (
          <div
            key={metric.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(metric.goalProgress)}`}
          >
            <div className="flex items-center space-x-3">
              {getStatusIcon(metric.goalProgress)}
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {metric.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {metric.goalProgress}% of goal
                </div>
              </div>
            </div>
            <div className="text-xs font-medium">
              {getStatusText(metric.goalProgress)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}