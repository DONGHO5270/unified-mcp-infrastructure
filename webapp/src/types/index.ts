// MCP Service Types
export interface MCPService {
  id: string;
  name: string;
  status: ServiceStatus;
  toolCount: number;
  description?: string;
  version?: string;
  lastUpdated: string;
  // Extended properties for UI components
  category?: ServiceCategory;
  endpoint?: string;
  dockerImage?: string;
  tags?: string[];
  dependencies?: string[];
}

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy';

export type ServiceCategory = 
  | 'ai-tools' 
  | 'development' 
  | 'infrastructure' 
  | 'data-processing' 
  | 'communication' 
  | 'security' 
  | 'monitoring' 
  | 'other';

export interface ServiceMetrics {
  responseTime: number;
  responseTimeTrend: 'up' | 'down' | 'stable';
  memoryUsage: number;
  memoryTrend: 'up' | 'down' | 'stable';
  cpuUsage: number;
  cpuTrend: 'up' | 'down' | 'stable';
  errorRate: number;
  requestCount: number;
}

export interface HealthStatus {
  status: ServiceStatus;
  checks: HealthCheck[];
  lastCheck: string;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  responseTime?: number;
}

// Dashboard Types
export interface DashboardData {
  services: MCPService[];
  metrics: Record<string, ServiceMetrics>;
  systemOverview: SystemOverview;
}

export interface SystemOverview {
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  totalRequests: number;
  averageResponseTime: number;
  systemUptime: number;
}

// CLI Integration Types
export interface CLICommand {
  command: string;
  description: string;
  securityLevel: 'low' | 'medium' | 'high';
  requiresAuth: boolean;
}

export interface CLIPromptData {
  command: string;
  reason: string;
  documentation?: string;
  securityLevel?: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'service_update' | 'metrics_update' | 'log_entry' | 'system_alert';
  data: any;
  timestamp: string;
}

export interface ServiceUpdateData {
  serviceId: string;
  status: ServiceStatus;
  metrics?: Partial<ServiceMetrics>;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Log Types
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface LogFilter {
  services: string[];
  levels: string[];
  timeRange: string;
  searchQuery?: string;
}

// ============ Enhanced API Types ============

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

// ============ Authentication & Authorization Types ============

export interface AuthToken {
  token: string;
  type: 'bearer' | 'api_key';
  expiresAt: string;
  permissions: Permission[];
  scope: string[];
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  roles: Role[];
  lastLogin?: string;
  isActive: boolean;
  preferences: UserPreferences;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  description?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notificationSettings: NotificationSettings;
  dashboardLayout?: DashboardLayout;
}

export interface NotificationSettings {
  email: boolean;
  browser: boolean;
  slack?: boolean;
  alertLevels: ('info' | 'warn' | 'error' | 'critical')[];
}

// ============ Enhanced Service Types ============

export interface MCPServiceExtended extends MCPService {
  category: ServiceCategory;
  tags: string[];
  dependencies: string[];
  configuration: ServiceConfiguration;
  deployment: DeploymentInfo;
  monitoring: MonitoringConfig;
  documentation?: ServiceDocumentation;
}

export interface ServiceConfiguration {
  envVars: Record<string, string>;
  secrets: string[];
  volumes: VolumeMount[];
  ports: PortMapping[];
  resources: ResourceRequirements;
}

export interface VolumeMount {
  source: string;
  destination: string;
  type: 'bind' | 'volume' | 'tmpfs';
  readonly?: boolean;
}

export interface PortMapping {
  host: number;
  container: number;
  protocol: 'tcp' | 'udp';
}

export interface ResourceRequirements {
  cpu: {
    min: string;
    max: string;
  };
  memory: {
    min: string;
    max: string;
  };
  storage?: {
    min: string;
    max: string;
  };
}

export interface DeploymentInfo {
  strategy: 'rolling' | 'blue-green' | 'canary';
  replicas: number;
  image: string;
  tag: string;
  registry?: string;
  healthCheck: HealthCheckConfig;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
  startPeriod?: number;
}

export interface MonitoringConfig {
  metricsEnabled: boolean;
  logsEnabled: boolean;
  tracingEnabled: boolean;
  alertRules: AlertRule[];
  dashboards: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  duration: string;
  annotations: Record<string, string>;
}

export interface ServiceDocumentation {
  readme?: string;
  apiDocs?: string;
  examples?: string;
  troubleshooting?: string;
  changelog?: string;
}

// ============ Enhanced Metrics Types ============

export interface DetailedMetrics extends ServiceMetrics {
  networkIO: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  diskIO: {
    bytesRead: number;
    bytesWrite: number;
    opsRead: number;
    opsWrite: number;
  };
  customMetrics: Record<string, number>;
}

export interface TimeSeriesMetric {
  timestamp: string;
  value: number;
  tags?: Record<string, string>;
}

export interface MetricsQuery {
  metric: string;
  service?: string;
  timeRange: TimeRange;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  groupBy?: string[];
}

export interface TimeRange {
  start: string;
  end: string;
}

// ============ Event & Notification Types ============

export interface SystemEvent {
  id: string;
  type: EventType;
  source: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export type EventType = 
  | 'service_started'
  | 'service_stopped'
  | 'service_failed'
  | 'service_recovered'
  | 'deployment_started'
  | 'deployment_completed'
  | 'deployment_failed'
  | 'alert_triggered'
  | 'alert_resolved'
  | 'configuration_changed'
  | 'user_action'
  | 'system_maintenance';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  data?: Record<string, any>;
}

export type NotificationType = 
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'maintenance'
  | 'update'
  | 'security';

// ============ Dashboard & UI Types ============

export interface DashboardLayout {
  widgets: DashboardWidget[];
  layout: LayoutConfig;
  theme: ThemeConfig;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: Record<string, any>;
  refreshInterval?: number;
}

export type WidgetType = 
  | 'service-status'
  | 'metrics-chart'
  | 'logs-viewer'
  | 'system-overview'
  | 'alert-list'
  | 'deployment-status'
  | 'custom';

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface LayoutConfig {
  columns: number;
  margin: number;
  padding: number;
  responsive: boolean;
}

export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  border: string;
}

