import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useServiceStore, useSystemStore } from '../stores';
import { DashboardTabs } from '../components/dashboard/DashboardTabs';
import { ServiceCategory } from '../types';

// Service categories for grouping
const SERVICE_CATEGORIES: Record<string, ServiceCategory> = {
  'code-runner': 'development',
  'github': 'development',
  'npm-sentinel': 'development',
  'code-context-provider': 'development',
  'code-checker': 'development',
  'nodejs-debugger': 'development',
  
  'clear-thought': 'ai-tools',
  'stochastic-thinking': 'ai-tools',
  'taskmaster-ai': 'ai-tools',
  '21stdev-magic': 'ai-tools',
  
  'supabase': 'data-processing',
  'docker': 'infrastructure',
  'mem0': 'data-processing',
  
  'playwright': 'development',
  'vercel': 'infrastructure',
  
  'mermaid': 'ai-tools',
  'context7': 'ai-tools',
  'serena': 'ai-tools',
  'serper-search': 'ai-tools',
  
  'desktop-commander': 'ai-tools'
};

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { services, metrics, fetchServices, fetchMetrics } = useServiceStore();
  const { systemStatus, events, fetchSystemStatus } = useSystemStore();
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch initial data
  useEffect(() => {
    const abortController = new AbortController();
    
    // Fetch with abort signal
    fetchServices(abortController.signal);
    fetchMetrics();
    fetchSystemStatus();
    
    // Refresh data periodically
    const interval = setInterval(() => {
      fetchMetrics();
      fetchSystemStatus();
    }, 30000); // 30 seconds

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [fetchServices, fetchMetrics, fetchSystemStatus]);

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      // Category filter
      if (selectedCategory !== 'all' && SERVICE_CATEGORIES[service.id] !== selectedCategory) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          service.name.toLowerCase().includes(query) ||
          service.id.toLowerCase().includes(query) ||
          service.description?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [services, selectedCategory, searchQuery]);


  return (
    <div className="max-w-7xl mx-auto px-3 py-4 space-y-4">
      {/* Compact Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {t('dashboard.title')}
        </h1>
      </div>


      {/* Tabbed Content */}
      <DashboardTabs
        services={filteredServices}
        metrics={metrics}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        systemStatus={systemStatus}
        events={events}
      />
    </div>
  );
};