import React, { useState, useEffect } from 'react';
import { MCPService, ServiceMetrics, CLIPromptData } from '../types';
import ServiceCard from './ServiceCard';
import Header from './Header';
import CLIPromptModal from './CLIPromptModal';
import { Activity, Server, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  services: MCPService[];
  metrics: Record<string, ServiceMetrics>;
  onServiceAction: (serviceId: string, action: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  services, 
  metrics, 
  onServiceAction 
}) => {
  const [cliPrompt, setCLIPrompt] = useState<CLIPromptData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;

  const handleServiceAction = (serviceId: string, action: string) => {
    if (action === 'restart' || action === 'deploy' || action === 'scale') {
      setCLIPrompt({
        command: `mcp ${action} ${serviceId}`,
        reason: `${action} requires CLI authentication for security`,
        documentation: `/docs/cli-commands#${action}`,
        securityLevel: 'HIGH_RISK'
      });
    } else {
      onServiceAction(serviceId, action);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      {/* System Overview */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <Server className="h-8 w-8 text-primary-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Services</p>
                <p className="text-2xl font-semibold text-gray-900">{services.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-success-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Healthy</p>
                <p className="text-2xl font-semibold text-success-600">{healthyCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-warning-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Degraded</p>
                <p className="text-2xl font-semibold text-warning-600">{degradedCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-error-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Unhealthy</p>
                <p className="text-2xl font-semibold text-error-600">{unhealthyCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredServices.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              metrics={metrics[service.id]}
              onAction={(action) => handleServiceAction(service.id, action)}
            />
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-500">Try adjusting your search query</p>
          </div>
        )}
      </div>

      {/* CLI Prompt Modal */}
      {cliPrompt && (
        <CLIPromptModal
          isOpen={!!cliPrompt}
          onClose={() => setCLIPrompt(null)}
          command={cliPrompt.command}
          reason={cliPrompt.reason}
          documentation={cliPrompt.documentation}
        />
      )}
    </div>
  );
};

export default Dashboard;