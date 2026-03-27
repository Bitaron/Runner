'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { BookOpen, Rocket, FileText, Info, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type HelpTab = 'quickstart' | 'shortcuts' | 'releases' | 'about';

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>('quickstart');

  const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
    { id: 'quickstart', label: 'Quick Start', icon: <Rocket className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'releases', label: 'Release Notes', icon: <FileText className="w-4 h-4" /> },
    { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  const shortcuts = [
    { keys: '⌘ + K', description: 'Open global search' },
    { keys: '⌘ + Enter', description: 'Send request' },
    { keys: '⌘ + N', description: 'New request tab' },
    { keys: '⌘ + W', description: 'Close current tab' },
    { keys: '⌘ + S', description: 'Save request' },
    { keys: '⌘ + B', description: 'Toggle sidebar' },
    { keys: '⌘ + \\', description: 'Toggle layout (horizontal/vertical)' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help">
      <div className="flex h-[400px]">
        {/* Sidebar */}
        <div className="w-48 border-r border-[#3d3d3d] pr-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded transition-colors ${
                activeTab === tab.id
                  ? "bg-[#ff6b35] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 pl-4 overflow-y-auto">
          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Quick Start Guide</h3>
              <div className="space-y-3">
                <div className="p-3 bg-[#2d2d2e] rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-1">1. Create a Request</h4>
                  <p className="text-xs text-gray-400">Click "New Request" or press ⌘N to create a new API request.</p>
                </div>
                <div className="p-3 bg-[#2d2d2e] rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-1">2. Enter API URL</h4>
                  <p className="text-xs text-gray-400">Type your API endpoint in the URL field.</p>
                </div>
                <div className="p-3 bg-[#2d2d2e] rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-1">3. Select Method</h4>
                  <p className="text-xs text-gray-400">Choose GET, POST, PUT, DELETE, etc. from the dropdown.</p>
                </div>
                <div className="p-3 bg-[#2d2d2e] rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-1">4. Add Headers & Body</h4>
                  <p className="text-xs text-gray-400">Use the tabs to add headers, params, body, and authentication.</p>
                </div>
                <div className="p-3 bg-[#2d2d2e] rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-1">5. Send Request</h4>
                  <p className="text-xs text-gray-400">Click "Send" or press ⌘+Enter to execute your request.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-[#3d3d3d]">
                    <span className="text-sm text-gray-300">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs bg-[#3d3d3d] text-gray-300 rounded">{shortcut.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'releases' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Release Notes</h3>
              <div className="space-y-3">
                <div className="p-3 bg-[#2d2d2e] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">v1.0.0</span>
                    <span className="text-xs text-gray-400">Current</span>
                  </div>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>• Initial release</li>
                    <li>• HTTP request builder</li>
                    <li>• Collections and folders</li>
                    <li>• Environments and variables</li>
                    <li>• WebSocket support</li>
                    <li>• Team collaboration</li>
                    <li>• Import/Export (Postman format)</li>
                    <li>• Code generation</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">About Runner</h3>
              <div className="p-4 bg-[#2d2d2e] rounded-lg">
                <div className="text-center">
                  <h4 className="text-xl font-bold text-white mb-2">Runner</h4>
                  <p className="text-sm text-gray-400 mb-4">Version 1.0.0</p>
                  <p className="text-xs text-gray-400">
                    A powerful API testing tool similar to Postman.
                    Built with Next.js, Express, and CouchDB.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
