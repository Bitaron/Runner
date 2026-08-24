'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface DropdownProps {
  items: DropdownItem[];
  trigger: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  items,
  trigger,
  align = 'left',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Move focus to the first item when the menu opens.
  useEffect(() => {
    if (isOpen) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }, [isOpen]);

  const closeAndRefocusTrigger = useCallback(() => {
    setIsOpen(false);
    dropdownRef.current?.querySelector<HTMLElement>('[data-dropdown-trigger]')?.focus();
  }, []);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        closeAndRefocusTrigger();
        break;
      case 'ArrowDown': {
        e.preventDefault();
        const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
        menuItems[(currentIndex + 1) % menuItems.length]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
        menuItems[(currentIndex - 1 + menuItems.length) % menuItems.length]?.focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        break;
      case 'End':
        e.preventDefault();
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[items.length - 1]?.focus();
        break;
    }
  };

  const handleItemClick = (item: DropdownItem) => {
    if (item.disabled) return;
    item.onClick?.();
    closeAndRefocusTrigger();
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <div
        data-dropdown-trigger
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          } else if (e.key === 'ArrowDown' && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        {trigger}
      </div>
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'absolute z-50 mt-1 py-1 bg-[#2d2d2d] border border-[#3d3d3d] rounded-md shadow-lg min-w-[160px]',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                item.danger
                  ? 'text-[#f44336] hover:bg-[#f44336]/10'
                  : 'text-gray-300 hover:bg-[#3d3d3d] hover:text-gray-100',
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
