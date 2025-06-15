import React from 'react';
import { AlertCircle, CheckCircle, Info, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface SystemEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  acknowledged: boolean;
}

interface RecentEventsProps {
  events?: SystemEvent[];
}

export const RecentEvents: React.FC<RecentEventsProps> = ({ events = [] }) => {
  const { t } = useTranslation();
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'low':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'low':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('recentEvents.title')}
        </h2>
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t('recentEvents.noEvents')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t('recentEvents.allSystemsNormal')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('recentEvents.title')}
      </h2>
      
      <div className="space-y-3">
        {events.slice(0, 5).map((event) => (
          <div
            key={event.id}
            className={`p-4 rounded-lg border ${getSeverityBg(event.severity)}`}
          >
            <div className="flex items-start space-x-3">
              {getSeverityIcon(event.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {event.title}
                  </p>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="h-3 w-3 mr-1" />
                    {format(new Date(event.timestamp), 'HH:mm')}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {event.message}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('recentEvents.source')}: {event.source}
                  </span>
                  {!event.acknowledged && (
                    <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      {t('recentEvents.acknowledge')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('recentEvents.viewAll')} ({events.length})
          </button>
        </div>
      )}
    </div>
  );
};