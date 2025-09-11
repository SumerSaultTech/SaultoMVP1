/**
 * Number formatting utilities for consistent display across the app
 * Numbers should show 1 decimal place without currency symbols
 */

/**
 * Format a number for display in charts and metrics
 * Shows 1 decimal place, with K/M suffixes for large numbers
 * No currency symbols - just clean numbers
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(1);
}

/**
 * Format actual value for KPI cards and metrics
 * Uses the same formatting as charts for consistency
 */
export function formatActualValue(value: number | string | null): string {
  if (value === null || value === undefined) return '0.0';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0.0';
  return formatNumber(numValue);
}

/**
 * Format percentage values (for progress, etc.)
 * Shows 1 decimal place with % symbol
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format currency values (when explicitly needed)
 * Shows 2 decimal places with $ symbol
 */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}