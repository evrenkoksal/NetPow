/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Device, RackSettings } from '../types';
import { Trash2, AlertTriangle, Info, Move, Layers, Settings, Zap, ArrowRightLeft, Cloud, ZoomIn, ZoomOut, Eye, EyeOff } from 'lucide-react';

interface CabinetRackProps {
  devices: Device[];
  rackSettings: RackSettings;
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onRemoveDevice: (deviceId: string) => void;
  onUpdateDevicePosition: (deviceId: string, newPosition: number | null) => void;
  onMountDevice: (deviceId: string, uPosition: number) => void;
}

export function CabinetRack({
  devices,
  rackSettings,
  selectedDeviceId,
  onSelectDevice,
  onRemoveDevice,
  onUpdateDevicePosition,
  onMountDevice,
}: CabinetRackProps) {
  const [draggedOverU, setDraggedOverU] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const { totalU, maxWeightKg, maxPowerW } = rackSettings;

  const rackContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard zoom shortcuts (+ / - to zoom, 0 to reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom(prev => Math.min(1.5, prev + 0.1));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom(prev => Math.max(0.6, prev - 0.1));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Mouse wheel scroll zoom when holding Ctrl / CMD (or touchpad pinch-to-zoom)
  useEffect(() => {
    const handleWheelEvent = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setZoom(prev => Math.min(1.5, Math.max(0.6, prev + delta)));
      }
    };

    const container = rackContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheelEvent, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheelEvent);
      }
    };
  }, []);

  // Find which device occupies which U slots
  // Key: U index, Value: Device object
  const occupiedSlots: { [key: number]: Device } = {};
  devices.forEach((device) => {
    if (device.uPosition !== null) {
      for (let i = 0; i < device.uSize; i++) {
        occupiedSlots[device.uPosition + i] = device;
      }
    }
  });

  // Devices that are not currently mounted in the rack
  const unmountedDevices = devices.filter((d) => d.uPosition === null && !d.isExternal);
  const externalDevices = devices.filter((d) => d.isExternal);

  // Helper to check if a range of slots is free
  const isRangeFree = (startU: number, size: number, excludeDeviceId?: string) => {
    if (startU + size - 1 > totalU || startU < 1) return false;
    for (let i = 0; i < size; i++) {
      const occ = occupiedSlots[startU + i];
      if (occ && occ.id !== excludeDeviceId) {
        return false;
      }
    }
    return true;
  };

  // Drag and Drop handlers for the rack slots
  const handleDragOver = (e: React.DragEvent, uIndex: number) => {
    e.preventDefault();
    setDraggedOverU(uIndex);
  };

  const handleDragLeave = () => {
    setDraggedOverU(null);
  };

  const handleDrop = (e: React.DragEvent, uIndex: number) => {
    e.preventDefault();
    setDraggedOverU(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      if (data.id) {
        // This is an existing device being relocated
        const device = devices.find((d) => d.id === data.id);
        if (device) {
          if (device.isExternal) {
            alert("Harici bağlantı cihazları kabinet içine yerleştirilemez. Onları ağ ve güç topolojisi ekranında dilediğiniz gibi konumlandırabilirsiniz!");
          } else if (uIndex + device.uSize - 1 <= totalU) {
            onUpdateDevicePosition(device.id, uIndex);
          } else {
            alert(`Cihaz kabinet sınırlarının dışına taşıyor (Maksimum U: ${totalU})!`);
          }
        }
      } else {
        // This is a new preset being dragged in
        // App.tsx handles creating the device, but we can pass back the dropped target position.
        // For simplicity, we can let App.tsx handle preset drop by dispatching a custom event,
        // or just let the user add via button and place.
        // Let's pass this to a global window event or custom callback if needed,
        // but wait: we can trigger a custom drop event on App.tsx, or we can handle it directly!
        // To do that, we'll expose a window listener or let the drop trigger standard adding.
        const dropEvent = new CustomEvent('preset-dropped', {
          detail: { preset: data, uPosition: uIndex }
        });
        window.dispatchEvent(dropEvent);
      }
    } catch (err) {
      console.error('Error handling drop', err);
    }
  };

  const handleDeviceDragStart = (e: React.DragEvent, device: Device) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: device.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  // Calculate stats
  const totalWeight = devices.reduce((sum, d) => sum + d.weight, 0);
  const totalPower = devices.reduce((sum, d) => sum + d.powerDraw, 0);
  
  const weightPercentage = Math.min((totalWeight / maxWeightKg) * 100, 100);
  const powerPercentage = Math.min((totalPower / maxPowerW) * 100, 100);
  const filledU = devices.reduce((sum, d) => sum + (d.uPosition !== null ? d.uSize : 0), 0);
  const spacePercentage = (filledU / totalU) * 100;

  // Detect heavy devices placed high in the rack (bad gravity center)
  const highHeavyDevices = devices.filter((d) => {
    if (d.uPosition === null) return false;
    // Heavy device (>= 15kg) placed above middle U
    return d.weight >= 15 && d.uPosition > totalU / 2;
  });

  // Detect redundant PSU devices without full power cabling (analyzed in App.tsx but simplified warning here)
  const redundantPowerAlerts = devices.filter(
    (d) => d.isRedundant && d.ports.filter((p) => p.type === 'power_in').length > 1
  );

  // Render PDU outlets on side rails (0U PDU representation)
  const verticalPDUs = devices.filter((d) => d.subtype === 'pdu');
  const externalNetworkDevices = devices.filter((d) => d.isExternal && d.type === 'network');
  const externalPowerDevices = devices.filter((d) => d.isExternal && d.type === 'power');

  return (
    <div id="cabinet-rack" className="flex flex-col lg:flex-row gap-6 p-6 h-full overflow-y-auto bg-[#F1F5F9]" style={{ backgroundImage: 'radial-gradient(#cbd5e1 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}>
      {/* Visual 19" Rack Container */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-6 shadow-md flex flex-col items-center">
          
          <div className="flex flex-wrap justify-between items-center w-full mb-4 border-b border-slate-100 pb-3 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">19" Kabinet Montaj Görünümü</h3>
              <p className="text-[11px] text-slate-400">Cihazları sürükleyip bırakarak yerleştirin. Yakınlaştırma: <strong>Ctrl + Tekerlek</strong> veya <strong>+/-(0)</strong> tuşları.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Sidebar toggle */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                  isSidebarOpen 
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' 
                    : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100/70'
                }`}
                title="Sağ Metrikler ve Kabin Dışı Listeyi Göster/Gizle"
              >
                {isSidebarOpen ? <EyeOff className="h-3.5 w-3.5 text-slate-500" /> : <Eye className="h-3.5 w-3.5 text-blue-500" />}
                <span>Metrikler & Dış Cihazlar</span>
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
                  className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all cursor-pointer"
                  title="Uzaklaştır"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-bold font-mono px-1.5 text-slate-600 select-none min-w-[36px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
                  className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all cursor-pointer"
                  title="Yakınlaştır"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-1 hover:bg-white hover:shadow-sm rounded text-[9px] font-bold text-slate-500 transition-all cursor-pointer px-1.5"
                  title="Varsayılana Sıfırla (%100)"
                >
                  Sıfırla
                </button>
              </div>

              {/* Doluluk Badge */}
              <div className="flex gap-2 text-[10px] font-bold font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-500 uppercase tracking-wider select-none">
                <span>{filledU} / {totalU} U Dolu</span>
              </div>
            </div>
          </div>

          <div ref={rackContainerRef} className="w-full overflow-auto py-4 flex justify-center select-none" style={{ touchAction: 'none' }}>
            <div 
              className="flex gap-4 justify-center items-stretch transition-transform duration-150 ease-out origin-top shrink-0"
              style={{ 
                transform: `scale(${zoom})`, 
                width: '100%',
                maxWidth: '680px',
                marginBottom: `${(zoom - 1) * 350}px`
              }}
            >
              {/* SOL DIŞ ALAN (Cihaz Kütüphanesindeki Metro İnternet / Dış Hatlar) */}
              <div className="w-[105px] shrink-0 border border-dashed border-slate-200 bg-slate-50/50 rounded-lg p-2.5 flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2 select-none text-center block leading-tight">
                  METRO İNTERNET
                </span>
                <div className="flex-1 flex flex-col gap-2 w-full justify-start items-center">
                  {externalNetworkDevices.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-2 text-center text-[9px] text-slate-400 border border-dashed border-slate-100 rounded bg-white/50 w-full min-h-[100px]">
                      <Cloud className="h-5 w-5 text-slate-300 mb-1 animate-pulse" />
                      <span>Metro Hat Yok</span>
                    </div>
                  ) : (
                    externalNetworkDevices.map((device) => {
                      const isSelected = selectedDeviceId === device.id;
                      return (
                        <div
                          key={device.id}
                          onClick={() => onSelectDevice(device.id)}
                          className={`w-full p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center relative group ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20' 
                              : 'border-blue-100 bg-white hover:border-blue-400 hover:shadow-sm'
                          }`}
                        >
                          <Cloud className="h-6 w-6 text-blue-500 mb-1 animate-pulse" />
                          <span className="text-[10px] font-bold text-slate-700 truncate w-full" title={device.name}>
                            {device.name}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400 truncate w-full">
                            {device.model}
                          </span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveDevice(device.id);
                            }}
                            className="absolute -top-1 -right-1 p-0.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                            title="Cihazı sil"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Left Vertical PDU Rail (0U Visual) */}
              <div className="w-8 border-r border-dashed border-slate-300 flex flex-col justify-between py-8 bg-slate-100/30 rounded-l items-center">
                <span className="text-[9px] font-mono text-slate-400 rotate-270 select-none">SOL RAY</span>
                <div className="flex flex-col gap-1 items-center">
                  {verticalPDUs.length > 0 ? (
                    verticalPDUs.map((pdu, idx) => (
                      <div 
                        key={pdu.id} 
                        onClick={() => onSelectDevice(pdu.id)}
                        className="w-5 h-16 bg-amber-500 rounded flex items-center justify-center text-white cursor-pointer hover:bg-amber-600 shadow-sm animate-pulse"
                        title={`${pdu.name} (0U Akıllı PDU)`}
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </div>
                    ))
                  ) : (
                    <div className="w-3 h-24 bg-slate-200 rounded-full" title="Sola monteli PDU bulunmuyor" />
                  )}
                </div>
                <span className="text-[9px] text-slate-400 font-mono">0U</span>
              </div>

              {/* Main 19-inch Rack Chassis */}
              <div className="flex-1 w-full max-w-[430px] border-[10px] border-slate-800 bg-slate-900 rounded-lg shadow-xl relative flex flex-col overflow-hidden">
                {/* Rack Top Ventilation Fans visual */}
                <div className="h-6 bg-slate-950 border-b border-slate-800 flex justify-around items-center px-4 shrink-0">
                  <div className="w-8 h-1 bg-slate-800 rounded" />
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full border border-slate-800 animate-spin" style={{ animationDuration: '4s' }} />
                    <div className="w-3 h-3 rounded-full border border-slate-800 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="w-8 h-1 bg-slate-800 rounded" />
                </div>

                {/* The U Slots list (From top U down to 1) */}
                <div className="p-1.5 space-y-1 bg-slate-950 max-h-[520px] overflow-y-auto dark-scrollbar flex-1">
                  {Array.from({ length: totalU }, (_, i) => totalU - i).map((uIndex) => {
                    const device = occupiedSlots[uIndex];
                    const isBottomUnitOfDevice = device && device.uPosition === uIndex;
                    const isOccupied = !!device;

                    // If this U belongs to a device but is not the bottom slot,
                    // we don't render an individual slot cell since the bottom one will span upwards
                    if (isOccupied && !isBottomUnitOfDevice) {
                      return null;
                    }

                    const isSelected = device && selectedDeviceId === device.id;

                    if (device && isBottomUnitOfDevice) {
                      // Render the full device spanning across its uSize
                      const size = device.uSize;
                      const heightClass = size === 1 ? 'h-9' : size === 2 ? 'h-[76px]' : 'h-[150px]';
                      
                      let bgStyle = 'bg-slate-800 border-slate-700 hover:border-slate-500';
                      if (isSelected) {
                        bgStyle = 'bg-blue-900/90 border-blue-500 ring-2 ring-blue-500/50';
                      } else if (device.type === 'network') {
                        bgStyle = 'bg-blue-950/80 border-blue-800 hover:border-blue-700';
                      } else if (device.type === 'power') {
                        bgStyle = 'bg-amber-950/80 border-amber-800 hover:border-amber-700';
                      } else if (device.type === 'compute') {
                        bgStyle = 'bg-emerald-950/80 border-emerald-800 hover:border-emerald-700';
                      } else if (device.type === 'accessory') {
                        bgStyle = 'bg-slate-900/90 border-slate-800 hover:border-slate-700';
                      }

                      if (size === 1) {
                        return (
                          <div
                            key={`u-${uIndex}`}
                            draggable
                            onDragStart={(e) => handleDeviceDragStart(e, device)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDevice(device.id);
                            }}
                            className={`relative rounded border-2 px-2 py-1 flex items-center justify-between cursor-pointer transition-all ${heightClass} ${bgStyle}`}
                            title={`${device.name} (${device.model}) - Tıkla ve detayları incele, taşımak için sürükle`}
                          >
                            {/* Metal Screws left & right */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-sm animate-pulse" />
                            <div className="absolute top-1/2 -translate-y-1/2 right-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-sm animate-pulse" />
  
                            {/* Left side: green status LED and compact name + model info */}
                            <div className="flex items-center gap-2 pl-2 min-w-0 flex-1">
                              {/* Visual Port LEDs/Indicators */}
                              <div className="flex gap-0.5 items-center shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              </div>
                              <div className="min-w-0 flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[120px] md:max-w-[150px]">
                                  {device.name}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[60px] sm:max-w-[80px]">
                                  ({device.model})
                                </span>
                              </div>
                            </div>
  
                            {/* Right side: IP address, Power, and Actions */}
                            <div className="flex items-center gap-2 shrink-0 pr-2">
                              {/* IP & Power */}
                              <div className="flex items-center gap-3 font-mono text-[9px] text-slate-400">
                                {device.ipAddress && (
                                  <span className="text-blue-400 font-bold truncate max-w-[90px]" title={device.ipAddress}>
                                    {device.ipAddress}
                                  </span>
                                )}
                                <span className="text-slate-300 font-semibold bg-slate-900/40 px-1 rounded border border-slate-800/40 shrink-0">
                                  {device.powerDraw > 0 ? `${device.powerDraw}W` : 'Pasif'}
                                </span>
                              </div>
  
                              {/* Buttons */}
                              <div className="flex gap-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateDevicePosition(device.id, null);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-amber-500 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                  title="Kabin dışına al (Unmount)"
                                >
                                  <ArrowRightLeft className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveDevice(device.id);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                  title="Cihazı sil"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`u-${uIndex}`}
                          draggable
                          onDragStart={(e) => handleDeviceDragStart(e, device)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDevice(device.id);
                          }}
                          className={`relative rounded border-2 p-1 px-2 flex flex-col justify-between cursor-pointer transition-all ${heightClass} ${bgStyle}`}
                          title={`${device.name} (${device.model}) - Tıkla ve detayları incele, taşımak için sürükle`}
                        >
                          {/* Metal Screws left & right */}
                          <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-sm" />
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-sm" />
                          {size > 1 && (
                            <>
                              <div className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-sm" />
                              <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-sm" />
                            </>
                          )}

                          <div className="flex justify-between items-start w-full px-1">
                            <div className="text-left select-none">
                              <span className="text-[8px] font-mono text-slate-400 block tracking-tight">
                                U{uIndex} - U{uIndex + size - 1} • {device.model}
                              </span>
                              <span className="text-xs font-semibold text-white truncate block max-w-[180px]">
                                {device.name}
                              </span>
                            </div>

                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateDevicePosition(device.id, null);
                                }}
                                className="p-0.5 text-slate-400 hover:text-amber-500 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Kabin dışına al (Unmount)"
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveDevice(device.id);
                                }}
                                className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Cihazı sil"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Status indicators */}
                          <div className="flex justify-between items-center w-full px-1 pt-1 border-t border-slate-800 text-[10px]">
                            <span className="text-slate-400 font-mono">
                              {device.powerDraw > 0 ? `${device.powerDraw}W` : 'Pasif'}
                            </span>
                            <span className="text-blue-400 font-bold truncate max-w-[120px] font-mono">
                              {device.ipAddress || 'IP Yok'}
                            </span>
                          </div>
                        </div>
                      );
                    } else {
                      // Empty U Slot
                      const isOver = draggedOverU === uIndex;
                      return (
                        <div
                          key={`u-${uIndex}`}
                          onDragOver={(e) => handleDragOver(e, uIndex)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, uIndex)}
                          className={`group relative h-9 rounded border border-dashed flex items-center justify-between px-3 transition-colors ${
                            isOver
                              ? 'bg-blue-900/30 border-blue-500/80'
                              : 'bg-slate-950/20 border-slate-800 hover:bg-slate-900/40 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-600 font-bold w-5">
                              {uIndex}U
                            </span>
                            <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors select-none">
                              Boş Kabin Yuvası
                            </span>
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            {unmountedDevices.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    onMountDevice(e.target.value, uIndex);
                                  }
                                }}
                                className="bg-slate-800 border border-slate-700 text-[10px] text-white rounded px-1 py-0.5 max-w-[120px] outline-none"
                                defaultValue=""
                              >
                                <option value="" disabled>Cihaz Yerleştir</option>
                                {unmountedDevices.map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} ({d.uSize}U)
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>

                {/* Rack Bottom Base */}
                <div className="h-6 bg-slate-950 border-t border-slate-900 flex justify-between items-center px-6 shrink-0">
                  <div className="w-4 h-2 bg-slate-800 rounded-b" />
                  <span className="text-[9px] font-mono text-slate-500">19" STANDART ŞASİ</span>
                  <div className="w-4 h-2 bg-slate-800 rounded-b" />
                </div>
              </div>

              {/* Right Side Rail with Cable Tray Organizer */}
              <div className="w-8 border-l border-dashed border-slate-300 flex flex-col justify-between py-8 bg-slate-100/30 rounded-r items-center">
                <span className="text-[9px] font-mono text-slate-400 rotate-90 select-none">SAĞ RAY</span>
                <div className="flex flex-col gap-1 items-center">
                  <div className="w-2 h-32 bg-slate-300 rounded-full" title="Kablo kanalı" />
                </div>
                <span className="text-[9px] text-slate-400 font-mono">CABLE</span>
              </div>

              {/* SAĞ DIŞ ALAN (Cihaz Kütüphanesindeki Harici KGK / Güç Üniteleri) */}
              <div className="w-[105px] shrink-0 border border-dashed border-slate-200 bg-slate-50/50 rounded-lg p-2.5 flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2 select-none text-center block leading-tight">
                  HARİCİ KGK (UPS)
                </span>
                <div className="flex-1 flex flex-col gap-2 w-full justify-start items-center">
                  {externalPowerDevices.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-2 text-center text-[9px] text-slate-400 border border-dashed border-slate-100 rounded bg-white/50 w-full min-h-[100px]">
                      <Zap className="h-5 w-5 text-slate-300 mb-1 animate-pulse" />
                      <span>KGK Yok</span>
                    </div>
                  ) : (
                    externalPowerDevices.map((device) => {
                      const isSelected = selectedDeviceId === device.id;
                      return (
                        <div
                          key={device.id}
                          onClick={() => onSelectDevice(device.id)}
                          className={`w-full p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center relative group ${
                            isSelected 
                              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20' 
                              : 'border-amber-100 bg-white hover:border-amber-400 hover:shadow-sm'
                          }`}
                        >
                          <Zap className="h-6 w-6 text-amber-500 mb-1 animate-pulse" />
                          <span className="text-[10px] font-bold text-slate-700 truncate w-full block" title={device.name}>
                            {device.name}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400 truncate w-full block">
                            {device.model}
                          </span>
                          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-200 mt-1 select-none">
                            {device.powerDraw}W
                          </span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveDevice(device.id);
                            }}
                            className="absolute -top-1 -right-1 p-0.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                            title="Cihazı sil"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Rack Physical Metrics & Warnings */}
      {isSidebarOpen && (
        <div className="w-full lg:w-72 flex flex-col gap-4 animate-fade-in shrink-0">
          
          {/* Physical Stats Box */}
          <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
          <h4 className="font-semibold text-slate-800 text-sm mb-3">Kabin Fiziksel Metrikleri</h4>
          
          <div className="space-y-4">
            {/* Space Usage */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">U Alanı Doluluğu</span>
                <span className="font-semibold text-slate-700">{filledU} / {totalU} U</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${spacePercentage}%` }}
                />
              </div>
            </div>

            {/* Power usage */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Güç Tüketimi (Yük)</span>
                <span className="font-semibold text-slate-700">{totalPower}W / {maxPowerW}W</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    powerPercentage > 85 ? 'bg-red-500' : powerPercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${powerPercentage}%` }}
                />
              </div>
            </div>

            {/* Weight usage */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Toplam Statik Ağırlık</span>
                <span className="font-semibold text-slate-700">{totalWeight.toFixed(1)}kg / {maxWeightKg}kg</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    weightPercentage > 80 ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${weightPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Unmounted Devices Shelf */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-800 text-sm mb-2">Raf & Montajsız Cihazlar</h4>
          <p className="text-xs text-slate-500 mb-3">Tasarımda olan ancak henüz kabine takılmamış cihazlar.</p>
          
          <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-2 bg-slate-50/50 min-h-[150px] max-h-[250px]">
            {unmountedDevices.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                Boşta cihaz bulunmuyor. Sol kütüphaneden yeni cihaz ekleyin.
              </div>
            ) : (
              unmountedDevices.map((device) => (
                <div
                  key={device.id}
                  draggable
                  onDragStart={(e) => handleDeviceDragStart(e, device)}
                  onClick={() => onSelectDevice(device.id)}
                  className={`p-2 rounded border bg-white cursor-pointer hover:border-blue-500 flex justify-between items-center transition-all ${
                    selectedDeviceId === device.id ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <h5 className="font-semibold text-xs text-slate-700">{device.name}</h5>
                    <p className="text-[10px] text-slate-500 font-mono">{device.model} ({device.uSize}U)</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find first free U and mount it
                        for (let u = 1; u <= totalU - device.uSize + 1; u++) {
                          if (isRangeFree(u, device.uSize)) {
                            onMountDevice(device.id, u);
                            return;
                          }
                        }
                        alert('Kabin içerisinde bu cihaz için yeterli boş alan bulunmuyor!');
                      }}
                      className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-1 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Oto-Yerleştir
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveDevice(device.id);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* External Connections & Devices Section */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col mt-4">
          <h4 className="font-semibold text-slate-800 text-sm mb-1">Kabin Dışı Bağlantılar & Harici KGK</h4>
          <p className="text-xs text-slate-500 mb-3">Kabin dışında yer alan harici kesintisiz güç kaynakları (KGK) ve Metro İnternet hatları.</p>
          
          <div className="space-y-2 border border-slate-100 rounded-lg p-2 bg-slate-50/50 max-h-[200px] overflow-y-auto">
            {externalDevices.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-xs italic">
                Eklenmiş harici cihaz bulunmuyor. Sol kütüphaneden Metro İnternet veya Harici KGK ekleyebilirsiniz.
              </div>
            ) : (
              externalDevices.map((device) => (
                <div
                  key={device.id}
                  onClick={() => onSelectDevice(device.id)}
                  className={`p-2 rounded border bg-white cursor-pointer hover:border-blue-500 flex justify-between items-center transition-all ${
                    selectedDeviceId === device.id ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-sm ${device.type === 'network' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                    <div>
                      <h5 className="font-semibold text-xs text-slate-700">{device.name}</h5>
                      <p className="text-[10px] text-slate-500 font-mono">{device.model} (Kabinet Dışı)</p>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveDevice(device.id);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time Engineering Advisories (Fiziksel / Statik Uyarılar) */}
        {(highHeavyDevices.length > 0 || totalPower > maxPowerW * 0.85 || totalWeight > maxWeightKg * 0.8) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <h5 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Mühendislik Tavsiyeleri
            </h5>
            <ul className="text-[11px] text-amber-800 space-y-1.5 list-disc pl-3">
              {highHeavyDevices.map((d) => (
                <li key={d.id}>
                  <strong>{d.name}</strong> ({d.weight}kg) ağırlık merkezi için fazla yukarıda (U{d.uPosition}). Kabin dengesi için alt kısımlara taşımanız önerilir.
                </li>
              ))}
              {totalPower > maxPowerW * 0.85 && (
                <li>
                  Toplam güç yükü sınırda (%{Math.round(powerPercentage)}). Aşırı yüklenmeyi önlemek için ek bir UPS/PDU devresi planlayın.
                </li>
              )}
              {totalWeight > maxWeightKg * 0.8 && (
                <li>
                  Kabin ağırlık limiti dolmak üzere. Zemin taşıma mukavemetini kontrol edin.
                </li>
              )}
            </ul>
          </div>
        )}

      </div>
      )}
    </div>
  );
}
