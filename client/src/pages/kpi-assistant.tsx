import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import ChatInterface from "@/components/assistant/chat-interface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, TrendingUp, Users, DollarSign, BarChart3, Plus } from "lucide-react";

export default function KpiAssistant() {
  const [selectedBusinessType, setSelectedBusinessType] = useState("saas");

  const { data: kpiMetrics, isLoading } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  const businessTypes = [
    { id: "saas", name: "SaaS Business", description: "Subscription-based software" },
    { id: "ecommerce", name: "E-commerce", description: "Online retail business" },
    { id: "marketplace", name: "Marketplace", description: "Platform connecting buyers/sellers" },
    { id: "fintech", name: "Fintech", description: "Financial technology services" },
  ];

  const suggestedKpis = {
    saas: [
      { name: "Monthly Recurring Revenue (MRR)", description: "Predictable monthly revenue from subscriptions", icon: DollarSign, difficulty: "Easy" },
      { name: "Customer Acquisition Cost (CAC)", description: "Cost to acquire each new customer", icon: TrendingUp, difficulty: "Medium" },
      { name: "Net Revenue Retention (NRR)", description: "Revenue retention from existing customers", icon: Users, difficulty: "Hard" },
      { name: "Product-Market Fit Score", description: "How well product meets market demand", icon: BarChart3, difficulty: "Hard" },
    ],
    ecommerce: [
      { name: "Average Order Value (AOV)", description: "Average amount spent per order", icon: DollarSign, difficulty: "Easy" },
      { name: "Customer Lifetime Value (CLV)", description: "Total revenue from a customer", icon: Users, difficulty: "Medium" },
      { name: "Conversion Rate", description: "Percentage of visitors who make purchases", icon: TrendingUp, difficulty: "Easy" },
      { name: "Return on Ad Spend (ROAS)", description: "Revenue generated per dollar of advertising", icon: BarChart3, difficulty: "Medium" },
    ],
    marketplace: [
      { name: "Gross Merchandise Volume (GMV)", description: "Total value of goods sold", icon: DollarSign, difficulty: "Easy" },
      { name: "Take Rate", description: "Percentage of GMV kept as commission", icon: TrendingUp, difficulty: "Medium" },
      { name: "Liquidity Score", description: "Balance between supply and demand", icon: Users, difficulty: "Hard" },
      { name: "Network Effects Strength", description: "Value increase from more users", icon: BarChart3, difficulty: "Hard" },
    ],
    fintech: [
      { name: "Assets Under Management (AUM)", description: "Total value of managed assets", icon: DollarSign, difficulty: "Easy" },
      { name: "Transaction Volume", description: "Total value of processed transactions", icon: TrendingUp, difficulty: "Easy" },
      { name: "Risk-Adjusted Returns", description: "Returns considering risk factors", icon: Users, difficulty: "Hard" },
      { name: "Regulatory Compliance Score", description: "Level of regulatory adherence", icon: BarChart3, difficulty: "Medium" },
    ],
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "bg-green-100 text-green-800";
      case "Medium": return "bg-amber-100 text-amber-800";
      case "Hard": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const currentKpis = suggestedKpis[selectedBusinessType as keyof typeof suggestedKpis] || [];

  return (
    <>
      <Header 
        title="KPI Assistant" 
        subtitle="AI-powered metrics suggestions and SQL generation"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Chat Interface */}
          <ChatInterface />

          {/* Business Type Selection & KPI Suggestions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Business Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Business Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {businessTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedBusinessType(type.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedBusinessType === type.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <h3 className="font-medium text-gray-900">{type.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Current KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Active KPIs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-gray-200 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : kpiMetrics && kpiMetrics.length > 0 ? (
                  <div className="space-y-3">
                    {kpiMetrics.slice(0, 5).map((kpi: any) => (
                      <div key={kpi.id} className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{kpi.name}</h4>
                            <p className="text-sm text-gray-500">{kpi.description}</p>
                          </div>
                          {kpi.value && (
                            <Badge variant="outline">{kpi.value}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No KPIs configured yet</p>
                    <p className="text-sm text-gray-400">Use the assistant to generate and implement KPIs</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Suggested KPIs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Suggested KPIs for {businessTypes.find(t => t.id === selectedBusinessType)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentKpis.map((kpi, index) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Icon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{kpi.name}</h4>
                            <p className="text-sm text-gray-500 mt-1">{kpi.description}</p>
                          </div>
                        </div>
                        <Badge className={getDifficultyColor(kpi.difficulty)}>
                          {kpi.difficulty}
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Generate SQL
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tips & Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle>Tips for Effective KPI Implementation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Best Practices</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Start with 3-5 core KPIs to avoid information overload</li>
                    <li>• Ensure KPIs are actionable and tied to business outcomes</li>
                    <li>• Review and update KPIs quarterly as business evolves</li>
                    <li>• Set realistic targets and track trends over time</li>
                    <li>• Share KPIs with relevant stakeholders for alignment</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Data Quality Tips</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Validate data sources before implementing KPIs</li>
                    <li>• Set up automated alerts for data anomalies</li>
                    <li>• Document calculation methods for consistency</li>
                    <li>• Test KPI calculations with historical data</li>
                    <li>• Monitor data freshness and sync status regularly</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