// ============ Backup & Recovery Types ============

export interface BackupConfiguration {
  id: string;
  name: string;
  description?: string;
  schedule: CronExpression;
  targets: BackupTarget[];
  retention: RetentionPolicy;
  encryption: EncryptionConfig;
  notifications: BackupNotificationConfig;
}

export interface BackupTarget {
  type: 'database' | 'files' | 'configuration';
  source: string;
  destination: string;
  compression?: boolean;
  incremental?: boolean;
}

export interface RetentionPolicy {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm?: string;
  keyId?: string;
}

export interface BackupNotificationConfig {
  onSuccess: boolean;
  onFailure: boolean;
  channels: string[];
}

export interface CronExpression {
  expression: string;
  timezone: string;
  description?: string;
}

// ============ Integration Types ============

export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  status: 'active' | 'inactive' | 'error';
  configuration: IntegrationConfig;
  lastSync?: string;
  syncStatus?: SyncStatus;
}

export type IntegrationType = 
  | 'slack'
  | 'discord'
  | 'teams'
  | 'email'
  | 'webhook'
  | 'prometheus'
  | 'grafana'
  | 'elasticsearch'
  | 'github'
  | 'gitlab';

export interface IntegrationConfig {
  endpoint?: string;
  apiKey?: string;
  credentials?: Record<string, string>;
  settings: Record<string, any>;
  webhookSecret?: string;
  retryPolicy?: RetryPolicy;
}

export interface SyncStatus {
  lastSync: string;
  nextSync?: string;
  status: 'success' | 'failure' | 'partial';
  message?: string;
  recordsProcessed?: number;
  recordsFailed?: number;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

// ============ Utility Types ============

export interface KeyValuePair {
  key: string;
  value: any;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export interface SearchResult<T> {
  items: T[];
  query: string;
  totalResults: number;
  searchTime: number;
  facets?: SearchFacet[];
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

export interface ExportRequest {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  data: any[];
  options?: ExportOptions;
}

export interface ExportOptions {
  includeHeaders?: boolean;
  dateFormat?: string;
  delimiter?: string;
  encoding?: string;
  compression?: boolean;
}