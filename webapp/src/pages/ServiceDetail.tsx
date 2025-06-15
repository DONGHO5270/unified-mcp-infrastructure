import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Square, RotateCcw, Settings, Activity, FileText } from 'lucide-react';
import { useServiceStore } from '../stores';
import { MetricsChart } from '../components/charts/MetricsChart';
import { LogViewer } from '../components/logs/LogViewer';
import { ServiceActions } from '../components/service/ServiceActions';
import { ServiceInfo } from '../components/service/ServiceInfo';
import { ServiceTools } from '../components/service/ServiceTools';

export const ServiceDetail: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { services, metrics, fetchServiceDetails } = useServiceStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'logs' | 'tools'>('overview');

  const service = services.find(s => s.id === serviceId);
  const serviceMetrics = serviceId ? metrics[serviceId] : undefined;

  useEffect(() => {
    if (serviceId) {
      fetchServiceDetails(serviceId);
    }
  }, [serviceId, fetchServiceDetails]);

  if (!service) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Service not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-2 text-blue-600 hover:text-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'metrics', label: 'Metrics', icon: Activity },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'tools', label: 'Tools', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {service.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {service.description}
            </p>
          </div>
        </div>

        <ServiceActions service={service} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className={`text-lg font-semibold ${
                service.status === 'healthy' ? 'text-green-600' :
                service.status === 'degraded' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {service.status}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              service.status === 'healthy' ? 'bg-green-500' :
              service.status === 'degraded' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Tools</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {service.toolCount}
            </p>
          </div>
        </div>

        {serviceMetrics && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Response Time</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {serviceMetrics.responseTime}ms
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Memory</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {serviceMetrics.memoryUsage}MB
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <ServiceInfo service={service} metrics={serviceMetrics} />
          )}

          {activeTab === 'metrics' && serviceId && (
            <div className="space-y-6">
              <MetricsChart
                serviceId={serviceId}
                metrics={[]} // TODO: Implement time series data
                config={{
                  type: 'line',
                  metric: 'responseTime',
                  color: '#3B82F6',
                  unit: 'ms',
                  label: 'Response Time',
                  showTrend: true
                }}
              />
            </div>
          )}

          {activeTab === 'logs' && serviceId && (
            <LogViewer serviceId={serviceId} />
          )}

          {activeTab === 'tools' && (
            <ServiceTools 
              serviceId={serviceId!} 
              isServiceRunning={service?.status === 'healthy'} 
            />
          )}
        </div>
      </div>
    </div>
  );
};