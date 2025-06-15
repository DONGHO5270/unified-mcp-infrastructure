import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, X } from 'lucide-react';

interface CLIPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  command: string;
  reason: string;
  documentation?: string;
}

const CLIPromptModal: React.FC<CLIPromptModalProps> = ({
  isOpen,
  onClose,
  command,
  reason,
  documentation
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Terminal className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                CLI Authentication Required
              </h3>
              <p className="text-sm text-gray-500">Security verification needed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-600">{reason}</p>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-3">
              Run this command in your terminal:
            </p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto">
                {command}
              </div>
              <button 
                onClick={copyCommand}
                className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success-500" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>
          
          {documentation && (
            <div className="border-t border-gray-100 pt-4">
              <a
                href={documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View Documentation</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CLIPromptModal;