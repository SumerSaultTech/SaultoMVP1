import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, DollarSign, RefreshCw } from "lucide-react";

interface KpiCardsProps {
  onRefresh: () => void;
}

export default function KpiCards({ onRefresh }: KpiCardsProps) {
  const { data: kpiMetrics, isLoading } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  // Default KPI values if none exist
  const defaultKpis = [
    {
      name: "Annual Recurring Revenue",
      value: "$2.4M",
      changePercent: "+12.5%",
      icon: DollarSign,
      colorClass: "arr"
    },
    {
      name: "Monthly Churn Rate",
      value: "3.2%",
      changePercent: "-0.8%",
      icon: Users,
      colorClass: "churn"
    },
    {
      name: "Customer Lifetime Value",
      value: "$18,750",
      changePercent: "+5.2%",
      icon: TrendingUp,
      colorClass: "ltv"
    }
  ];

  const kpis = kpiMetrics && kpiMetrics.length > 0 ? kpiMetrics : defaultKpis;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <CardTitle>Core Business KPIs</CardTitle>
          <Button variant="ghost" size="sm" disabled>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-50 rounded-lg p-6 border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="w-5 h-5 bg-gray-200 rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <CardTitle>Core Business KPIs</CardTitle>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {kpis.map((kpi: any, index: number) => {
            const Icon = kpi.icon || DollarSign;
            const isPositive = kpi.changePercent?.startsWith('+') || 
                             (kpi.name?.toLowerCase().includes('churn') && kpi.changePercent?.startsWith('-'));
            
            return (
              <div key={kpi.id || index} className={`kpi-card ${kpi.colorClass || 'arr'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-700">{kpi.name}</h4>
                  <Icon className="h-5 w-5 text-blue-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                  {kpi.changePercent && (
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                        isPositive 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}>
                        {kpi.changePercent}
                      </span>
                      <span className="text-sm text-gray-500">vs last quarter</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
