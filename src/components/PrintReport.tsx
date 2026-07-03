/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Device, Cable, RackSettings } from '../types';
import { 
  Printer, 
  X, 
  FileText, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  Server, 
  Network, 
  Zap, 
  Cpu, 
  Scale 
} from 'lucide-react';

interface PrintReportProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  cables: Cable[];
  rackSettings: RackSettings;
  designName: string;
}

export function PrintReport({
  isOpen,
  onClose,
  devices,
  cables,
  rackSettings,
  designName,
}: PrintReportProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Dynamic Rapor sayfa seçimleri ve proje ismi konfigürasyonu
  const [includeCabinet, setIncludeCabinet] = useState(true);
  const [includeNetwork, setIncludeNetwork] = useState(true);
  const [includePower, setIncludePower] = useState(true);
  const [includeCablingTable, setIncludeCablingTable] = useState(true);
  const [reportTitle, setReportTitle] = useState(designName);

  useEffect(() => {
    setReportTitle(designName);
  }, [designName]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Cihazların bağlantı tipine göre kontrolü
  const hasNetworkConnection = (devId: string) => {
    return cables.some(c => 
      (c.fromDeviceId === devId || c.toDeviceId === devId) && 
      (c.type === 'cat6' || c.type === 'cat6a' || c.type === 'fiber')
    );
  };

  const hasPowerConnection = (devId: string) => {
    return cables.some(c => 
      (c.fromDeviceId === devId || c.toDeviceId === devId) && 
      (c.type === 'power_c13' || c.type === 'power_c19')
    );
  };

  // Dinamik Sayfa Numaralandırmaları
  let currentPageNum = 0;
  const pageNumbers = {
    cabinet: 0,
    network: 0,
    power: 0,
    table: 0
  };

  if (includeCabinet) {
    currentPageNum++;
    pageNumbers.cabinet = currentPageNum;
  }
  if (includeNetwork) {
    currentPageNum++;
    pageNumbers.network = currentPageNum;
  }
  if (includePower) {
    currentPageNum++;
    pageNumbers.power = currentPageNum;
  }
  if (includeCablingTable) {
    currentPageNum++;
    pageNumbers.table = currentPageNum;
  }
  const totalPagesCount = currentPageNum;

  // Formatting helpers
  const today = new Date().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate stats
  const totalWeight = devices.reduce((sum, d) => sum + d.weight, 0);
  const totalPower = devices.reduce((sum, d) => sum + d.powerDraw, 0);
  const { totalU, maxWeightKg, maxPowerW } = rackSettings;
  const filledU = devices.reduce((sum, d) => sum + (d.uPosition !== null ? d.uSize : 0), 0);
  const spacePercentage = Math.round((filledU / totalU) * 100);

  // Rack slot mapper
  const occupiedSlots: { [key: number]: Device } = {};
  devices.forEach((device) => {
    if (device.uPosition !== null) {
      for (let i = 0; i < device.uSize; i++) {
        occupiedSlots[device.uPosition + i] = device;
      }
    }
  });

  const unmountedDevices = devices.filter((d) => d.uPosition === null);

  // Redundancy and Risk Checks
  const highHeavyDevices = devices.filter((d) => {
    if (d.uPosition === null) return false;
    return d.weight >= 15 && d.uPosition > totalU / 2;
  });

  // Servers / Compute devices check for redundant power connectivity
  const unconfiguredRedundancyList = devices.filter((d) => {
    if (d.subtype === 'server' || d.subtype === 'storage') {
      const pwrInPorts = d.ports.filter(p => p.type === 'power_in');
      if (pwrInPorts.length > 1) {
        // Redundant device, verify if all power ports are connected to a cable
        const connectedCount = pwrInPorts.filter(p => p.connectedToCableId).length;
        return connectedCount < pwrInPorts.length;
      }
    }
    return false;
  });

  // Trigger Print Dialog
  const handlePrint = () => {
    window.print();
  };

  // Check if all coordinates are 0,0 (not positioned yet)
  const isUnpositioned = devices.every(d => d.x === 0 && d.y === 0);
  
  // Create a mapping of coordinates for the diagram
  const printCoords = new Map<string, { x: number; y: number }>();
  
  if (isUnpositioned) {
    const networks = devices.filter(d => d.type === 'network');
    const computes = devices.filter(d => d.type === 'compute');
    const powers = devices.filter(d => d.type === 'power' || d.type === 'accessory');
    
    const layoutLayer = (layerDevices: Device[], yPos: number) => {
      const count = layerDevices.length;
      if (count === 0) return;
      const step = 720 / (count + 1);
      layerDevices.forEach((device, index) => {
        printCoords.set(device.id, { x: step * (index + 1) - 45, y: yPos });
      });
    };
    
    layoutLayer(networks, 50);
    layoutLayer(computes, 140);
    layoutLayer(powers, 230);
  } else {
    devices.forEach(d => {
      printCoords.set(d.id, { x: d.x, y: d.y });
    });
  }

  // Helpers to get print coords
  const getDeviceX = (devId: string, defaultVal: number) => {
    return printCoords.get(devId)?.x ?? defaultVal;
  };
  const getDeviceY = (devId: string, defaultVal: number) => {
    return printCoords.get(devId)?.y ?? defaultVal;
  };

  // SVG Scaled Topology Drawer calculation
  // Find minimum and maximum bounds of devices to center and scale them inside a fixed printable box
  let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;
  devices.forEach((d) => {
    const coords = printCoords.get(d.id) || { x: d.x, y: d.y };
    if (coords.x < minX) minX = coords.x;
    if (coords.y < minY) minY = coords.y;
    if (coords.x > maxX) maxX = coords.x;
    if (coords.y > maxY) maxY = coords.y;
  });

  // Default padding around the layout
  const pad = 40;
  if (devices.length === 0) {
    minX = 0; minY = 0; maxX = 100; maxY = 100;
  }

  const dx = Math.max(maxX - minX, 100);
  const dy = Math.max(maxY - minY, 100);

  // Map coordinate to print scale
  const svgWidth = 720;
  const svgHeight = 280;

  const scaleX = (x: number) => {
    if (dx === 100) return pad + (x * 3);
    return pad + ((x - minX) / dx) * (svgWidth - pad * 2);
  };

  const scaleY = (y: number) => {
    if (dy === 100) return pad + (y * 1.5);
    return pad + ((y - minY) / dy) * (svgHeight - pad * 2);
  };

  const getCableTypeLabel = (type: string) => {
    switch (type) {
      case 'cat6': return 'Cat6 Ethernet';
      case 'cat6a': return 'Cat6A S/FTP';
      case 'fiber': return 'Fiber Optik';
      case 'power_c13': return 'Güç C13/C14';
      case 'power_c19': return 'Güç C19/C20';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm overflow-y-auto p-4 md:p-6 select-none print-modal-container">
      
      {/* On-screen control bar & Preview frame container */}
      <div className="w-full max-w-[1150px] bg-slate-100 rounded-2xl flex flex-col shadow-2xl h-[92vh] border border-slate-200 print-modal-content">
        
        {/* Modal Toolbar (Sticky top) */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-blue-600 animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">PDF Baskı ve Raporlama</h3>
              <p className="text-[11px] text-slate-500 font-medium">Kabinet yerleşim planınızı, ağ topolojinizi ve güç dağıtım şemanızı rapor olarak yazdırın.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Yazdır / PDF Olarak Kaydet
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Info advice notification inside App */}
        <div className="bg-blue-50 border-b border-blue-100 p-3 px-6 text-xs text-blue-800 flex items-center gap-2 select-text shrink-0 print:hidden">
          <Info className="h-4 w-4 text-blue-500 shrink-0" />
          <span>
            <strong>İpucu:</strong> Açılan yazdırma penceresinde <strong>"Arka Plan Grafikleri"</strong> seçeneğini işaretleyerek renkli kabloları ve şemaları tam çözünürlüklü çıktı alabilirsiniz.
          </span>
        </div>

        {/* Content area: Sidebar (Configurator) + Printable Sandbox Preview */}
        <div className="flex-1 flex overflow-hidden print-content-body">
          
          {/* LEFT CONFIGURATION PANEL (Hidden on Print) */}
          <div className="w-[300px] border-r border-slate-200 bg-white p-5 flex flex-col justify-between shrink-0 h-full overflow-y-auto select-none print:hidden print-sidebar">
            <div className="space-y-6 text-left">
              <div>
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">RAPOR AYARLARI</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">PROJE / PLAN ADI</label>
                    <input
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">DAHİL EDİLECEK RAPOR SAYFALARI</h4>
                <div className="space-y-2.5">
                  
                  {/* Option: Cabinet Layout */}
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={includeCabinet}
                      onChange={(e) => setIncludeCabinet(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Server className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span>1. Kabin Yerleşim Planı</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight mt-0.5">Physical Elevation & Uyumluluk</p>
                    </div>
                  </label>

                  {/* Option: Network Topology */}
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={includeNetwork}
                      onChange={(e) => setIncludeNetwork(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Network className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span>2. Ağ Topolojisi Şeması</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight mt-0.5">Bakır & Fiber Veri Hatları</p>
                    </div>
                  </label>

                  {/* Option: Power Topology */}
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={includePower}
                      onChange={(e) => setIncludePower(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>3. Güç Dağıtım Şeması</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight mt-0.5">PDU Dağıtım & Yedeklilik</p>
                    </div>
                  </label>

                  {/* Option: Cabling Schedule Table */}
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={includeCablingTable}
                      onChange={(e) => setIncludeCablingTable(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span>4. Bağlantı Çizelgesi</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight mt-0.5">Port Eşleşme ve Uzunluk Detayı</p>
                    </div>
                  </label>

                </div>
              </div>

              {/* Page breakdown count */}
              <div className="border-t border-slate-100 pt-4 text-xs space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/50">
                <span className="font-extrabold text-slate-500 text-[9px] uppercase tracking-wider block">RAPOR ÖZETİ</span>
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Toplam Sayfa Sayısı:</span>
                  <span className="font-extrabold text-blue-600 font-mono">{totalPagesCount} Sayfa</span>
                </div>
                <div className="text-[9px] text-slate-400 leading-relaxed mt-1">
                  Seçilen sayfalar ve sayfa numaraları, yazdırma ayarlarıyla dinamik olarak güncellenir.
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all hover:shadow-lg cursor-pointer text-xs"
              >
                <Printer className="h-4 w-4" />
                Yazdır / PDF Kaydet
              </button>
            </div>
          </div>

          {/* RIGHT VIEW: SCROLLABLE PREVIEW FRAME */}
          <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-500/10">
          
          {/* THE PRINTED A4 AREA (Targeted by printing visibility rules) */}
          {totalPagesCount === 0 ? (
            <div className="w-[210mm] min-h-[297mm] bg-white text-slate-400 flex flex-col items-center justify-center p-12 text-center rounded border border-slate-200 shadow-xl self-start">
              <FileText className="h-12 w-12 text-slate-300 mb-3 animate-bounce" />
              <h3 className="font-bold text-slate-700 text-sm">Rapor Şablonu Boş</h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">Lütfen sol panelden rapora dahil etmek istediğiniz en az bir şemayı veya kabinet yerleşim planını işaretleyin.</p>
            </div>
          ) : (
            <div 
              id="print-report-area" 
              ref={printAreaRef} 
              className="w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-xl border border-slate-200 rounded p-[15mm] flex flex-col justify-between font-sans leading-relaxed select-text relative self-start"
              style={{ contentVisibility: 'auto' }}
            >
              
              {/* PAGE 1: CABINET ELEVATION (Conditional) */}
              {includeCabinet && (
                <div className="flex-1 flex flex-col justify-between min-h-[267mm]">
                  <div>
                    {/* Header Section */}
                    <div className="flex justify-between items-start border-b-[3px] border-slate-800 pb-5 mb-6 text-left">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-6 h-6 bg-blue-700 rounded text-white flex items-center justify-center font-bold text-xs select-none">N</span>
                          <span className="font-extrabold text-base tracking-tight text-slate-900 font-mono">NetPow</span>
                        </div>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">KABİNET ALTYAPI & TOPOLOJİ TASARIM RAPORU</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Bütünleşik Altyapı, Sürdürülebilirlik ve Bağlantı Çizelgesi Analizi</p>
                      </div>
                      <div className="text-right font-mono text-[10px] text-slate-500 space-y-0.5">
                        <div className="truncate max-w-[200px]"><strong>PROJE/PLAN:</strong> {reportTitle}</div>
                        <div><strong>TARİH:</strong> {today}</div>
                        <div><strong>DURUM:</strong> ONAYLANDI</div>
                      </div>
                    </div>

                    {/* Physical Specifications Matrix cards */}
                    <div className="grid grid-cols-4 gap-4 mb-6 text-left">
                      <div className="border border-slate-200 p-3 rounded bg-slate-50">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Doluluk Durumu</span>
                        <strong className="text-base text-slate-800 block">{filledU} / {totalU} U</strong>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${spacePercentage}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-400 mt-0.5 block font-medium">Kabin doluluğu %{spacePercentage}</span>
                      </div>

                      <div className="border border-slate-200 p-3 rounded bg-slate-50">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Güç Tüketim Yükü</span>
                        <strong className="text-base text-slate-800 block">{totalPower} W</strong>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${totalPower > maxPowerW * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((totalPower/maxPowerW)*100, 100)}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-400 mt-0.5 block font-medium">Maks: {maxPowerW} W</span>
                      </div>

                      <div className="border border-slate-200 p-3 rounded bg-slate-50">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Statik Ağırlık Yükü</span>
                        <strong className="text-base text-slate-800 block">{totalWeight.toFixed(1)} kg</strong>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min((totalWeight/maxWeightKg)*100, 100)}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-400 mt-0.5 block font-medium">Maks Kapasite: {maxWeightKg} kg</span>
                      </div>

                      <div className="border border-slate-200 p-3 rounded bg-slate-50">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Bağlantı Detayı</span>
                        <strong className="text-base text-slate-800 block">{cables.length} Aktif Hat</strong>
                        <div className="text-[8.5px] text-slate-400 font-mono mt-2 flex justify-between">
                          <span>Ağ: {cables.filter(c => !c.type.startsWith('power')).length}</span>
                          <span>Güç: {cables.filter(c => c.type.startsWith('power')).length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cabinet Elevation Drawing Row */}
                    <div className="grid grid-cols-12 gap-6 items-start">
                      
                      {/* Elevation Vector Chart Left 8 Cols */}
                      <div className="col-span-8 border border-slate-200 rounded-lg p-4 bg-white">
                        <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5 text-left">
                          <Server className="h-3.5 w-3.5 text-blue-600" />
                          19" Fiziksel Kabin Yerleşim Şeması (Elevation View)
                        </h3>

                        <div className="max-w-md mx-auto border-[6px] border-slate-700 bg-slate-900 rounded p-1">
                          <div className="space-y-0.5">
                            {Array.from({ length: totalU }, (_, i) => totalU - i).map((uIndex) => {
                              const device = occupiedSlots[uIndex];
                              const isBottomUnitOfDevice = device && device.uPosition === uIndex;
                              const isOccupied = !!device;

                              if (isOccupied && !isBottomUnitOfDevice) {
                                return null;
                              }

                              if (device && isBottomUnitOfDevice) {
                                const size = device.uSize;
                                let heightStyle = 'h-6';
                                if (size === 2) heightStyle = 'h-12';
                                if (size >= 3) heightStyle = 'h-[72px]';

                                let typeBadgeColor = 'bg-slate-100 text-slate-800 border-slate-300';
                                if (device.type === 'network') typeBadgeColor = 'bg-blue-50 text-blue-900 border-blue-200';
                                else if (device.type === 'power') typeBadgeColor = 'bg-amber-50 text-amber-900 border-amber-200';
                                else if (device.type === 'compute') typeBadgeColor = 'bg-emerald-50 text-emerald-900 border-emerald-200';

                                return (
                                  <div
                                    key={`print-u-${uIndex}`}
                                    className={`border rounded px-2 py-0.5 flex flex-col justify-between text-left ${heightStyle} ${typeBadgeColor} select-text`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="text-[7.5px] font-mono text-slate-400 block leading-none font-bold">
                                          U{uIndex} - U{uIndex + size - 1} • {device.model}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-800 leading-tight block truncate max-w-[260px]">
                                          {device.name}
                                        </span>
                                      </div>
                                      <span className="text-[7px] px-1 bg-white border border-slate-200 rounded text-slate-500 font-mono font-bold uppercase leading-none mt-0.5 shrink-0">
                                        {device.type}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[7.5px] border-t border-slate-200/50 pt-0.5 font-mono text-slate-500 leading-none">
                                      <span>{device.ipAddress || 'Statik IP Yok'}</span>
                                      <span>{device.powerDraw > 0 ? `${device.powerDraw}W` : 'Pasif Güç'} • {device.weight}kg</span>
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={`print-u-${uIndex}`} className="h-6 rounded border border-dashed border-slate-800 bg-slate-950/20 flex items-center justify-between px-3 text-[9px] text-slate-600">
                                    <span className="font-mono font-bold">{uIndex}U</span>
                                    <span className="font-mono italic">Kabin Yuvası Boş</span>
                                    <span className="w-4" />
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Physical Inventory & Warnings list Right 4 Cols */}
                      <div className="col-span-4 space-y-4 text-left">
                        
                        {/* Shelf devices (unmounted) */}
                        <div className="border border-slate-200 rounded-lg p-3 bg-white">
                          <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2 border-b pb-1">
                            Raf & Boşta Duran Cihazlar
                          </h4>
                          {unmountedDevices.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">Kabine takılmamış boşta cihaz bulunmuyor.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                              {unmountedDevices.map(d => (
                                <div key={d.id} className="p-1.5 border border-slate-100 bg-slate-50 rounded text-[9.5px]">
                                  <div className="font-bold text-slate-700">{d.name}</div>
                                  <div className="text-slate-400 font-mono text-[8.5px] mt-0.5">{d.model} • {d.uSize}U • {d.weight}kg</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Engineering Analysis Checklist */}
                        <div className="border border-slate-200 rounded-lg p-3 bg-white">
                          <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2 border-b pb-1 flex items-center gap-1">
                            <Scale className="h-3 w-3 text-indigo-500" />
                            Mühendislik Uyumluluk
                          </h4>
                          <div className="space-y-2 text-[10px]">
                            
                            {/* Gravity warning status */}
                            <div className="flex gap-2 items-start">
                              {highHeavyDevices.length > 0 ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span className="font-bold text-slate-800 block">Kabin Denge Analizi</span>
                                <p className="text-slate-500 leading-tight">
                                  {highHeavyDevices.length > 0 
                                    ? 'Risk: Ağır üniteler üst seviyede bulunuyor. Aşağı çekin.'
                                    : 'Başarılı: Ağır üniteler güvenli alt yuvalardadır.'
                                  }
                                </p>
                              </div>
                            </div>

                            {/* Redundancy status */}
                            <div className="flex gap-2 items-start">
                              {unconfiguredRedundancyList.length > 0 ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span className="font-bold text-slate-800 block">Güç Yedeklilik</span>
                                <p className="text-slate-500 leading-tight">
                                  {unconfiguredRedundancyList.length > 0 
                                    ? `${unconfiguredRedundancyList.length} adet sunucunun tek güç hattı bağlı!`
                                    : 'Başarılı: Tüm yedekli cihazlar çift beslenmektedir.'
                                  }
                                </p>
                              </div>
                            </div>

                          </div>
                        </div>

                      </div>
                    </div>

                  </div>

                  {/* Page Footer */}
                  <div className="border-t border-slate-200 pt-3 mt-4 text-center text-[9px] text-slate-400 font-mono flex justify-between select-none">
                    <span>NetPow Raporlama Aracı • Sayfa {pageNumbers.cabinet}/{totalPagesCount}</span>
                    <span>Altyapı Planı Güvenlik ve Uyumluluk Çizelgesi</span>
                  </div>
                </div>
              )}

              {/* PAGE BREAK BETWEEN CABINET & NETWORK */}
              {includeCabinet && includeNetwork && (
                <div className="print-page-break my-8 border-t-2 border-dashed border-slate-300 relative select-none">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 text-slate-400 text-[9px] px-3 py-0.5 font-bold uppercase rounded-full border">
                    Yazdırma Sayfa Sınırı (Ağ Topolojisi)
                  </span>
                </div>
              )}

              {/* PAGE 2: NETWORK TOPOLOGY DIAGRAM */}
              {includeNetwork && (
                <div className="flex-1 flex flex-col justify-between min-h-[267mm]">
                  <div>
                    {/* Secondary Page Header */}
                    <div className="border-b-[3px] border-slate-800 pb-5 mb-6 text-left flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-6 h-6 bg-blue-700 rounded text-white flex items-center justify-center font-bold text-xs select-none">N</span>
                          <span className="font-extrabold text-base tracking-tight text-slate-900 font-mono">NetPow</span>
                        </div>
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">KABİNET AĞ BAĞLANTI TOPOLOJİSİ ŞEMASI</h2>
                        <p className="text-[10px] text-slate-400 font-medium">Bakır Ethernet ve SFP Fiber Optik Veri Bağlantı Şeması</p>
                      </div>
                      <div className="text-right font-mono text-[9px] text-slate-500 space-y-0.5">
                        <div className="truncate max-w-[200px]"><strong>PROJE:</strong> {reportTitle}</div>
                        <div><strong>TARİH:</strong> {today}</div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 mb-5 relative">
                      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full bg-white border border-slate-200/60 rounded" style={{ maxHeight: '240px' }}>
                        {/* Cabling connections (Network only) */}
                        {cables.filter(c => c.type === 'cat6' || c.type === 'cat6a' || c.type === 'fiber').map((cable) => {
                          const from = devices.find(d => d.id === cable.fromDeviceId);
                          const to = devices.find(d => d.id === cable.toDeviceId);
                          if (!from || !to) return null;

                          const x1 = scaleX(getDeviceX(from.id, from.x));
                          const y1 = scaleY(getDeviceY(from.id, from.y));
                          const x2 = scaleX(getDeviceX(to.id, to.x));
                          const y2 = scaleY(getDeviceY(to.id, to.y));
                          const cx = (x1 + x2) / 2;
                          const cy = Math.min(y1, y2) - 15;

                          return (
                            <g key={`print-net-cable-${cable.id}`}>
                              <path d={`M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`} fill="none" stroke={cable.color} strokeWidth="1.5" strokeDasharray={cable.type === 'fiber' ? '3,3' : undefined} />
                              <circle cx={x1} cy={y1} r="2.5" fill="#1e293b" />
                              <circle cx={x2} cy={y2} r="2.5" fill="#1e293b" />
                            </g>
                          );
                        })}

                        {/* Node representations */}
                        {devices.map((device) => {
                          const px = scaleX(getDeviceX(device.id, device.x));
                          const py = scaleY(getDeviceY(device.id, device.y));
                          const isConnected = hasNetworkConnection(device.id) || device.type === 'network';
                          const opacity = isConnected ? 1 : 0.35;

                          let nodeColor = '#3b82f6';
                          if (device.type === 'power') nodeColor = '#f59e0b';
                          if (device.type === 'compute') nodeColor = '#10b981';
                          if (device.type === 'accessory') nodeColor = '#64748b';

                          return (
                            <g key={`print-net-node-${device.id}`} style={{ opacity }}>
                              <rect x={px - 45} y={py - 14} width="90" height="28" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                              <rect x={px - 45} y={py - 14} width="4" height="28" rx="1" fill={nodeColor} />
                              <text x={px - 36} y={py - 1.5} className="font-bold text-[7.5px] fill-slate-800 select-none font-sans">{device.name.substring(0, 16)}</text>
                              <text x={px - 36} y={py + 8} className="text-[6px] fill-slate-400 select-none font-mono">{device.model.substring(0, 14)} | {device.uPosition ? `${device.uPosition}U` : 'RAF'}</text>
                            </g>
                          );
                        })}
                      </svg>

                      <div className="flex justify-center gap-4 text-[9px] font-mono text-slate-500 mt-2.5">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-blue-600 block rounded-full" /><span>Ethernet Bakır Hat</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-1 border-t border-dashed border-purple-500 block" /><span>Fiber Optik Bağlantı (SFP)</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#3b82f6] block rounded-xs" /><span>Aktif Ağ Cihazı</span></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="border border-slate-200 p-3 bg-slate-50/50 rounded-lg">
                        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 border-b pb-1">Ağ İstatistik Matrisi</h4>
                        <div className="space-y-1 text-[10px] font-mono text-slate-600">
                          <div className="flex justify-between"><span>Aktif Cihazlar:</span><span className="font-bold text-slate-800">{devices.filter(d => d.type === 'network').length} Ünite</span></div>
                          <div className="flex justify-between"><span>Bakır Bağlantılar:</span><span className="font-bold text-slate-800">{cables.filter(c => c.type === 'cat6' || c.type === 'cat6a').length} Hat</span></div>
                          <div className="flex justify-between"><span>SFP Bağlantılar:</span><span className="font-bold text-slate-800">{cables.filter(c => c.type === 'fiber').length} Port</span></div>
                        </div>
                      </div>

                      <div className="border border-slate-200 p-3 bg-slate-50/50 rounded-lg text-[9.5px] text-slate-500">
                        <p className="font-bold text-slate-700 mb-1">Öneriler:</p>
                        <p>Veri kabloları güç hatları ile çakışmayacak şekilde zıt kabin kanallarından yönlendirilmelidir.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 mt-4 text-center text-[9px] text-slate-400 font-mono flex justify-between select-none">
                    <span>NetPow Raporlama Aracı • Sayfa {pageNumbers.network}/{totalPagesCount}</span>
                    <span>Ağ Topolojisi & Bağlantı Mimarisi</span>
                  </div>
                </div>
              )}

              {/* PAGE BREAK BETWEEN NETWORK & POWER */}
              {((includeCabinet || includeNetwork) && includePower) && (
                <div className="print-page-break my-8 border-t-2 border-dashed border-slate-300 relative select-none">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 text-slate-400 text-[9px] px-3 py-0.5 font-bold uppercase rounded-full border">
                    Yazdırma Sayfa Sınırı (Güç Dağıtım Altyapısı)
                  </span>
                </div>
              )}

              {/* PAGE 3: POWER TOPOLOGY DIAGRAM */}
              {includePower && (
                <div className="flex-1 flex flex-col justify-between min-h-[267mm]">
                  <div>
                    {/* Third Page Header */}
                    <div className="border-b-[3px] border-slate-800 pb-5 mb-6 text-left flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-6 h-6 bg-blue-700 rounded text-white flex items-center justify-center font-bold text-xs select-none">N</span>
                          <span className="font-extrabold text-base tracking-tight text-slate-900 font-mono">NetPow</span>
                        </div>
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">KABİNET GÜÇ DAĞITIM VE ALTYAPI ŞEMASI</h2>
                        <p className="text-[10px] text-slate-400 font-medium">PDU Besleme Dağılımı ve Cihaz Güç Yedeklilik Şeması</p>
                      </div>
                      <div className="text-right font-mono text-[9px] text-slate-500 space-y-0.5">
                        <div className="truncate max-w-[200px]"><strong>PROJE:</strong> {reportTitle}</div>
                        <div><strong>TARİH:</strong> {today}</div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 mb-5 relative">
                      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full bg-white border border-slate-200/60 rounded" style={{ maxHeight: '240px' }}>
                        {/* Cabling connections (Power only) */}
                        {cables.filter(c => c.type === 'power_c13' || c.type === 'power_c19').map((cable) => {
                          const from = devices.find(d => d.id === cable.fromDeviceId);
                          const to = devices.find(d => d.id === cable.toDeviceId);
                          if (!from || !to) return null;

                          const x1 = scaleX(getDeviceX(from.id, from.x));
                          const y1 = scaleY(getDeviceY(from.id, from.y));
                          const x2 = scaleX(getDeviceX(to.id, to.x));
                          const y2 = scaleY(getDeviceY(to.id, to.y));
                          const cx = (x1 + x2) / 2;
                          const cy = Math.min(y1, y2) - 15;

                          return (
                            <g key={`print-pwr-cable-${cable.id}`}>
                              <path d={`M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`} fill="none" stroke={cable.color} strokeWidth="1.5" />
                              <circle cx={x1} cy={y1} r="2.5" fill="#1e293b" />
                              <circle cx={x2} cy={y2} r="2.5" fill="#1e293b" />
                            </g>
                          );
                        })}

                        {/* Node representations */}
                        {devices.map((device) => {
                          const px = scaleX(getDeviceX(device.id, device.x));
                          const py = scaleY(getDeviceY(device.id, device.y));
                          const isConnected = hasPowerConnection(device.id) || device.type === 'power';
                          const opacity = isConnected ? 1 : 0.35;

                          let nodeColor = '#f59e0b';
                          if (device.type === 'network') nodeColor = '#3b82f6';
                          if (device.type === 'compute') nodeColor = '#10b981';
                          if (device.type === 'accessory') nodeColor = '#64748b';

                          return (
                            <g key={`print-pwr-node-${device.id}`} style={{ opacity }}>
                              <rect x={px - 45} y={py - 14} width="90" height="28" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                              <rect x={px - 45} y={py - 14} width="4" height="28" rx="1" fill={nodeColor} />
                              <text x={px - 36} y={py - 1.5} className="font-bold text-[7.5px] fill-slate-800 select-none font-sans">{device.name.substring(0, 16)}</text>
                              <text x={px - 36} y={py + 8} className="text-[6px] fill-slate-400 select-none font-mono">{device.model.substring(0, 14)} | {device.uPosition ? `${device.uPosition}U` : 'RAF'}</text>
                            </g>
                          );
                        })}
                      </svg>

                      <div className="flex justify-center gap-4 text-[9px] font-mono text-slate-500 mt-2.5">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-amber-500 block rounded-full" /><span>C13/C14 Güç Hattı (10A)</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-red-600 block rounded-full" /><span>C19/C20 Güç Hattı (16A)</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#f59e0b] block rounded-xs" /><span>Aktif PDU / UPS</span></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="border border-slate-200 p-3 bg-slate-50/50 rounded-lg">
                        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 border-b pb-1">Güç Analiz Matrisi</h4>
                        <div className="space-y-1 text-[10px] font-mono text-slate-600">
                          <div className="flex justify-between"><span>Aktif PDU Üniteleri:</span><span className="font-bold text-slate-800">{devices.filter(d => d.type === 'power').length} Ünite</span></div>
                          <div className="flex justify-between"><span>Tasarım Güç Çekişi:</span><span className="font-bold text-slate-800">{totalPower} W</span></div>
                          <div className="flex justify-between"><span>Yedekli Cihazlar:</span><span className="font-bold text-slate-800">{devices.filter(d => d.ports.filter(p => p.type === 'power_in').length > 1).length} Adet</span></div>
                        </div>
                      </div>

                      <div className="border border-slate-200 p-3 bg-slate-50/50 rounded-lg text-[9.5px] text-slate-500">
                        <p className="font-bold text-slate-700 mb-1">Yedeklilik İlkesi:</p>
                        <p>Çift PSU sunucular kesinlikle farklı besleme fazlarına bağlı PDU çıkışlarına bağlanmalıdır.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 mt-4 text-center text-[9px] text-slate-400 font-mono flex justify-between select-none">
                    <span>NetPow Raporlama Aracı • Sayfa {pageNumbers.power}/{totalPagesCount}</span>
                    <span>Güç Altyapısı & Enerji Dağıtım Planı</span>
                  </div>
                </div>
              )}

              {/* PAGE BREAK BETWEEN POWER & CABLING TABLE */}
              {((includeCabinet || includeNetwork || includePower) && includeCablingTable) && (
                <div className="print-page-break my-8 border-t-2 border-dashed border-slate-300 relative select-none">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 text-slate-400 text-[9px] px-3 py-0.5 font-bold uppercase rounded-full border">
                    Yazdırma Sayfa Sınırı (Kablolama Listesi)
                  </span>
                </div>
              )}

              {/* PAGE 4: CABLING SCHEDULE TABLE */}
              {includeCablingTable && (
                <div className="flex-1 flex flex-col justify-between min-h-[267mm]">
                  <div>
                    {/* Fourth Page Header */}
                    <div className="border-b-[3px] border-slate-800 pb-5 mb-5 text-left flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-6 h-6 bg-blue-700 rounded text-white flex items-center justify-center font-bold text-xs select-none">N</span>
                          <span className="font-extrabold text-base tracking-tight text-slate-900 font-mono">NetPow</span>
                        </div>
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">KABİNET DETAYLI BAĞLANTI VE KABLOLAMA ÇİZELGESİ</h2>
                        <p className="text-[10px] text-slate-400 font-medium">Kabinet İçi Tüm Fiziksel Bakır, Fiber ve Güç Bağlantılarının Tam Listesi</p>
                      </div>
                      <div className="text-right font-mono text-[9px] text-slate-500 space-y-0.5">
                        <div className="truncate max-w-[200px]"><strong>PROJE:</strong> {reportTitle}</div>
                        <div><strong>TARİH:</strong> {today}</div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-3 bg-white text-left">
                      <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                        <Network className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        Kablolama ve Bağlantı Çizelgesi (Cabling Schedule)
                      </h3>

                      {cables.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center">Tasarımda herhangi bir kablo bağlantısı bulunmuyor.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[9.5px] border-collapse">
                            <thead>
                              <tr className="border-b border-slate-300 text-slate-500 font-bold uppercase tracking-wider bg-slate-50">
                                <th className="p-1.5 font-sans">KOD / ID</th>
                                <th className="p-1.5 font-sans">ETİKET</th>
                                <th className="p-1.5 font-sans">KAYNAK CİHAZ & PORT</th>
                                <th className="p-1.5 font-sans">HEDEF CİHAZ & PORT</th>
                                <th className="p-1.5 font-sans text-center">UZUNLUK</th>
                                <th className="p-1.5 font-sans">TÜR & RENK</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {cables.map((cable, idx) => {
                                const srcDev = devices.find(d => d.id === cable.fromDeviceId);
                                const dstDev = devices.find(d => d.id === cable.toDeviceId);
                                const srcPort = srcDev?.ports.find(p => p.id === cable.fromPortId);
                                const dstPort = dstDev?.ports.find(p => p.id === cable.toPortId);

                                return (
                                  <tr key={cable.id} className="hover:bg-slate-50/50">
                                    <td className="p-1.5 font-mono font-bold text-slate-400">CAB-{idx + 1}</td>
                                    <td className="p-1.5 font-bold text-slate-700">{cable.label || '-'}</td>
                                    <td className="p-1.5 text-slate-600 font-medium">{srcDev?.name} <span className="text-[8px] font-mono text-slate-400">({srcPort?.name})</span></td>
                                    <td className="p-1.5 text-slate-600 font-medium">{dstDev?.name} <span className="text-[8px] font-mono text-slate-400">({dstPort?.name})</span></td>
                                    <td className="p-1.5 text-center font-bold text-slate-700">{cable.length}m</td>
                                    <td className="p-1.5 flex items-center gap-1.5 text-slate-600 font-semibold text-[8.5px]">
                                      <span className="w-2.5 h-2.5 rounded border border-slate-300 inline-block shrink-0" style={{ backgroundColor: cable.color }} />
                                      {getCableTypeLabel(cable.type)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 mt-4 text-center text-[9px] text-slate-400 font-mono flex justify-between select-none">
                    <span>NetPow Raporlama Aracı • Sayfa {pageNumbers.table}/{totalPagesCount}</span>
                    <span>Altyapı Kablolama Çizelgesi</span>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>

    <style>{`
        @media print {
          /* Reset root HTML & body overflow/height to support multiple pages */
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide ALL direct children of the React root except the print modal */
          #root > div:not(.print-modal-container),
          #root > div > *:not(.print-modal-container) {
            display: none !important;
          }

          /* Force the print modal overlay and its descendants to occupy standard page flow and allow overflow */
          .print-modal-container {
            position: static !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Hide modal toolbar, advice bars, and the configuration panel */
          .print-modal-container > div > div:first-child, /* Toolbar */
          .print-modal-container > div > .bg-blue-50,      /* Tip bar */
          .print\\:hidden,
          .print-sidebar {
            display: none !important;
          }

          /* Unconstrain the inner dialog layout */
          .print-modal-container .print-modal-content {
            display: block !important;
            width: auto !important;
            height: auto !important;
            max-width: none !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-modal-container .print-content-body {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
          }

          /* Scrollable preview panel where #print-report-area is hosted */
          .print-modal-container .print-content-body > div:last-child {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }

          /* Style the printable area for A4 sizes and multi-page layout */
          #print-report-area {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 15mm !important;
            margin: 0 auto !important;
            border: none !important;
            box-shadow: none !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            page-break-after: avoid !important;
            page-break-inside: auto !important;
          }

          /* Make each page segment take up full printable A4 page or break nicely */
          #print-report-area > div {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          /* Forced Page Breaks */
          .print-page-break {
            display: block !important;
            page-break-before: always !important;
            break-before: page !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          .print-page-break span {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
