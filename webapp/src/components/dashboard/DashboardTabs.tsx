import React, { useState } from 'react';
import { Server, Activity, Terminal, RefreshCw, Download, Settings, BarChart3 } from 'lucide-react';
// import { useTranslation } from 'react-i18next'; // TODO: Add translations
import { ServiceGrid } from './ServiceGrid';
import { SystemOverview } from './SystemOverview';
import { RecentEvents } from './RecentEvents';
import { MonitoringDashboard } from '../monitoring/MonitoringDashboard';
import { useServiceStore } from '../../stores';
import { ServiceCategory } from '../../types';

interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  actions: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: 'primary' | 'secondary' | 'warning' | 'ghost';
    onClick: () => void;
  }>;
}

interface DashboardTabsProps {
  services: any[];
  metrics: any;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: ServiceCategory | 'all';
  onCategoryChange: (category: ServiceCategory | 'all') => void;
  systemStatus: any;
  events: any[];
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({
  services,
  metrics,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  systemStatus,
  events
}) => {
  // const { t } = useTranslation(); // TODO: Add translations
  const { fetchServices, fetchMetrics } = useServiceStore();
  const [activeTab, setActiveTab] = useState('services');
  const [loading, setLoading] = useState({
    refresh: false,
    export: false,
    terminal: false,
    settings: false
  });

  // Action handlers
  const handleRefreshAll = async () => {
    if (loading.refresh) return;
    setLoading(prev => ({ ...prev, refresh: true }));
    try {
      await Promise.all([fetchServices(), fetchMetrics()]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setLoading(prev => ({ ...prev, refresh: false }));
    }
  };

  const handleExportLogs = async () => {
    if (loading.export) return;
    setLoading(prev => ({ ...prev, export: true }));
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        services: services || [],
        metrics: metrics || {},
        systemInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          url: window.location.href
        }
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `mcp-logs-${timestamp}.json`;
      
      const downloadUrl = URL.createObjectURL(dataBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  const handleOpenTerminal = () => {
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('open-cli-prompt'));
    }
  };

  const handleOpenSettings = () => {
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('open-settings'));
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'services',
      label: '서비스',
      icon: Server,
      actions: [
        {
          id: 'refresh-all',
          label: loading.refresh ? '새로고침중...' : '전체 새로고침',
          icon: RefreshCw,
          variant: 'primary',
          onClick: handleRefreshAll
        }
      ]
    },
    {
      id: 'monitoring',
      label: '모니터링',
      icon: BarChart3,
      actions: [
        {
          id: 'refresh-monitoring',
          label: '모니터링 새로고침',
          icon: RefreshCw,
          variant: 'primary',
          onClick: handleRefreshAll
        }
      ]
    },
    {
      id: 'system',
      label: '시스템',
      icon: Activity,
      actions: [
        {
          id: 'export-logs',
          label: loading.export ? '내보내는중...' : '로그 내보내기',
          icon: Download,
          variant: 'secondary',
          onClick: handleExportLogs
        }
      ]
    },
    {
      id: 'tools',
      label: '도구',
      icon: Terminal,
      actions: [
        {
          id: 'terminal',
          label: '터미널',
          icon: Terminal,
          variant: 'secondary',
          onClick: handleOpenTerminal
        },
        {
          id: 'settings',
          label: '설정',
          icon: Settings,
          variant: 'ghost',
          onClick: handleOpenSettings
        }
      ]
    }
  ];

  const activeTabConfig = tabs.find(tab => tab.id === activeTab);

  const getVariantStyles = (variant: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 text-white hover:bg-blue-700';
      case 'secondary':
        return 'bg-gray-600 text-white hover:bg-gray-700';
      case 'warning':
        return 'bg-orange-600 text-white hover:bg-orange-700';
      case 'ghost':
        return 'bg-transparent text-gray-600 hover:bg-gray-100 border border-gray-300';
      default:
        return 'bg-gray-600 text-white hover:bg-gray-700';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'services':
        return (
          <ServiceGrid
            services={services}
            metrics={metrics}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
          />
        );
      case 'monitoring':
        return <MonitoringDashboard />;
      case 'system':
        return (
          <div className="space-y-6">
            <SystemOverview systemStatus={systemStatus} />
            <RecentEvents events={events.slice(0, 8)} />
          </div>
        );
      case 'tools':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                개발 도구
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                CLI 터미널 및 시스템 설정에 접근할 수 있습니다.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={handleOpenTerminal}
                  className="p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center">
                    <Terminal className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">CLI 터미널</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">명령어 실행</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center">
                    <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">시스템 설정</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">환경 설정</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Actions */}
        {activeTabConfig && activeTabConfig.actions.length > 0 && (
          <div className="flex items-center space-x-2">
            {activeTabConfig.actions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  disabled={loading[action.id as keyof typeof loading]}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${getVariantStyles(action.variant)} ${
                    loading[action.id as keyof typeof loading] ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <ActionIcon className={`h-4 w-4 mr-2 ${loading.refresh && action.id === 'refresh-all' ? 'animate-spin' : ''}`} />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};