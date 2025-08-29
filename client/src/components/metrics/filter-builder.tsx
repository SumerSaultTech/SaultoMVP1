import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Brain, Database, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types for filter system
export interface FilterCondition {
  column: string;
  op: string;
  value: string | number | string[];
}

export interface FilterGroup {
  op: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}

export type FilterTree = FilterGroup | FilterCondition;

// Available data sources (fact tables)
const DATA_SOURCES = [
  {
    id: "core.fact_financials",
    name: "Financial Data",
    description: "Revenue, expenses, and financial metrics",
    fields: [
      { name: "invoice_amount", type: "number", label: "Invoice Amount" },
      { name: "expense_amount", type: "number", label: "Expense Amount" },
      { name: "transaction_date", type: "date", label: "Transaction Date" },
      { name: "category", type: "string", label: "Category" },
      { name: "customer_id", type: "string", label: "Customer ID" }
    ]
  },
  {
    id: "core.fact_hubspot",
    name: "HubSpot CRM",
    description: "Deals, contacts, and sales data",
    fields: [
      { name: "stage", type: "string", label: "Deal Stage" },
      { name: "deal_type", type: "string", label: "Deal Type" },
      { name: "priority", type: "string", label: "Priority" },
      { name: "amount", type: "number", label: "Deal Amount" },
      { name: "close_date", type: "date", label: "Close Date" },
      { name: "owner", type: "string", label: "Deal Owner" }
    ]
  },
  {
    id: "core.fact_jira",
    name: "Jira Issues",
    description: "Project issues and tickets",
    fields: [
      { name: "status", type: "string", label: "Issue Status" },
      { name: "priority", type: "string", label: "Priority" },
      { name: "issue_type", type: "string", label: "Issue Type" },
      { name: "assignee", type: "string", label: "Assignee" },
      { name: "created_date", type: "date", label: "Created Date" },
      { name: "story_points", type: "number", label: "Story Points" }
    ]
  },
  {
    id: "core.fact_salesforce",
    name: "Salesforce",
    description: "Opportunities and accounts",
    fields: [
      { name: "stage_name", type: "string", label: "Stage Name" },
      { name: "type", type: "string", label: "Opportunity Type" },
      { name: "lead_source", type: "string", label: "Lead Source" },
      { name: "amount", type: "number", label: "Amount" },
      { name: "probability", type: "number", label: "Probability" },
      { name: "account_name", type: "string", label: "Account Name" }
    ]
  }
];

