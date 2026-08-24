'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  ariaLabel?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className, ariaLabel }) => {
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();

    const currentIndex = index;
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = tabs.length - 1;

    onChange(tabs[nextIndex].id);
    const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  };

  return (
    <div ref={tablistRef} role="tablist" aria-label={ariaLabel} className={cn('flex border-b border-[#3d3d3d]', className)}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-200',
            'border-b-2 -mb-[2px] focus-visible:outline-none focus-visible:text-[#ff6b35]',
            activeTab === tab.id
              ? 'text-[#ff6b35] border-[#ff6b35]'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-500'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ children, className, id, labelledBy }) => {
  return (
    <div
      id={id ? `tabpanel-${id}` : undefined}
      role="tabpanel"
      aria-labelledby={labelledBy ? `tab-${labelledBy}` : undefined}
      tabIndex={0}
      className={cn('p-4 focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
};
