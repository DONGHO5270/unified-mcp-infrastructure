import React, { useState } from 'react';
import { 
  Server, 
  Clock, 
  Activity, 
  Copy, 
  ExternalLink, 
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  Globe,
  Cpu,
  MemoryStick,
  Network,
  CheckCircle,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { MCPService, ServiceMetrics } from '../../types';

interface ServiceInfoProps {
  service: MCPService;
  metrics?: ServiceMetrics;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const ServiceInfo: React.FC<ServiceInfoProps> = ({
  service,
  metrics,
  onRefresh,
  isLoading = false
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'status']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Show toast notification
      console.log(`Copied ${label}: ${text}`);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusIcon = () => {
    switch (service.status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (service.status) {
      case 'healthy':
        return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'degraded':
        return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      case 'unhealthy':
        return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      default:
        return 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const formatUptime = (lastUpdated: string) => {
    try {
      const date = new Date(lastUpdated);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const InfoSection: React.FC<{
    title: string;
    sectionKey: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ title, sectionKey, icon, children }) => {
    const isExpanded = expandedSections.has(sectionKey);
    
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            {icon}
            <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50">
            {children}
          </div>
        )}
      </div>
    );
  };

  const InfoRow: React.FC<{
    label: string;
    value: string | React.ReactNode;
    copyable?: boolean;
    copyValue?: string;
  }> = ({ label, value, copyable = false, copyValue }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {value}
        </span>
        {copyable && (
          <button
            onClick={() => copyToClipboard(copyValue || value as string, label)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title={`Copy ${label}`}
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Service Information
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Detailed information about {service.name}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          title="Refresh information"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Basic Information */}
      <InfoSection 
        title="Basic Information" 
        sectionKey="basic"
        icon={<Package className="h-5 w-5 text-blue-500" />}
      >
        <div className="space-y-1 pt-3">
          <InfoRow label="Service ID" value={service.id} copyable copyValue={service.id} />
          <InfoRow label="Display Name" value={service.name} />
          <InfoRow label="Description" value={service.description} />
          <InfoRow label="Category" value={
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
              {service.category}
            </span>
          } />
          <InfoRow label="Tool Count" value={service.toolCount.toString()} />
          <InfoRow label="Last Updated" value={formatUptime(service.lastUpdated)} />
        </div>
      </InfoSection>

      {/* Status Information */}
      <InfoSection 
        title="Status Information" 
        sectionKey="status"
        icon={getStatusIcon()}
      >
        <div className="space-y-1 pt-3">
          <InfoRow 
            label="Current Status" 
            value={
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
                {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
              </span>
            } 
          />
          <InfoRow label="Uptime" value={formatUptime(service.lastUpdated)} />
          {service.endpoint && (
            <InfoRow 
              label="Endpoint" 
              value={
                <div className="flex items-center space-x-2">
                  <span>{service.endpoint}</span>
                  <button
                    onClick={() => window.open(service.endpoint, '_blank')}
                    className="text-blue-500 hover:text-blue-700"
                    title="Open endpoint"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              }
              copyable 
              copyValue={service.endpoint} 
            />
          )}
        </div>
      </InfoSection>

      {/* Performance Metrics */}
      {metrics && (
        <InfoSection 
          title="Performance Metrics" 
          sectionKey="metrics"
          icon={<Activity className="h-5 w-5 text-green-500" />}
        >
          <div className="grid grid-cols-2 gap-4 pt-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Response Time
                </span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metrics.responseTime}ms
              </div>
              <div className="text-xs text-blue-600/70 dark:text-blue-400/70">
                Avg response time
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <MemoryStick className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Memory Usage
                </span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {metrics.memoryUsage}MB
              </div>
              <div className="text-xs text-green-600/70 dark:text-green-400/70">
                Current memory
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Cpu className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  CPU Usage
                </span>
              </div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {metrics.cpuUsage}%
              </div>
              <div className="text-xs text-yellow-600/70 dark:text-yellow-400/70">
                Current CPU load
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Network className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  Requests
                </span>
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {metrics.requestCount || 0}
              </div>
              <div className="text-xs text-purple-600/70 dark:text-purple-400/70">
                Total requests
              </div>
            </div>
          </div>
        </InfoSection>
      )}

      {/* Technical Details */}
      <InfoSection 
        title="Technical Details" 
        sectionKey="technical"
        icon={<Globe className="h-5 w-5 text-purple-500" />}
      >
        <div className="space-y-1 pt-3">
          <InfoRow label="Service Type" value="MCP Service" />
          <InfoRow label="Protocol" value="JSON-RPC 2.0" />
          <InfoRow label="Transport" value="HTTP/WebSocket" />
          {service.version && (
            <InfoRow label="Version" value={service.version} />
          )}
          {service.dockerImage && (
            <InfoRow label="Docker Image" value={service.dockerImage} copyable />
          )}
        </div>
      </InfoSection>
    </div>
  );
};