/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DEVICE_PRESETS, DevicePreset } from '../data/devicePresets';
import { Search, Plus, Network, Zap, Cpu, Layers } from 'lucide-react';

interface DeviceLibraryProps {
  onAddDevice: (preset: DevicePreset) => void;
}

type CategoryType = 'all' | 'network' | 'power' | 'compute' | 'accessory';

export function DeviceLibrary({ onAddDevice }: DeviceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');

  const categories = [
    { id: 'all', name: 'Tümü', icon: Layers },
    { id: 'network', name: 'Ağ Cihazları', icon: Network },
    { id: 'power', name: 'Güç / Enerji', icon: Zap },
    { id: 'compute', name: 'Bilişim / Sunucu', icon: Cpu },
    { id: 'accessory', name: 'Aksesuarlar', icon: Layers },
  ];

  const filteredPresets = DEVICE_PRESETS.filter((preset) => {
    const matchesSearch = 
      preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || preset.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getSubtypeLabel = (subtype: string) => {
    switch (subtype) {
      case 'router': return 'Yönlendirici';
      case 'switch': return 'Anahtar (Switch)';
      case 'patch_panel': return 'Dağıtım Paneli';
      case 'firewall': return 'Güvenlik Duvarı';
      case 'pdu': return 'Güç Ünitesi (PDU)';
      case 'ups': return 'Güç Kaynağı (UPS)';
      case 'server': return 'Sunucu';
      case 'storage': return 'Depolama';
      case 'organizer': return 'Düzenleyici';
      case 'blank': return 'Kapak / Panel';
      default: return subtype;
    }
  };

  const getCategoryColor = (type: string) => {
    switch (type) {
      case 'network': return 'border-blue-500/20 bg-blue-50/50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400';
      case 'power': return 'border-amber-500/20 bg-amber-50/50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
      case 'compute': return 'border-emerald-500/20 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400';
      default: return 'border-slate-500/20 bg-slate-50/50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400';
    }
  };

  // Handle Drag Start for drag-and-drop to rack
  const handleDragStart = (e: React.DragEvent, preset: DevicePreset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(preset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div id="device-library" className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          Cihaz Kütüphanesi
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cihaz veya model ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Category selector */}
      <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-1 bg-slate-50/30">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id as CategoryType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
              }`}
            >
              <Icon className="h-3 w-3" />
              {category.name}
            </button>
          );
        })}
      </div>

      {/* Preset List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {filteredPresets.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-mono">
            Cihaz bulunamadı.
          </div>
        ) : (
          filteredPresets.map((preset) => {
            // Determine custom colorful square block representing categories in Professional Polish style
            let dotBoxColor = "bg-slate-100";
            let dotColor = "bg-slate-500";
            if (preset.type === 'network') {
              dotBoxColor = "bg-blue-100";
              dotColor = "bg-blue-600";
            } else if (preset.type === 'compute') {
              dotBoxColor = "bg-emerald-100";
              dotColor = "bg-emerald-600";
            } else if (preset.type === 'power') {
              dotBoxColor = "bg-amber-100";
              dotColor = "bg-amber-500";
            }

            return (
              <div
                key={`${preset.subtype}-${preset.model}`}
                draggable
                onDragStart={(e) => handleDragStart(e, preset)}
                className="p-3 border rounded-lg bg-slate-50 cursor-move border-slate-200 hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing group relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 ${dotBoxColor} rounded flex items-center justify-center shrink-0`}>
                      <div className={`w-2.5 h-2.5 ${dotColor} rounded-sm`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-xs leading-tight">{preset.name}</h3>
                      <p className="text-[10px] text-slate-400 font-mono leading-none mt-1">{preset.model}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onAddDevice(preset)}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                    title="Tasarım alanına ekle"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60 pt-2 mt-2 font-mono">
                  <span>{preset.uSize}U • {getSubtypeLabel(preset.subtype)}</span>
                  <span className="text-slate-400">
                    {preset.powerLimit ? `${preset.powerLimit}W` : `${preset.powerDraw}W`}
                  </span>
                </div>
                
                <div className="absolute inset-x-0 bottom-0 text-[9px] text-center bg-blue-50 text-blue-600 font-medium py-0.5 rounded-b opacity-0 group-hover:opacity-100 transition-opacity">
                  Kabine sürükle veya + ile ekle
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
