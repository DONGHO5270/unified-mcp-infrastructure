import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Play, 
  Star, 
  StarOff, 
  Code, 
  Copy, 
  Download, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Settings
} from 'lucide-react';

interface Tool {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  category?: string;
  examples?: ToolExample[];
}

interface ToolExample {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

interface ToolExecution {
  id: string;
  toolName: string;
  params: any;
  result: ToolResult;
  timestamp: Date;
}

interface ServiceToolsProps {
  serviceId: string;
  isServiceRunning: boolean;
  onExecuteTool?: (toolName: string, params: any) => Promise<ToolResult>;
  favoriteTools?: string[];
  onToggleFavorite?: (toolName: string) => void;
  executionHistory?: ToolExecution[];
}

// Mock tools data - in real app this would come from API
const MOCK_TOOLS: Tool[] = [
  {
    name: 'list_files',
    description: 'List files in a directory',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' },
        recursive: { type: 'boolean', description: 'Include subdirectories' }
      },
      required: ['path']
    },
    examples: [
      {
        name: 'List current directory',
        description: 'List files in current directory',
        parameters: { path: '.', recursive: false }
      }
    ]
  },
  {
    name: 'read_file',
    description: 'Read contents of a file',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
        encoding: { type: 'string', description: 'File encoding', default: 'utf-8' }
      },
      required: ['path']
    }
  },
  {
    name: 'execute_command',
    description: 'Execute a shell command',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds', default: 30 }
      },
      required: ['command']
    }
  }
];

export const ServiceTools: React.FC<ServiceToolsProps> = ({
  serviceId,
  isServiceRunning,
  onExecuteTool,
  favoriteTools = [],
  onToggleFavorite,
  executionHistory = []
}) => {
  const [tools] = useState<Tool[]>(MOCK_TOOLS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolParams, setToolParams] = useState<Record<string, any>>({});
  const [executionResult, setExecutionResult] = useState<ToolResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const categories = ['all', ...Array.from(new Set(tools.map(tool => tool.category).filter(Boolean)))];

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const favoriteToolsList = tools.filter(tool => favoriteTools.includes(tool.name));
  const regularTools = filteredTools.filter(tool => !favoriteTools.includes(tool.name));

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    setExecutionResult(null);
    // Initialize parameters with default values
    const defaultParams: Record<string, any> = {};
    if (tool.inputSchema?.properties) {
      Object.entries(tool.inputSchema.properties).forEach(([key, schema]: [string, any]) => {
        if (schema.default !== undefined) {
          defaultParams[key] = schema.default;
        }
      });
    }
    setToolParams(defaultParams);
  };

  const handleExecuteTool = async () => {
    if (!selectedTool || !onExecuteTool || !isServiceRunning) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await onExecuteTool(selectedTool.name, toolParams);
      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        timestamp: new Date()
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const renderParameterInput = (paramName: string, schema: any) => {
    const value = toolParams[paramName] || '';
    const isRequired = selectedTool?.inputSchema?.required?.includes(paramName);

    const handleChange = (newValue: any) => {
      setToolParams(prev => ({ ...prev, [paramName]: newValue }));
    };

    const commonProps = {
      id: paramName,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        handleChange(e.target.value),
      className: `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
                  focus:outline-none focus:ring-2 focus:ring-blue-500`,
      required: isRequired
    };

    switch (schema.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleChange(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
        );
      case 'number':
      case 'integer':
        return <input type="number" {...commonProps} />;
      default:
        return schema.description?.toLowerCase().includes('multiline') ? (
          <textarea rows={3} {...commonProps} />
        ) : (
          <input type="text" {...commonProps} />
        );
    }
  };

  const ToolCard: React.FC<{ tool: Tool; isFavorite?: boolean }> = ({ tool, isFavorite = false }) => (
    <div 
      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-sm ${
        selectedTool?.name === tool.name 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onClick={() => handleToolSelect(tool)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {tool.name}
            </h3>
            {tool.category && (
              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                {tool.category}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {tool.description}
          </p>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(tool.name);
          }}
          className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
        >
          {isFavorite ? (
            <Star className="h-4 w-4 fill-current text-yellow-500" />
          ) : (
            <StarOff className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tool List */}
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category || '')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category ? category.charAt(0).toUpperCase() + category.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Service Status Warning */}
        {!isServiceRunning && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Service is not running. Start the service to execute tools.
              </p>
            </div>
          </div>
        )}

        {/* Favorite Tools */}
        {favoriteToolsList.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Star className="h-4 w-4 mr-2 text-yellow-500" />
              Favorite Tools
            </h3>
            <div className="space-y-2">
              {favoriteToolsList.map(tool => (
                <ToolCard key={tool.name} tool={tool} isFavorite />
              ))}
            </div>
          </div>
        )}

        {/* All Tools */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Available Tools ({regularTools.length})
          </h3>
          <div className="space-y-2">
            {regularTools.map(tool => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        </div>
      </div>

      {/* Tool Execution Panel */}
      <div className="space-y-4">
        {selectedTool ? (
          <>
            {/* Tool Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedTool.name}
                </h3>
                <button
                  onClick={() => onToggleFavorite?.(selectedTool.name)}
                  className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"
                >
                  {favoriteTools.includes(selectedTool.name) ? (
                    <Star className="h-4 w-4 fill-current text-yellow-500" />
                  ) : (
                    <StarOff className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedTool.description}
              </p>
            </div>

            {/* Parameters */}
            {selectedTool.inputSchema?.properties && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Parameters
                </h4>
                <div className="space-y-3">
                  {Object.entries(selectedTool.inputSchema.properties).map(([paramName, schema]: [string, any]) => (
                    <div key={paramName}>
                      <label 
                        htmlFor={paramName}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        {paramName}
                        {selectedTool.inputSchema?.required?.includes(paramName) && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {renderParameterInput(paramName, schema)}
                      {schema.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {schema.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Examples */}
                {selectedTool.examples && selectedTool.examples.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Examples
                    </h5>
                    <div className="space-y-2">
                      {selectedTool.examples.map((example, index) => (
                        <button
                          key={index}
                          onClick={() => setToolParams(example.parameters)}
                          className="w-full p-2 text-left text-xs bg-gray-50 dark:bg-gray-700 rounded border hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {example.name}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            {example.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execute Button */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleExecuteTool}
                    disabled={!isServiceRunning || isExecuting}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isExecuting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {isExecuting ? 'Executing...' : 'Execute Tool'}
                  </button>
                </div>
              </div>
            )}

            {/* Execution Result */}
            {executionResult && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    {executionResult.success ? (
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                    )}
                    Execution Result
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {executionResult.executionTime}ms
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(executionResult, null, 2))}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Copy result"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded border p-3">
                  <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-auto">
                    {executionResult.success 
                      ? JSON.stringify(executionResult.data, null, 2)
                      : executionResult.error
                    }
                  </pre>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Select a Tool
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose a tool from the list to view its parameters and execute it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};