// Available operators
const OPERATORS = [
  { value: "=", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater than or equal" },
  { value: "<=", label: "less than or equal" },
  { value: "IN", label: "in list" },
  { value: "NOT IN", label: "not in list" },
  { value: "IS NULL", label: "is empty" },
  { value: "IS NOT NULL", label: "is not empty" },
  { value: "LIKE", label: "contains" },
  { value: "NOT LIKE", label: "does not contain" }
];

interface FilterBuilderProps {
  initialFilter?: FilterTree;
  onFilterChange: (filter: FilterTree) => void;
  onDataSourceChange?: (dataSource: string) => void;
  metricName?: string;
  metricDescription?: string;
}

export default function FilterBuilder({ initialFilter, onFilterChange, onDataSourceChange, metricName, metricDescription }: FilterBuilderProps) {
  const [selectedDataSource, setSelectedDataSource] = useState<string>("");
  const [filterTree, setFilterTree] = useState<FilterGroup>({
    op: "AND",
    conditions: []
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [filterMode, setFilterMode] = useState<"none" | "manual" | "ai">("none");
  const { toast } = useToast();

  // Initialize with existing filter
  useEffect(() => {
    if (initialFilter) {
      if ('conditions' in initialFilter) {
        setFilterTree(initialFilter);
      } else {
        // Single condition, wrap in group
        setFilterTree({
          op: "AND",
          conditions: [initialFilter]
        });
      }
    }
  }, [initialFilter]);

  // Initialize AI prompt with metric description
  useEffect(() => {
    if (metricDescription && !aiPrompt) {
      setAiPrompt(metricDescription);
    }
  }, [metricDescription, aiPrompt]);

  // Notify parent of changes
  useEffect(() => {
    onFilterChange(filterTree);
  }, [filterTree, onFilterChange]);

  // Get available fields for selected data source
  const getAvailableFields = () => {
    const source = DATA_SOURCES.find(ds => ds.id === selectedDataSource);
    return source?.fields || [];
  };

  // Add a new condition
  const addCondition = (groupIndex?: number) => {
    const newCondition: FilterCondition = {
      column: "",
      op: "=",
      value: ""
    };

    setFilterTree(prev => {
      if (groupIndex !== undefined) {
        // Add to specific group
        const updated = { ...prev };
        const group = updated.conditions[groupIndex] as FilterGroup;
        group.conditions.push(newCondition);
        return updated;
      } else {
        // Add to root
        return {
          ...prev,
          conditions: [...prev.conditions, newCondition]
        };
      }
    });
  };

  // Add a new group
  const addGroup = (logicOp: "AND" | "OR" = "AND") => {
    const newGroup: FilterGroup = {
      op: logicOp,
      conditions: []
    };

    setFilterTree(prev => ({
      ...prev,
      conditions: [...prev.conditions, newGroup]
    }));
  };

  // Update condition
  const updateCondition = (conditionIndex: number, field: keyof FilterCondition, value: any, groupIndex?: number) => {
    setFilterTree(prev => {
      const updated = { ...prev };
      
      if (groupIndex !== undefined) {
        // Update condition in specific group
        const group = updated.conditions[groupIndex] as FilterGroup;
        const condition = group.conditions[conditionIndex] as FilterCondition;
        (condition as any)[field] = value;
      } else {
        // Update condition in root
        const condition = updated.conditions[conditionIndex] as FilterCondition;
        (condition as any)[field] = value;
      }
      
      return updated;
    });
  };

  // Remove condition
  const removeCondition = (conditionIndex: number, groupIndex?: number) => {
    setFilterTree(prev => {
      const updated = { ...prev };
      
      if (groupIndex !== undefined) {
        // Remove from specific group
        const group = updated.conditions[groupIndex] as FilterGroup;
        group.conditions.splice(conditionIndex, 1);
      } else {
        // Remove from root
        updated.conditions.splice(conditionIndex, 1);
      }
      
      return updated;
    });
  };

  // Remove entire group
  const removeGroup = (groupIndex: number) => {
    setFilterTree(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, index) => index !== groupIndex)
    }));
  };

  // Handle manual filter mode selection
  const handleManualMode = () => {
    setFilterMode("manual");
    // Auto-select a reasonable default data source if description suggests one
    if (metricDescription && !selectedDataSource) {
      autoSelectDataSource();
    }
  };

  // Handle AI filter mode selection
  const handleAIMode = async () => {
    setFilterMode("ai");
    setAiPrompt(metricDescription || "");
    
    // Auto-select data source and generate filter if we have enough info
    if (metricDescription) {
      autoSelectDataSource();
      // Small delay to allow data source selection to complete
      setTimeout(() => {
        generateAIFilter();
      }, 100);
    }
  };

  // Auto-select most appropriate data source based on metric description
  const autoSelectDataSource = () => {
    if (!metricDescription) return;
    
    const description = metricDescription.toLowerCase();
    let bestMatch = "";
    
    // Simple keyword matching to suggest data source
    if (description.includes('deal') || description.includes('hubspot') || description.includes('sales pipeline')) {
      bestMatch = "core.fact_hubspot";
    } else if (description.includes('opportunity') || description.includes('salesforce') || description.includes('account')) {
      bestMatch = "core.fact_salesforce";  
    } else if (description.includes('issue') || description.includes('jira') || description.includes('ticket') || description.includes('story')) {
      bestMatch = "core.fact_jira";
    } else if (description.includes('invoice') || description.includes('revenue') || description.includes('financial') || description.includes('expense')) {
      bestMatch = "core.fact_financials";
    } else {
      // Default to financial data for business metrics
      bestMatch = "core.fact_financials";
    }
    
    setSelectedDataSource(bestMatch);
    onDataSourceChange?.(bestMatch);
  };

  // AI-powered filter suggestion
  const generateAIFilter = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "No prompt provided",
        description: "Please enter a description of the filter you want to create",
        variant: "destructive"
      });
      return;
    }

    if (!selectedDataSource) {
      toast({
        title: "No data source selected",
        description: "Please select a data source first",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingAI(true);
    
    try {
      const dataSource = DATA_SOURCES.find(ds => ds.id === selectedDataSource);
      const availableFields = dataSource?.fields || [];
      
      const aiPrompt_detailed = `
You are a SQL filter builder AI. Convert natural language filter descriptions into a JSON filter tree structure.

METRIC CONTEXT:
- Metric Name: ${metricName || 'Not specified'}
- Metric Description: ${metricDescription || 'Not specified'}

AVAILABLE DATA SOURCE: ${dataSource?.name}
DESCRIPTION: ${dataSource?.description}

AVAILABLE FIELDS:
${availableFields.map(f => `- ${f.name} (${f.type}): ${f.label}`).join('\n')}

AVAILABLE OPERATORS:
- = (equals)
- != (not equals) 
- > (greater than)
- < (less than)
- >= (greater than or equal)
- <= (less than or equal)
- IN (in list - for multiple values)
- NOT IN (not in list)
- IS NULL (is empty)
- IS NOT NULL (is not empty)
- LIKE (contains text)
- NOT LIKE (does not contain text)

USER REQUEST: "${aiPrompt}"
METRIC CONTEXT: ${metricName ? `Creating filter for metric: ${metricName}` : 'General business metric filter'}

RESPOND WITH ONLY A VALID JSON FILTER TREE IN THIS FORMAT:

For single condition:
{
  "column": "field_name",
  "op": "operator",
  "value": "value_or_array"
}

For multiple conditions:
{
  "op": "AND|OR",
  "conditions": [
    { "column": "field1", "op": "=", "value": "value1" },
    { "column": "field2", "op": ">", "value": 100 }
  ]
}

For complex nested conditions:
{
  "op": "OR",
  "conditions": [
    {
      "op": "AND", 
      "conditions": [
        { "column": "stage", "op": "=", "value": "closedwon" },
        { "column": "deal_type", "op": "=", "value": "enterprise" }
      ]
    },
    { "column": "priority", "op": "=", "value": "high" }
  ]
}

IMPORTANT RULES:
1. Only use field names that exist in the available fields list
2. Match field types (string values in quotes, numbers without quotes)
3. Use IN operator for multiple values: "value": ["val1", "val2", "val3"]
4. For date fields, use YYYY-MM-DD format
5. Be case-sensitive with field names
6. Respond with ONLY the JSON, no explanations

Convert the user request into the appropriate filter structure:`;

      const response = await fetch('/api/ai-assistant/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: aiPrompt_detailed,
          context: `Filter builder for ${dataSource?.name} data source`
        })
      });
      
      if (!response.ok) {
        throw new Error('AI service unavailable');
      }
      
      const data = await response.json();
      let aiResponse = data.reply || data.response || '';
      
      // Clean up AI response - extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = jsonMatch[0];
      }
      
      // Parse AI response as JSON
      const suggestedFilter = JSON.parse(aiResponse);
      
      // Validate and merge with existing filter
      if (suggestedFilter) {
        // If we have existing conditions, ask user if they want to replace or add
        if (filterTree.conditions.length > 0) {
          const shouldReplace = confirm(
            "You have existing filter conditions. Do you want to:\n\n" +
            "OK = Replace existing filter with AI suggestion\n" +
            "Cancel = Add AI suggestion to existing filter"
          );
          
          if (shouldReplace) {
            setFilterTree('conditions' in suggestedFilter ? suggestedFilter : {
              op: "AND",
              conditions: [suggestedFilter]
            });
          } else {
            // Add as new condition group
            setFilterTree(prev => ({
              op: "AND",
              conditions: [
                ...prev.conditions,
                suggestedFilter
              ]
            }));
          }
        } else {
          // No existing conditions, just set the new filter
          setFilterTree('conditions' in suggestedFilter ? suggestedFilter : {
            op: "AND", 
            conditions: [suggestedFilter]
          });
        }
        
        toast({
          title: "AI Filter Generated",
          description: "Successfully created filter from your description. You can now edit it manually if needed.",
        });
        
        setAiPrompt(""); // Clear the prompt
      }
      
    } catch (error) {
      console.error('AI filter generation failed:', error);
      toast({
        title: "AI Generation Failed",
        description: "Could not generate filter from description. Please try rephrasing or use manual builder.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Render a single condition
  const renderCondition = (condition: FilterCondition, conditionIndex: number, groupIndex?: number, canDelete: boolean = true) => {
    const availableFields = getAvailableFields();
    const selectedField = availableFields.find(f => f.name === condition.column);
    
    return (
      <div key={`condition-${groupIndex}-${conditionIndex}`} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
        {/* Field Selection */}
        <div className="flex-1">
          <Select
            value={condition.column}
            onValueChange={(value) => updateCondition(conditionIndex, 'column', value, groupIndex)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map(field => (
                <SelectItem key={field.name} value={field.name}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {field.type}
                    </Badge>
                    {field.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operator Selection */}
        <div className="w-32">
          <Select
            value={condition.op}
            onValueChange={(value) => updateCondition(conditionIndex, 'op', value, groupIndex)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map(op => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Value Input */}
        {!['IS NULL', 'IS NOT NULL'].includes(condition.op) && (
          <div className="flex-1">
            {condition.op === 'IN' || condition.op === 'NOT IN' ? (
              <Input
                placeholder="val1,val2,val3"
                value={Array.isArray(condition.value) ? condition.value.join(',') : condition.value}
                onChange={(e) => updateCondition(conditionIndex, 'value', e.target.value.split(','), groupIndex)}
              />
            ) : selectedField?.type === 'number' ? (
              <Input
                type="number"
                placeholder="Enter number..."
                value={condition.value}
                onChange={(e) => updateCondition(conditionIndex, 'value', e.target.value, groupIndex)}
              />
            ) : selectedField?.type === 'date' ? (
              <Input
                type="date"
                value={condition.value}
                onChange={(e) => updateCondition(conditionIndex, 'value', e.target.value, groupIndex)}
              />
            ) : (
              <Input
                placeholder="Enter value..."
                value={condition.value}
                onChange={(e) => updateCondition(conditionIndex, 'value', e.target.value, groupIndex)}
              />
            )}
          </div>
        )}

        {/* Delete Button */}
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeCondition(conditionIndex, groupIndex)}
            className="text-red-600 hover:text-red-800 hover:bg-red-100"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  // Render a condition group
  const renderGroup = (group: FilterGroup, groupIndex: number) => {
    return (
      <Card key={`group-${groupIndex}`} className="border-2 border-dashed border-gray-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant={group.op === "AND" ? "default" : "secondary"}>
                {group.op}
              </Badge>
              Group {groupIndex + 1}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeGroup(groupIndex)}
              className="text-red-600 hover:text-red-800 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Logic operator selector for group */}
          <div className="flex items-center gap-2">
            <Label className="text-xs">Logic:</Label>
            <Select
              value={group.op}
              onValueChange={(value: "AND" | "OR") => {
                setFilterTree(prev => {
                  const updated = { ...prev };
                  (updated.conditions[groupIndex] as FilterGroup).op = value;
                  return updated;
                });
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Render conditions in group */}
          {group.conditions.map((condition, conditionIndex) => {
            if ('conditions' in condition) {
              // Nested group - for now just render as condition
              return <div key={conditionIndex} className="text-xs text-gray-500 p-2 bg-yellow-50 rounded">
                Nested groups not yet supported in UI
              </div>;
            }
            return renderCondition(condition, conditionIndex, groupIndex, group.conditions.length > 1);
          })}

          {/* Add condition to group */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addCondition(groupIndex)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Condition to Group
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className="border-0 bg-gray-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-primary" />
            Data Filtering
          </CardTitle>
          {filterMode !== "none" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterMode("none");
                setSelectedDataSource("");
                setFilterTree({ op: "AND", conditions: [] });
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Mode Selection - Auto select manual */}
        {filterMode === "none" && (
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={handleManualMode}
              variant="outline"
              className="flex items-center justify-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Add Filters
            </Button>
          </div>
        )}

        {/* Data Source Selection (compact) */}
        {filterMode !== "none" && (
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Database className="h-4 w-4 text-gray-500" />
              Data Source:
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {DATA_SOURCES.find(ds => ds.id === selectedDataSource)?.name || "Auto-selected"}
            </Badge>
            <div className="text-xs text-gray-500">
              {DATA_SOURCES.find(ds => ds.id === selectedDataSource)?.fields.length} fields
            </div>
          </div>
        )}

        {/* AI Input (compact) */}
        {filterMode === "ai" && (
          <div className="space-y-3 p-4 bg-blue-50/50 rounded-lg border border-blue-200/50">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-medium text-blue-900">AI Filter Description</Label>
            </div>
            <Textarea
              placeholder="Describe your filtering needs..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="resize-none bg-white border-blue-200 focus:border-blue-400"
              rows={2}
            />
            <Button
              type="button"
              onClick={generateAIFilter}
              disabled={!aiPrompt.trim() || isGeneratingAI}
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isGeneratingAI ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="h-3 w-3 mr-2" />
                  Generate Filters
                </>
              )}
            </Button>
          </div>
        )}

        {/* Filter Builder */}
        {filterMode !== "none" && (
          <div className="space-y-3">
            {selectedDataSource ? (
              <>
                {/* Active Filters */}
                {filterTree.conditions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Active Filters {filterMode === "ai" && <Badge variant="secondary" className="text-xs">AI Generated</Badge>}
                      </Label>
                    </div>
                    <div className="space-y-3 p-3 bg-white rounded-lg border">
                      {filterTree.conditions.map((item, index) => {
                        if ('conditions' in item) {
                          return renderGroup(item, index);
                        } else {
                          return renderCondition(item, index, undefined, filterTree.conditions.length > 1);
                        }
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 bg-white rounded-lg border border-dashed">
                    <Filter className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm">No filters configured</p>
                  </div>
                )}

                {/* Add Controls (compact) */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCondition()}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add Filter
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addGroup()}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add Group
                  </Button>
                </div>

              </>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <div className="animate-pulse">Setting up filters...</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}