import React from 'react';
import { Activity, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SystemOverviewProps {
  systemStatus?: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    systemLoad: number;
    uptime: number;
  } | null;
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({ systemStatus }) => {
  const { t } = useTranslation();
  
  const formatUptime = (uptimeSeconds: number) => {
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (!systemStatus) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('dashboard.systemOverview')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">{t('dashboard.loadingSystemStatus')}</p>
      </div>
    );
  }

  const {
    totalServices,
    healthyServices,
    degradedServices,
    unhealthyServices,
    systemLoad,
    uptime
  } = systemStatus;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('dashboard.systemOverview')}
      </h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                {t('dashboard.healthyServices')}
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {healthyServices}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                {t('dashboard.issues')}
              </p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {degradedServices + unhealthyServices}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('dashboard.systemLoad')}
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {systemLoad.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                {t('dashboard.uptime')}
              </p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatUptime(uptime)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};