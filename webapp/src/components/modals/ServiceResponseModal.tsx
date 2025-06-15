import React from 'react';
import { X, Activity, MemoryStick, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ServiceResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  type: 'response' | 'memory';
  data: any;
  error?: string;
}

const ServiceResponseModal: React.FC<ServiceResponseModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  type,
  data,
  error
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('dashboard.error')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {error}
            </p>
          </div>
        </div>
      );
    }

    if (type === 'response') {
      const toolsCount = data?.tools?.length || 0;
      return (
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('dashboard.serviceResponse')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {serviceId}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('dashboard.toolCount')}
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {toolsCount}
              </span>
            </div>
          </div>

          {data?.tools && data.tools.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('dashboard.availableTools')}:
              </p>
              <div className="max-h-60 overflow-y-auto">
                <ul className="space-y-1">
                  {data.tools.map((tool: any, index: number) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                      • {tool.name || tool}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (type === 'memory') {
      return (
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <MemoryStick className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('dashboard.memoryUsage')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {serviceId}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dashboard.currentUsage')}
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {data.memoryUsage || 0} MB
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dashboard.cpuUsage')}
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {data.cpuUsage || 0}%
                </p>
              </div>
            </div>
          </div>

          {data.responseTime && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dashboard.responseTime')}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {data.responseTime} ms
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              error ? 'bg-red-50 dark:bg-red-900/20' : 
              type === 'response' ? 'bg-blue-50 dark:bg-blue-900/20' : 
              'bg-green-50 dark:bg-green-900/20'
            }`}>
              {error ? (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : type === 'response' ? (
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <MemoryStick className="h-5 w-5 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {type === 'response' ? t('dashboard.serviceResponse') : t('dashboard.serviceMetrics')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {serviceId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceResponseModal;