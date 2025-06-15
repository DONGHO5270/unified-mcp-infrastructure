/**
 * Real-time Metrics Chart Component
 * 실시간 메트릭 시각화 차트 컴포넌트
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import { format, subHours, subDays } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DetailedMetrics, TimeSeriesMetric } from '../../types';
import { performanceLogger } from '../../lib/utils/logger';

// ============ Chart Types ============

export type ChartType = 'line' | 'area' | 'bar';
export type MetricType = 'responseTime' | 'memory' | 'cpu' | 'requests' | 'errors' | 'network' | 'disk';
export type TimeRange = '1h' | '6h' | '24h' | '7d';

export interface ChartConfig {
  type: ChartType;
  metric: MetricType;
  color: string;
  unit: string;
  label: string;
  threshold?: number;
  showTrend?: boolean;
  animate?: boolean;
}

export interface MetricsChartProps {
  serviceId: string;
  metrics: TimeSeriesMetric[];
  config: ChartConfig;
  timeRange?: TimeRange;
  height?: number;
  showControls?: boolean;
  onTimeRangeChange?: (range: TimeRange) => void;
  className?: string;
}

// ============ Chart Configurations ============

const METRIC_CONFIGS: Record<MetricType, Partial<ChartConfig>> = {
  responseTime: {
    color: '#3B82F6',
    unit: 'ms',
    label: 'Response Time',
    threshold: 500
  },
  memory: {
    color: '#10B981',
    unit: 'MB',
    label: 'Memory Usage',
    threshold: 1024
  },
  cpu: {
    color: '#F59E0B',
    unit: '%',
    label: 'CPU Usage',
    threshold: 80
  },
  requests: {
    color: '#6366F1',
    unit: 'req/s',
    label: 'Request Rate'
  },
  errors: {
    color: '#EF4444',
    unit: 'errors',
    label: 'Error Count',
    threshold: 10
  },
  network: {
    color: '#8B5CF6',
    unit: 'MB/s',
    label: 'Network I/O'
  },
  disk: {
    color: '#EC4899',
    unit: 'MB/s',
    label: 'Disk I/O'
  }
};

// ============ Utility Functions ============

const formatTimestamp = (timestamp: string, timeRange: TimeRange): string => {
  const date = new Date(timestamp);
  
  switch (timeRange) {
    case '1h':
    case '6h':
      return format(date, 'HH:mm');
    case '24h':
      return format(date, 'HH:mm');
    case '7d':
      return format(date, 'MM/dd HH:mm');
    default:
      return format(date, 'HH:mm');
  }
};

const formatValue = (value: number, unit: string): string => {
  if (unit === '%') {
    return `${value.toFixed(1)}%`;
  } else if (unit === 'ms') {
    return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
  } else if (unit === 'MB' || unit === 'MB/s') {
    return value >= 1024 ? `${(value / 1024).toFixed(2)}GB` : `${value.toFixed(1)}MB`;
  } else if (unit === 'req/s') {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);
  } else {
    return value.toFixed(0);
  }
};

const calculateTrend = (data: TimeSeriesMetric[]): 'up' | 'down' | 'stable' => {
  if (data.length < 2) return 'stable';
  
  const recent = data.slice(-10);
  const older = data.slice(-20, -10);
  
  const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
  const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;
  
  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
};

// ============ Custom Tooltip ============

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  config: ChartConfig;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, config }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-semibold" style={{ color: config.color }}>
        {config.label}: {formatValue(payload[0].value, config.unit)}
      </p>
      {config.threshold && payload[0].value > config.threshold && (
        <p className="text-xs text-red-500 mt-1">⚠️ Above threshold</p>
      )}
    </div>
  );
};

// ============ Main Chart Component ============

export const MetricsChart: React.FC<MetricsChartProps> = ({
  serviceId,
  metrics,
  config,
  timeRange = '1h',
  height = 300,
  showControls = true,
  onTimeRangeChange,
  className = ''
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(timeRange);
  const [isAnimated, setIsAnimated] = useState(config.animate ?? true);

  // 전체 설정 병합
  const fullConfig = useMemo(() => ({
    ...METRIC_CONFIGS[config.metric],
    ...config
  }), [config]);

  // 데이터 포맷팅
  const chartData = useMemo(() => {
    performanceLogger.start('format-chart-data');
    const result = metrics.map(m => ({
      timestamp: formatTimestamp(m.timestamp, selectedRange),
      value: m.value,
      rawTimestamp: m.timestamp
    }));
    performanceLogger.end('format-chart-data', { service: serviceId, metric: config.metric });
    return result;
  }, [metrics, selectedRange, serviceId, config.metric]);

  // 트렌드 계산
  const trend = useMemo(() => {
    if (!config.showTrend) return null;
    return calculateTrend(metrics);
  }, [metrics, config.showTrend]);

  // 통계 계산
  const stats = useMemo(() => {
    if (metrics.length === 0) return null;
    
    const values = metrics.map(m => m.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      current: values[values.length - 1]
    };
  }, [metrics]);

  // 시간 범위 변경
  const handleTimeRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    onTimeRangeChange?.(range);
  };

  // 차트 렌더링
  const renderChart = () => {
    const chartProps = {
      data: chartData,
      margin: { top: 5, right: 5, left: 5, bottom: 5 }
    };

    const lineProps = {
      type: 'monotone' as const,
      dataKey: 'value',
      stroke: fullConfig.color,
      strokeWidth: 2,
      dot: false,
      animationDuration: isAnimated ? 500 : 0
    };

    switch (fullConfig.type) {
      case 'area':
        return (
          <AreaChart {...chartProps}>
            <defs>
              <linearGradient id={`gradient-${serviceId}-${config.metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fullConfig.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={fullConfig.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12 }}
              stroke="#6B7280"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#6B7280"
              tickFormatter={(value) => formatValue(value, fullConfig.unit)}
            />
            <Tooltip content={<CustomTooltip config={fullConfig} />} />
            {fullConfig.threshold && (
              <ReferenceLine 
                y={fullConfig.threshold} 
                stroke="#EF4444" 
                strokeDasharray="5 5"
                label={{ value: 'Threshold', position: 'right', fontSize: 11 }}
              />
            )}
            <Area 
              {...lineProps}
              fill={`url(#gradient-${serviceId}-${config.metric})`}
            />
            {chartData.length > 50 && <Brush dataKey="timestamp" height={30} />}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12 }}
              stroke="#6B7280"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#6B7280"
              tickFormatter={(value) => formatValue(value, fullConfig.unit)}
            />
            <Tooltip content={<CustomTooltip config={fullConfig} />} />
            {fullConfig.threshold && (
              <ReferenceLine 
                y={fullConfig.threshold} 
                stroke="#EF4444" 
                strokeDasharray="5 5"
                label={{ value: 'Threshold', position: 'right', fontSize: 11 }}
              />
            )}
            <Bar 
              dataKey="value" 
              fill={fullConfig.color}
              animationDuration={isAnimated ? 500 : 0}
            />
          </BarChart>
        );

      case 'line':
      default:
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12 }}
              stroke="#6B7280"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#6B7280"
              tickFormatter={(value) => formatValue(value, fullConfig.unit)}
            />
            <Tooltip content={<CustomTooltip config={fullConfig} />} />
            {fullConfig.threshold && (
              <ReferenceLine 
                y={fullConfig.threshold} 
                stroke="#EF4444" 
                strokeDasharray="5 5"
                label={{ value: 'Threshold', position: 'right', fontSize: 11 }}
              />
            )}
            <Line {...lineProps} />
            {chartData.length > 50 && <Brush dataKey="timestamp" height={30} />}
          </LineChart>
        );
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${fullConfig.color}20` }}>
            <Activity className="h-5 w-5" style={{ color: fullConfig.color }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {fullConfig.label}
            </h3>
            {stats && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Current: {formatValue(stats.current, fullConfig.unit)}
                {trend && (
                  <span className="ml-2">
                    {trend === 'up' && <TrendingUp className="inline h-3 w-3 text-red-500" />}
                    {trend === 'down' && <TrendingDown className="inline h-3 w-3 text-green-500" />}
                    {trend === 'stable' && <Minus className="inline h-3 w-3 text-gray-400" />}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-1">
              {(['1h', '6h', '24h', '7d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handleTimeRangeChange(range)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedRange === range
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsAnimated(!isAnimated)}
              className={`p-1 rounded transition-colors ${
                isAnimated 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-400 dark:text-gray-600'
              }`}
              title="Toggle animation"
            >
              <Activity className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartData.length > 0 ? (
            renderChart()
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No data available for the selected time range
              </p>
            </div>
          )}
        </ResponsiveContainer>
      </div>

      {/* Stats Footer */}
      {stats && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Min</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {formatValue(stats.min, fullConfig.unit)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Max</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {formatValue(stats.max, fullConfig.unit)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Avg</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {formatValue(stats.avg, fullConfig.unit)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Points</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {metrics.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Multi-Metrics Chart Component ============

export interface MultiMetricsChartProps {
  serviceId: string;
  metrics: Record<MetricType, TimeSeriesMetric[]>;
  configs: ChartConfig[];
  timeRange?: TimeRange;
  height?: number;
  syncCursor?: boolean;
  className?: string;
}

export const MultiMetricsChart: React.FC<MultiMetricsChartProps> = ({
  serviceId,
  metrics,
  configs,
  timeRange = '1h',
  height = 200,
  syncCursor = true,
  className = ''
}) => {
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);

  return (
    <div className={`grid grid-cols-1 gap-4 ${className}`}>
      {configs.map((config) => (
        <MetricsChart
          key={config.metric}
          serviceId={serviceId}
          metrics={metrics[config.metric] || []}
          config={config}
          timeRange={timeRange}
          height={height}
          showControls={false}
        />
      ))}
    </div>
  );
};