import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Settings, 
  MoreVertical,
  FileText,
  Download,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { MCPService } from '../../types';

interface ServiceActionsProps {
  service: MCPService;
  isLoading?: boolean;
  onStart?: () => Promise<void>;
  onStop?: () => Promise<void>;
  onRestart?: () => Promise<void>;
  onConfigure?: () => void;
  onViewLogs?: () => void;
  onExportConfig?: () => void;
  disabled?: boolean;
}

export const ServiceActions: React.FC<ServiceActionsProps> = ({
  service,
  isLoading = false,
  onStart,
  onStop,
  onRestart,
  onConfigure,
  onViewLogs,
  onExportConfig,
  disabled = false
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleAction = async (action: string, handler?: () => Promise<void>) => {
    if (!handler || disabled || isLoading) return;

    // For destructive actions, show confirmation
    if (['stop', 'restart'].includes(action)) {
      setShowConfirm(action);
      return;
    }

    try {
      setActionLoading(action);
      await handler();
    } catch (error) {
      console.error(`Failed to ${action} service:`, error);
      // TODO: Show toast notification
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmedAction = async (action: string) => {
    setShowConfirm(null);
    const handler = action === 'stop' ? onStop : action === 'restart' ? onRestart : undefined;
    if (handler) {
      await handleAction(action, handler);
    }
  };

  const isServiceRunning = service.status === 'healthy';
  const isServiceStopped = service.status === 'unhealthy';
  const isServiceDegraded = service.status === 'degraded';

  const getActionButton = (
    action: string,
    icon: React.ReactNode,
    label: string,
    variant: 'primary' | 'secondary' | 'danger' = 'secondary',
    show: boolean = true,
    handler?: () => Promise<void>
  ) => {
    if (!show) return null;

    const baseClasses = `
      inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg
      transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
      focus:outline-none focus:ring-2 focus:ring-offset-2
    `;

    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    };

    const isActionLoading = actionLoading === action;

    return (
      <button
        onClick={() => handleAction(action, handler)}
        disabled={disabled || isLoading || isActionLoading}
        className={`${baseClasses} ${variantClasses[variant]}`}
        title={label}
      >
        {isActionLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <span className="mr-2">{icon}</span>
        )}
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Primary Actions */}
      <div className="flex items-center space-x-2">
        {getActionButton(
          'start',
          <Play className="h-4 w-4" />,
          'Start',
          'primary',
          isServiceStopped,
          onStart
        )}

        {getActionButton(
          'stop',
          <Square className="h-4 w-4" />,
          'Stop',
          'danger',
          isServiceRunning,
          onStop
        )}

        {getActionButton(
          'restart',
          <RotateCcw className="h-4 w-4" />,
          'Restart',
          'secondary',
          isServiceRunning || isServiceDegraded,
          onRestart
        )}

        {getActionButton(
          'configure',
          <Settings className="h-4 w-4" />,
          'Configure',
          'secondary',
          true,
          onConfigure ? async () => { onConfigure(); } : undefined
        )}
      </div>

      {/* Error State Actions */}
      {service.status === 'unhealthy' && (
        <div className="flex items-center space-x-2">
          <div className="flex items-center px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="text-sm">Service Error</span>
          </div>
        </div>
      )}

      {/* More Actions Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowDropdown(false)} 
            />
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
              <div className="py-1">
                {onViewLogs && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onViewLogs();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <FileText className="h-4 w-4 mr-3" />
                    View Logs
                  </button>
                )}
                
                {onExportConfig && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onExportConfig();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <Download className="h-4 w-4 mr-3" />
                    Export Config
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Confirm {showConfirm === 'stop' ? 'Stop' : 'Restart'} Service
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to {showConfirm} the <strong>{service.name}</strong> service?
              {showConfirm === 'stop' && ' This will make the service unavailable until restarted.'}
              {showConfirm === 'restart' && ' This may cause a brief interruption in service.'}
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              
              <button
                onClick={() => handleConfirmedAction(showConfirm)}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                  showConfirm === 'stop' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {showConfirm === 'stop' ? 'Stop Service' : 'Restart Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};