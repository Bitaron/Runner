'use client';

import React, { useState } from 'react';
import { useCookieStore } from '@/stores/cookieStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Trash2, Plus, Cookie, X } from 'lucide-react';
import type { Cookie as CookieType } from '@apiforge/shared';

export const CookieManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { cookies, addCookie, updateCookie, removeCookie, clearCookies } = useCookieStore();
  const [newCookie, setNewCookie] = useState<Partial<CookieType>>({ name: '', value: '', domain: '', path: '/' });

  const handleAdd = () => {
    if (!newCookie.name?.trim() || !newCookie.value?.trim()) return;
    addCookie({
      name: newCookie.name.trim(),
      value: newCookie.value.trim(),
      domain: newCookie.domain?.trim() || undefined,
      path: newCookie.path?.trim() || '/',
      expires: newCookie.expires,
    });
    setNewCookie({ name: '', value: '', domain: '', path: '/' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cookie Jar">
      <div className="space-y-4 max-h-[60vh] overflow-hidden flex flex-col">
        <p className="text-xs text-gray-400">Cookies are automatically captured from responses and sent with matching requests. Manage manually here.</p>

        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-1">
          <span className="col-span-3">Name</span>
          <span className="col-span-3">Value</span>
          <span className="col-span-3">Domain</span>
          <span className="col-span-2">Path</span>
          <span className="col-span-1 text-right">Del</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {cookies.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">No cookies — send a request that returns <code>Set-Cookie</code> to populate.</p>
          ) : (
            cookies.map((c, idx) => (
              <div key={`${c.name}-${c.domain}-${idx}`} className="grid grid-cols-12 gap-2 items-center bg-[#1e1e1e] p-2 rounded border border-[#2d2d2d]">
                <input value={c.name} onChange={(e) => updateCookie(idx, { name: e.target.value })} className="col-span-3 bg-[#2d2d2d] border border-[#3d3d3d] rounded px-2 py-1 text-xs text-gray-200" placeholder="name" />
                <input value={c.value} onChange={(e) => updateCookie(idx, { value: e.target.value })} className="col-span-3 bg-[#2d2d2d] border border-[#3d3d3d] rounded px-2 py-1 text-xs text-gray-200" placeholder="value" />
                <input value={c.domain || ''} onChange={(e) => updateCookie(idx, { domain: e.target.value })} className="col-span-3 bg-[#2d2d2d] border border-[#3d3d3d] rounded px-2 py-1 text-xs text-gray-200" placeholder="example.com" />
                <input value={c.path || ''} onChange={(e) => updateCookie(idx, { path: e.target.value })} className="col-span-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded px-2 py-1 text-xs text-gray-200" placeholder="/" />
                <button onClick={() => removeCookie(idx)} className="col-span-1 flex justify-end text-gray-400 hover:text-red-400" aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[#3d3d3d] pt-3">
          <div className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2"><Cookie className="w-3.5 h-3.5" /> Add Cookie</div>
          <div className="grid grid-cols-12 gap-2">
            <Input value={newCookie.name || ''} onChange={(e) => setNewCookie({ ...newCookie, name: e.target.value })} placeholder="name" className="col-span-3" />
            <Input value={newCookie.value || ''} onChange={(e) => setNewCookie({ ...newCookie, value: e.target.value })} placeholder="value" className="col-span-3" />
            <Input value={newCookie.domain || ''} onChange={(e) => setNewCookie({ ...newCookie, domain: e.target.value })} placeholder="domain" className="col-span-3" />
            <Input value={newCookie.path || ''} onChange={(e) => setNewCookie({ ...newCookie, path: e.target.value })} placeholder="/" className="col-span-2" />
            <Button onClick={handleAdd} size="sm" className="col-span-1">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={() => { if (confirm('Clear all cookies?')) clearCookies(); }}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear all
          </Button>
          <Button variant="secondary" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
