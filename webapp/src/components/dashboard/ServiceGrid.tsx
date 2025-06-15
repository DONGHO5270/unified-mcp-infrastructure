import React, { useMemo, useState } from 'react';
import { Search, Grid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MCPService, ServiceMetrics, ServiceCategory } from '../../types';
import ServiceCard from '../ServiceCard';
import { apiClient } from '../../lib/api/client';
import { useServiceStore } from '../../stores';
import ServiceResponseModal from '../modals/ServiceResponseModal';

interface ServiceGridProps {
  services: MCPService[];
  metrics: Record<string, ServiceMetrics>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: ServiceCategory | 'all';
  onCategoryChange: (category: ServiceCategory | 'all') => void;
}

const getCategoryLabel = (value: ServiceCategory | 'all', t: any) => {
  const labelMap: Record<ServiceCategory | 'all', string> = {
    'all': t('dashboard.allServices'),
    'development': t('dashboard.development'),
    'ai-tools': t('dashboard.aiTools'),
    'infrastructure': t('dashboard.infrastructure'),
    'data-processing': t('dashboard.dataProcessing'),
    'monitoring': t('dashboard.monitoring'),
    'communication': t('dashboard.communication'),
    'security': t('dashboard.security'),
    'other': t('dashboard.other')
  };
  return labelMap[value] || value;
};

export const ServiceGrid: React.FC<ServiceGridProps> = ({
  services,
  metrics,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { restartService } = useServiceStore();
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState<'name' | 'status' | 'tools'>('name');
  
  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    serviceId: string;
    type: 'response' | 'memory';
    data: any;
    error?: string;
  }>({
    isOpen: false,
    serviceId: '',
    type: 'response',
    data: null,
    error: undefined
  });
  
  const CATEGORIES: Array<{ value: ServiceCategory | 'all'; label: string; color: string }> = [
    { value: 'all', label: getCategoryLabel('all', t), color: 'gray' },
    { value: 'development', label: getCategoryLabel('development', t), color: 'blue' },
    { value: 'ai-tools', label: getCategoryLabel('ai-tools', t), color: 'purple' },
    { value: 'infrastructure', label: getCategoryLabel('infrastructure', t), color: 'green' },
    { value: 'data-processing', label: getCategoryLabel('data-processing', t), color: 'yellow' },
    { value: 'monitoring', label: getCategoryLabel('monitoring', t), color: 'red' }
  ];

  // Sort services
  const sortedServices = useMemo(() => {
    const sorted = [...services];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'status':
        const statusOrder = { healthy: 0, degraded: 1, unhealthy: 2 };
        sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
      case 'tools':
        sorted.sort((a, b) => b.toolCount - a.toolCount);
        break;
    }
    
    return sorted;
  }, [services, sortBy]);

  const handleServiceAction = async (action: string, serviceId: string) => {
    switch (action) {
      case 'view':
        navigate(`/service/${serviceId}`);
        break;
      case 'logs':
        navigate(`/service/${serviceId}?tab=logs`);
        break;
      case 'restart':
        try {
          await restartService(serviceId);
          console.log(`Service ${serviceId} restart initiated`);
        } catch (error) {
          console.error(`Failed to restart service ${serviceId}:`, error);
        }
        break;
      case 'response':
        // MCP 서비스에 테스트 요청 보내기
        try {
          const response = await apiClient.mcpRequest(serviceId, 'tools/list');
          console.log(`Service ${serviceId} response:`, response);
          setModalState({
            isOpen: true,
            serviceId,
            type: 'response',
            data: response.data,
            error: undefined
          });
        } catch (error) {
          console.error(`Failed to get response from ${serviceId}:`, error);
          setModalState({
            isOpen: true,
            serviceId,
            type: 'response',
            data: null,
            error: String(error)
          });
        }
        break;
      case 'memory':
        // 메트릭 표시
        const serviceMetrics = metrics[serviceId];
        if (serviceMetrics) {
          setModalState({
            isOpen: true,
            serviceId,
            type: 'memory',
            data: serviceMetrics,
            error: undefined
          });
        } else {
          setModalState({
            isOpen: true,
            serviceId,
            type: 'memory',
            data: null,
            error: t('dashboard.noMetricsAvailable')
          });
        }
        break;
      default:
        console.log(`Unknown action: ${action} for ${serviceId}`);
    }
  };


  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('dashboard.services')} ({services.length})
          </h2>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('dashboard.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Filters */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {CATEGORIES.map(category => (
              <button
                key={category.value}
                onClick={() => onCategoryChange(category.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  selectedCategory === category.value
                    ? category.value === 'all'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : `bg-${category.color}-100 dark:bg-${category.color}-900/20 text-${category.color}-700 dark:text-${category.color}-400`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Sort Options */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.sortBy')}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">{t('dashboard.name')}</option>
              <option value="status">{t('dashboard.status')}</option>
              <option value="tools">{t('dashboard.toolCount')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Services Grid/List */}
      <div className="p-4">
        {sortedServices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {t('dashboard.noServicesFound')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {sortedServices.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                metrics={metrics[service.id]}
                onAction={(action) => handleServiceAction(action, service.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedServices.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                metrics={metrics[service.id]}
                onAction={(action) => handleServiceAction(action, service.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Service Response Modal */}
      <ServiceResponseModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        serviceId={modalState.serviceId}
        type={modalState.type}
        data={modalState.data}
        error={modalState.error}
      />
    </div>
  );
};