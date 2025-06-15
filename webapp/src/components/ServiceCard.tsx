import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MCPService, ServiceMetrics } from '../types';
import { 
  Eye, 
  Clock,
  MemoryStick,
  CheckCircle,
  AlertTriangle,
  Activity
} from 'lucide-react';

interface ServiceCardProps {
  service: MCPService;
  metrics?: ServiceMetrics;
  onAction: (action: string) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, metrics, onAction }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();


  const getStatusIcon = () => {
    switch (service.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };


  const handleCardClick = () => {
    navigate(`/services/${service.id}`);
  };

  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer p-3
        relative overflow-hidden group
      `}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10">
          {getStatusIcon()}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-lg backdrop-blur-sm
          ${service.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
            service.status === 'degraded' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' :
            'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
          {service.status === 'healthy' ? t('status.healthy') : 
           service.status === 'degraded' ? t('dashboard.degraded') :
           service.status === 'unhealthy' ? t('status.unhealthy') : service.status}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm tracking-tight">
          {service.name}
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
            {service.toolCount} tools
          </span>
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-snug line-clamp-2">
          {service.description || `MCP service with ${service.toolCount} available tools`}
        </p>
      </div>
      
      {/* Quick Stats */}
      {metrics && (
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {metrics.responseTime}ms
          </span>
          <span className="flex items-center">
            <MemoryStick className="h-3 w-3 mr-1" />
            {metrics.memoryUsage}MB
          </span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction('response');
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={t('dashboard.response')}
          >
            <Activity className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction('view');
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={t('dashboard.view')}
          >
            <Eye className="h-3 w-3" />
          </button>
        </div>
        <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Explore →
        </span>
      </div>
    </div>
  );
};

export default ServiceCard;