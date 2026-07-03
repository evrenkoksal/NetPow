/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Device, Cable, CableType, Port, PortType } from '../types';
import { Zap, Network, Shield, Cpu, RefreshCw, Plus, Trash2, HelpCircle, Eye, EyeOff, Printer, Tag, X, Cloud, ZoomIn, ZoomOut } from 'lucide-react';

interface TopologyCanvasProps {
  devices: Device[];
  cables: Cable[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onUpdateDeviceCoords: (
    updates: { id: string; x: number; y: number }[] | string,
    x?: number,
    y?: number
  ) => void;
  onAddCable: (
    cable: Omit<Cable, 'id'>,
    newPortsToCreate?: { deviceId: string; name: string; type: Port['type'] }[]
  ) => void;
  onRemoveCable: (cableId: string) => void;
}

export function TopologyCanvas({
  devices,
  cables,
  selectedDeviceId,
  onSelectDevice,
  onUpdateDeviceCoords,
  onAddCable,
  onRemoveCable,
}: TopologyCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  

  // Dragging device node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // New Cable State
  const [isAddingCable, setIsAddingCable] = useState(false);
  const [cableFromDevice, setCableFromDevice] = useState<string>('');
  const [cableFromPort, setCableFromPort] = useState<string>('');
  const [cableFromNewPortName, setCableFromNewPortName] = useState('');
  const [cableFromNewPortType, setCableFromNewPortType] = useState<PortType>('ethernet');

  const [cableToDevice, setCableToDevice] = useState<string>('');
  const [cableToPort, setCableToPort] = useState<string>('');
  const [cableToNewPortName, setCableToNewPortName] = useState('');
  const [cableToNewPortType, setCableToNewPortType] = useState<PortType>('ethernet');

  const [cableType, setCableType] = useState<CableType>('cat6');
  const [cableColor, setCableColor] = useState<string>('#3b82f6'); // blue
  const [cableLength, setCableLength] = useState<number>(1.5);
  const [cableLabel, setCableLabel] = useState<string>('');

  // Filtering views
  const [showNetworkCables, setShowNetworkCables] = useState(true);
  const [showPowerCables, setShowPowerCables] = useState(true);

  // Selected Cable details highlight
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);

  // Cable label printing menu states
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelWidth, setLabelWidth] = useState<number>(90); // in mm (Optimized default for Brother 36mm)
  const [labelHeight, setLabelHeight] = useState<number>(36); // in mm (Optimized default for Brother 36mm)
  const [labelFontSize, setLabelFontSize] = useState<number>(10); // in px
  const [labelStyle, setLabelStyle] = useState<string>('flag'); // 'flag' (bayrak), 'wrap' (sarma), 'single' (tek yüz)
  const [showBarcode, setShowBarcode] = useState<boolean>(true);

  // Active cable helpers for label printing
  const activeCable = selectedCableId ? cables.find(c => c.id === selectedCableId) : null;
  const activeSrcDev = activeCable ? devices.find(d => d.id === activeCable.fromDeviceId) : null;
  const activeDstDev = activeCable ? devices.find(d => d.id === activeCable.toDeviceId) : null;
  const activeSrcPort = activeSrcDev?.ports.find(p => p.id === activeCable?.fromPortId);
  const activeDstPort = activeDstDev?.ports.find(p => p.id === activeCable?.toPortId);

  // Auto layout nodes based on device types (Network top, Compute middle, Power bottom)
  // Pins external devices cleanly on the left margin, and places cabinet devices inside.
  const handleAutoLayout = () => {
    if (!canvasRef.current) return;
    const physicalWidth = canvasRef.current.clientWidth || 800;
    const physicalHeight = canvasRef.current.clientHeight || 500;

    // Use stable coordinate bounds at baseline zoom level, with a generous minimum size
    // to prevent crowding/overlaps on small screens or when zoomed in/out.
    const width = Math.max(1200, physicalWidth);
    const height = Math.max(800, physicalHeight);

    const NODE_WIDTH = 190;
    const NODE_HEIGHT = 76;
    const MIN_GAP_X = 35; // Generous horizontal gap to prevent any overlap
    const MIN_GAP_Y = 25; // Vertical gap when wrapping to multiple rows

    const updates: { id: string; x: number; y: number }[] = [];
    const placedPositions = new Map<string, { x: number; y: number }>();

    // We'll separate external and cabinet devices
    const externalNetworks = devices.filter(d => d.type === 'network' && d.isExternal);
    const cabinetNetworks = devices.filter(d => d.type === 'network' && !d.isExternal);
    const externalPowers = devices.filter(d => d.type === 'power' && d.isExternal);
    const cabinetPowers = devices.filter(d => (d.type === 'power' || d.type === 'accessory') && !d.isExternal);
    const computes = devices.filter(
      d => d.type === 'compute' || (d.type !== 'network' && d.type !== 'power' && d.type !== 'accessory')
    );

    // Left sidebar buffer if external devices are present
    const leftBoundary = (externalNetworks.length > 0 || externalPowers.length > 0) ? 280 : 40;

    // Layout helper to arrange a group of devices horizontally, wrapping into rows if they exceed the available width.
    const arrangeLayer = (
      layerDevices: Device[],
      startY: number,
      startX: number,
      endX: number,
      staggerAmount: number = 0
    ) => {
      if (layerDevices.length === 0) return;

      const availableWidth = endX - startX;
      const minStepX = NODE_WIDTH + MIN_GAP_X;

      // Calculate how many devices can fit in one row
      const maxInRow = Math.max(1, Math.floor((availableWidth + MIN_GAP_X) / minStepX));

      layerDevices.forEach((device, index) => {
        const row = Math.floor(index / maxInRow);
        const col = index % maxInRow;

        // Number of items in this row
        const itemsInThisRow = Math.min(layerDevices.length - row * maxInRow, maxInRow);

        // Center the row's devices within the available width
        const rowWidth = itemsInThisRow * NODE_WIDTH + (itemsInThisRow - 1) * MIN_GAP_X;
        const rowStartX = startX + (availableWidth - rowWidth) / 2;

        const xVal = Math.round(rowStartX + col * minStepX);
        const stagger = staggerAmount > 0 ? (col % 2 === 0 ? -staggerAmount : staggerAmount) : 0;
        const yVal = Math.round(startY + row * (NODE_HEIGHT + MIN_GAP_Y) + stagger);

        // Ensure nodes stay within safe boundaries
        const boundedX = Math.max(10, Math.min(xVal, width - NODE_WIDTH - 10));
        const boundedY = Math.max(10, Math.min(yVal, height - NODE_HEIGHT - 10));

        placedPositions.set(device.id, { x: boundedX, y: boundedY });
        updates.push({ id: device.id, x: boundedX, y: boundedY });
      });
    };

    // 1. EXTERNAL NETWORKS PLACEMENT (Left-top area)
    arrangeLayer(externalNetworks, 60, 40, leftBoundary - 40);

    // 2. EXTERNAL POWERS PLACEMENT (Left-bottom area)
    arrangeLayer(externalPowers, Math.round(height * 0.70), 40, leftBoundary - 40);

    // 3. CABINET NETWORK LAYER (Top-right area)
    // Sort cabinet networks by current X position or name to preserve order preference
    cabinetNetworks.sort((a, b) => (a.x !== b.x ? a.x - b.x : a.name.localeCompare(b.name)));
    arrangeLayer(
      cabinetNetworks, 
      Math.round(height * 0.15), 
      leftBoundary, 
      width - 40, 
      cabinetNetworks.length > 3 ? 15 : 0
    );

    // 4. COMPUTE LAYER (Middle-right area)
    // Calculate barycenters of compute devices based on connections to reduce wire crossing
    const computeBarycenters = computes.map(device => {
      const connectedDeviceIds = cables
        .filter(c => c.fromDeviceId === device.id || c.toDeviceId === device.id)
        .map(c => (c.fromDeviceId === device.id ? c.toDeviceId : c.fromDeviceId));
      
      const connectedXs = connectedDeviceIds
        .map(id => placedPositions.get(id)?.x)
        .filter((x): x is number => x !== undefined);
      
      const avgX = connectedXs.length > 0 
        ? connectedXs.reduce((sum, x) => sum + x, 0) / connectedXs.length 
        : width / 2;

      return { device, avgX };
    });

    computeBarycenters.sort((a, b) => a.avgX - b.avgX);
    const sortedComputes = computeBarycenters.map(cb => cb.device);
    arrangeLayer(
      sortedComputes, 
      Math.round(height * 0.44), 
      leftBoundary, 
      width - 40, 
      sortedComputes.length > 2 ? 15 : 0
    );

    // 5. CABINET POWER & ACCESSORIES LAYER (Bottom-right area)
    const powerBarycenters = cabinetPowers.map(device => {
      const connectedDeviceIds = cables
        .filter(c => c.fromDeviceId === device.id || c.toDeviceId === device.id)
        .map(c => (c.fromDeviceId === device.id ? c.toDeviceId : c.fromDeviceId));
      
      const connectedXs = connectedDeviceIds
        .map(id => placedPositions.get(id)?.x)
        .filter((x): x is number => x !== undefined);
      
      const avgX = connectedXs.length > 0 
        ? connectedXs.reduce((sum, x) => sum + x, 0) / connectedXs.length 
        : width / 2;

      return { device, avgX };
    });

    powerBarycenters.sort((a, b) => a.avgX - b.avgX);
    const sortedPowers = powerBarycenters.map(pb => pb.device);
    arrangeLayer(
      sortedPowers, 
      Math.round(height * 0.74), 
      leftBoundary, 
      width - 40, 
      sortedPowers.length > 3 ? 15 : 0
    );

    if (updates.length > 0) {
      onUpdateDeviceCoords(updates);
    }
  };

  // Run auto layout once if devices are clustered at 0,0
  useEffect(() => {
    const isClustered = devices.every(d => d.x === 0 && d.y === 0);
    if (isClustered && devices.length > 0) {
      setTimeout(handleAutoLayout, 100);
    }
  }, [devices.length]);

  // Handle Dragging Node
  const handleNodeMouseDown = (e: React.MouseEvent, deviceId: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    
    // Select the device immediately on mouse down/click
    onSelectDevice(deviceId);
    
    setDraggingNodeId(deviceId);
    
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / zoom;
      const clickY = (e.clientY - rect.top) / zoom;
      
      // Calculate exact cursor offset from the node's top-left (currentX, currentY) position.
      // This ensures smooth dragging starting from the precise pixel where the user clicked,
      // and completely prevents jumping or sliding on single clicks.
      setDragOffset({
        x: clickX - currentX,
        y: clickY - currentY
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !canvasRef.current) return;
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - dragOffset.x;
    const y = (e.clientY - rect.top) / zoom - dragOffset.y;

    // Boundary constraints inside canvas
    const boundedX = Math.max(10, Math.min(x, (rect.width / zoom) - 200));
    const boundedY = Math.max(10, Math.min(y, (rect.height / zoom) - 90));

    // Create a temporary list of devices with the new position for draggingNodeId
    const tempDevices = devices.map(d => {
      if (d.id === draggingNodeId) {
        return { ...d, x: Math.round(boundedX), y: Math.round(boundedY) };
      }
      return d;
    });

    const overlapUpdates = resolveOverlaps(draggingNodeId, tempDevices);
    
    // Combine the dragged node update with any pushed node updates
    const allUpdates = [
      { id: draggingNodeId, x: Math.round(boundedX), y: Math.round(boundedY) },
      ...overlapUpdates
    ];
    
    onUpdateDeviceCoords(allUpdates);
  };

  // Helper to resolve device overlaps on drag drop (Bypassed so devices do not push each other as requested)
  const resolveOverlaps = (draggedId: string, currentDevices: Device[]): { id: string; x: number; y: number }[] => {
    return [];
  };

  const handleCanvasMouseUp = () => {
    if (draggingNodeId) {
      const updates = resolveOverlaps(draggingNodeId, devices);
      if (updates.length > 0) {
        onUpdateDeviceCoords(updates);
      }
    }
    setDraggingNodeId(null);
  };

  // Watch device A selection to auto-populate ports
  const fromDeviceObj = devices.find(d => d.id === cableFromDevice);
  const toDeviceObj = devices.find(d => d.id === cableToDevice);

  // Available ports filter: don't show already connected ports
  const getAvailablePorts = (device: Device) => {
    return device.ports.filter(p => !p.connectedToCableId);
  };

  const handleCreateCable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cableFromDevice || !cableFromPort || !cableToDevice || !cableToPort) {
      alert('Lütfen kablo uç bağlantılarını seçin.');
      return;
    }

    const newPortsToCreate: { deviceId: string; name: string; type: PortType }[] = [];

    let finalFromPortId = cableFromPort;
    let finalToPortId = cableToPort;

    const fromDev = devices.find(d => d.id === cableFromDevice);
    const toDev = devices.find(d => d.id === cableToDevice);

    if (cableFromPort === 'new') {
      if (!cableFromNewPortName.trim()) {
        alert('Lütfen A ucu için yeni port adını girin.');
        return;
      }
      if (fromDev) {
        const nameExists = fromDev.ports.some(p => p.name.toLowerCase() === cableFromNewPortName.trim().toLowerCase());
        if (nameExists) {
          alert(`Cihaz A üzerinde "${cableFromNewPortName.trim()}" isminde bir port zaten mevcut!`);
          return;
        }
      }
      finalFromPortId = `new-port-${cableFromDevice}`;
      newPortsToCreate.push({
        deviceId: cableFromDevice,
        name: cableFromNewPortName.trim(),
        type: cableFromNewPortType,
      });
    }

    if (cableToPort === 'new') {
      if (!cableToNewPortName.trim()) {
        alert('Lütfen B ucu için yeni port adını girin.');
        return;
      }
      if (toDev) {
        const nameExists = toDev.ports.some(p => p.name.toLowerCase() === cableToNewPortName.trim().toLowerCase());
        if (nameExists) {
          alert(`Cihaz B üzerinde "${cableToNewPortName.trim()}" isminde bir port zaten mevcut!`);
          return;
        }
      }
      finalToPortId = `new-port-${cableToDevice}`;
      newPortsToCreate.push({
        deviceId: cableToDevice,
        name: cableToNewPortName.trim(),
        type: cableToNewPortType,
      });
    }

    onAddCable({
      fromDeviceId: cableFromDevice,
      fromPortId: finalFromPortId,
      toDeviceId: cableToDevice,
      toPortId: finalToPortId,
      type: cableType,
      color: cableColor,
      length: cableLength,
      label: cableLabel || `${fromDeviceObj?.name} ➔ ${toDeviceObj?.name}`,
    }, newPortsToCreate);

    // Reset Form
    setIsAddingCable(false);
    setCableFromDevice('');
    setCableFromPort('');
    setCableFromNewPortName('');
    setCableToDevice('');
    setCableToPort('');
    setCableToNewPortName('');
    setCableLabel('');
  };

  // Map cable type to Turkish labels
  const getCableTypeLabel = (type: CableType) => {
    switch (type) {
      case 'cat6': return 'Cat6 Ethernet';
      case 'cat6a': return 'Cat6A S/FTP';
      case 'fiber': return 'Fiber Optik (SFP)';
      case 'power_c13': return 'Güç Kablosu (C13/C14)';
      case 'power_c19': return 'Güç Kablosu (C19/C20)';
    }
  };

  // Helper to determine node icon
  const getNodeIcon = (device: Device) => {
    if (device.isExternal) {
      if (device.type === 'network') {
        return <Cloud className="h-5 w-5 text-blue-500 animate-pulse" />;
      }
      return <Zap className="h-5 w-5 text-amber-500 animate-pulse" />;
    }
    switch (device.subtype) {
      case 'router':
      case 'switch':
      case 'patch_panel':
        return <Network className="h-5 w-5 text-blue-400" />;
      case 'firewall':
        return <Shield className="h-5 w-5 text-red-400" />;
      case 'pdu':
      case 'ups':
        return <Zap className="h-5 w-5 text-amber-400" />;
      case 'server':
      case 'storage':
        return <Cpu className="h-5 w-5 text-emerald-400" />;
      default:
        return <HelpCircle className="h-5 w-5 text-slate-400" />;
    }
  };

  // Filter cables based on visibility toggles
  const filteredCables = cables.filter((cable) => {
    const isPower = cable.type.startsWith('power');
    if (isPower && !showPowerCables) return false;
    if (!isPower && !showNetworkCables) return false;
    return true;
  });

  return (
    <div id="topology-canvas" className="flex flex-col h-full bg-[#F8FAFC] text-slate-800 select-none">
      
      {/* Top action toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-3 p-4 bg-white border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Bağlantı ve Kablolama Topolojisi</h3>
          <p className="text-[11px] text-slate-400">Cihazları taşıyın, üzerlerine tıklayarak kablo çekin veya bağlantıları analiz edin.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Cable Visibility filters */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs animate-fade-in">
            <button
              onClick={() => setShowNetworkCables(!showNetworkCables)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer ${
                showNetworkCables ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {showNetworkCables ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Ağ Kabloları
            </button>
            <button
              onClick={() => setShowPowerCables(!showPowerCables)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer ${
                showPowerCables ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {showPowerCables ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Güç Kabloları
            </button>
          </div>

          {/* Zoom controls */}
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

          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Cihazları katmanlara göre otomatik sıralar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Akıllı Hizala
          </button>

          <button
            onClick={() => setIsAddingCable(true)}
            disabled={devices.length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Kablo Bağla
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden min-h-[450px]">
        
        {/* Dynamic Cable Creator Form Overlay */}
        {isAddingCable && (
          <div className="absolute top-4 left-4 z-20 w-80 bg-white border border-slate-200 rounded-xl p-4 shadow-2xl text-slate-700 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider">Kablo Çekme Sihirbazı</h4>
              <button 
                onClick={() => setIsAddingCable(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-mono font-bold"
              >
                Kapat
              </button>
            </div>

            <form onSubmit={handleCreateCable} className="space-y-3 border-t border-slate-50 pt-2 text-xs">
              
              {/* Device A (Source) */}
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">A Ucu (Kaynak Cihaz):</label>
                <select
                  value={cableFromDevice}
                  onChange={(e) => {
                    setCableFromDevice(e.target.value);
                    setCableFromPort('');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700"
                  required
                >
                  <option value="">Cihaz Seçin...</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} [{d.model}]</option>
                  ))}
                </select>
              </div>

              {/* Port A */}
              {cableFromDevice && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-500 mb-1 font-semibold">Cihaz A Portu:</label>
                    <select
                      value={cableFromPort}
                      onChange={(e) => setCableFromPort(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700"
                      required
                    >
                      <option value="">Port Seçin...</option>
                      {fromDeviceObj && getAvailablePorts(fromDeviceObj).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type === 'power_in' ? 'Güç Giriş' : p.type === 'power_out' ? 'Güç Çıkış' : p.type})
                        </option>
                      ))}
                      <option value="new">+ Yeni Port Oluştur...</option>
                    </select>
                  </div>

                  {/* New Port A Fields */}
                  {cableFromPort === 'new' && (
                    <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">YENİ PORT ADI:</label>
                          <input
                            type="text"
                            required
                            placeholder="örn: Gi0/1"
                            value={cableFromNewPortName}
                            onChange={(e) => setCableFromNewPortName(e.target.value)}
                            className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">PORT TİPİ:</label>
                          <select
                            value={cableFromNewPortType}
                            onChange={(e) => setCableFromNewPortType(e.target.value as PortType)}
                            className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-700"
                          >
                            <option value="ethernet">RJ45 Ethernet</option>
                            <option value="fiber">Fiber SFP</option>
                            <option value="power_in">Güç Girişi</option>
                            <option value="power_out">Güç Çıkışı</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Device B (Target) */}
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">B Ucu (Hedef Cihaz):</label>
                <select
                  value={cableToDevice}
                  onChange={(e) => {
                    setCableToDevice(e.target.value);
                    setCableToPort('');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700"
                  required
                >
                  <option value="">Cihaz Seçin...</option>
                  {devices.filter(d => d.id !== cableFromDevice).map(d => (
                    <option key={d.id} value={d.id}>{d.name} [{d.model}]</option>
                  ))}
                </select>
              </div>

              {/* Port B */}
              {cableToDevice && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-500 mb-1 font-semibold">Cihaz B Portu:</label>
                    <select
                      value={cableToPort}
                      onChange={(e) => setCableToPort(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700"
                      required
                    >
                      <option value="">Port Seçin...</option>
                      {toDeviceObj && getAvailablePorts(toDeviceObj).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type === 'power_in' ? 'Güç Giriş' : p.type === 'power_out' ? 'Güç Çıkış' : p.type})
                        </option>
                      ))}
                      <option value="new">+ Yeni Port Oluştur...</option>
                    </select>
                  </div>

                  {/* New Port B Fields */}
                  {cableToPort === 'new' && (
                    <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">YENİ PORT ADI:</label>
                          <input
                            type="text"
                            required
                            placeholder="örn: Gi0/2"
                            value={cableToNewPortName}
                            onChange={(e) => setCableToNewPortName(e.target.value)}
                            className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">PORT TİPİ:</label>
                          <select
                            value={cableToNewPortType}
                            onChange={(e) => setCableToNewPortType(e.target.value as PortType)}
                            className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-700"
                          >
                            <option value="ethernet">RJ45 Ethernet</option>
                            <option value="fiber">Fiber SFP</option>
                            <option value="power_in">Güç Girişi</option>
                            <option value="power_out">Güç Çıkışı</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cable Spec details */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Kablo Türü:</label>
                  <select
                    value={cableType}
                    onChange={(e) => {
                      const t = e.target.value as CableType;
                      setCableType(t);
                      // Auto color suggestions
                      if (t.startsWith('power')) setCableColor('#000000');
                      else if (t === 'fiber') setCableColor('#eab308');
                      else setCableColor('#3b82f6');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                  >
                    <option value="cat6">Cat6 Ethernet</option>
                    <option value="cat6a">Cat6A S/FTP</option>
                    <option value="fiber">Fiber Optik</option>
                    <option value="power_c13">Güç C13/C14</option>
                    <option value="power_c19">Güç C19/C20</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Kablo Rengi:</label>
                  <select
                    value={cableColor}
                    onChange={(e) => setCableColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                  >
                    <option value="#3b82f6">Mavi (Ağ)</option>
                    <option value="#eab308">Sarı (Fiber/Uplink)</option>
                    <option value="#ef4444">Kırmızı (Kritik)</option>
                    <option value="#10b981">Yeşil (Management)</option>
                    <option value="#000000">Siyah (Güç)</option>
                    <option value="#ffffff">Beyaz (Genel)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Uzunluk (Metre):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={cableLength}
                    onChange={(e) => setCableLength(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Etiket:</label>
                  <input
                    type="text"
                    placeholder="örn: Trunk"
                    value={cableLabel}
                    onChange={(e) => setCableLabel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 font-semibold py-2 rounded-lg text-white transition-colors shadow-sm mt-2 cursor-pointer"
              >
                Kabloyu Bağla
              </button>
            </form>
          </div>
        )}

        {/* The Drag and Drop Interactive Drawing Board with Clean Light Radial Dot Background */}
        <div
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="flex-1 relative bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px] bg-white border border-slate-200 rounded-xl m-4 overflow-hidden shadow-inner"
          style={{ minHeight: '450px' }}
        >
          {/* Zoom Wrapper container */}
          <div 
            className="absolute inset-0 transition-transform duration-100 ease-out origin-top-left"
            style={{ 
              transform: `scale(${zoom})`,
              width: `${100 / zoom}%`,
              height: `${100 / zoom}%`
            }}
          >
            {/* SVG Connection links layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {/* Definitions for arrow marker endpoints */}
            <defs>
              <marker
                id="arrow-marker"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#cbd5e1" />
              </marker>
            </defs>

            {/* Cabling Lines Rendering */}
            {filteredCables.map((cable) => {
              const devFrom = devices.find((d) => d.id === cable.fromDeviceId);
              const devTo = devices.find((d) => d.id === cable.toDeviceId);

              if (!devFrom || !devTo) return null;

              // Node dimensions (approx center calculation)
              const w = 190;
              const h = 76;

              const x1 = devFrom.x + w / 2;
              const y1 = devFrom.y + h / 2;
              const x2 = devTo.x + w / 2;
              const y2 = devTo.y + h / 2;

              // Calculate control points for smooth bezier curves with parallel cable offsetting
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy);

              // Find parallel cables between these same two devices to offset them
              const samePairCables = filteredCables.filter(c => 
                (c.fromDeviceId === cable.fromDeviceId && c.toDeviceId === cable.toDeviceId) ||
                (c.fromDeviceId === cable.toDeviceId && c.toDeviceId === cable.fromDeviceId)
              );
              const totalCablesInPair = samePairCables.length;
              const sortedSamePair = [...samePairCables].sort((a, b) => a.id.localeCompare(b.id));
              const cableIndexInPair = sortedSamePair.findIndex(c => c.id === cable.id);

              let px = 0;
              let py = 0;
              if (len > 0) {
                // Perpendicular vector
                px = -dy / len;
                py = dx / len;
              }

              // Apply perpendicular offset to control points so multiple lines curve apart
              const offsetStep = 18; // Separating pixels
              const midIndex = (totalCablesInPair - 1) / 2;
              const bend = (cableIndexInPair - midIndex) * offsetStep;

              const cx1 = x1 + dx * 0.4 + px * bend;
              const cy1 = y1 + py * bend;
              const cx2 = x1 + dx * 0.6 + px * bend;
              const cy2 = y2 + py * bend;

              const isSelected = selectedCableId === cable.id;
              const isPower = cable.type.startsWith('power');

              return (
                <g key={cable.id} className="pointer-events-auto cursor-pointer">
                  {/* Invisible thick line to make clicking cables easy */}
                  <path
                    d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="12"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCableId(cable.id === selectedCableId ? null : cable.id);
                    }}
                  />

                  {/* Main visible connection line */}
                  <path
                    d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={cable.color}
                    strokeWidth={isSelected ? '4.5' : '2.5'}
                    strokeDasharray={cable.type === 'fiber' ? '5,5' : undefined}
                    className="transition-all duration-150"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCableId(cable.id === selectedCableId ? null : cable.id);
                    }}
                  />

                  {/* Flow Animation (Light pulse running along cable) */}
                  <path
                    d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isPower ? '#f59e0b' : '#38bdf8'}
                    strokeWidth="1.5"
                    strokeDasharray="8, 25"
                    strokeDashoffset="0"
                    opacity="0.8"
                    className="animate-pulse"
                    style={{
                      animation: 'dash 3s linear infinite',
                      strokeDasharray: '4, 15',
                    }}
                  />

                  {/* Cable Label Badge */}
                  <foreignObject
                    x={(x1 + x2) / 2 - 50}
                    y={(y1 + y2) / 2 - 10}
                    width="100"
                    height="20"
                    className="overflow-visible"
                  >
                    <div 
                      onClick={() => setSelectedCableId(cable.id)}
                      className={`px-1.5 py-0.5 rounded text-[8px] text-center font-bold truncate border shadow-sm ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-400 text-white font-bold ring-2 ring-blue-500/30'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      title={`${cable.label} (${cable.length}m)`}
                    >
                      {cable.label || getCableTypeLabel(cable.type)}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* Styled Device Nodes on the Canvas with high contrast Professional Polish */}
          {devices.map((device) => {
            const isSelected = selectedDeviceId === device.id;
            
            let nodeBorderColor = 'border-slate-200 bg-white shadow-sm';
            if (isSelected) {
              nodeBorderColor = 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/10';
            } else if (device.isExternal) {
              nodeBorderColor = device.type === 'network' 
                ? 'border-blue-200 hover:border-blue-400 bg-blue-50/30 shadow-sm'
                : 'border-amber-200 hover:border-amber-400 bg-amber-50/30 shadow-sm';
            } else if (device.type === 'network') {
              nodeBorderColor = 'border-slate-200 hover:border-blue-400 bg-white shadow-sm';
            } else if (device.type === 'power') {
              nodeBorderColor = 'border-slate-200 hover:border-amber-400 bg-white shadow-sm';
            } else if (device.type === 'compute') {
              nodeBorderColor = 'border-slate-200 hover:border-emerald-400 bg-white shadow-sm';
            }

            return (
              <div
                key={device.id}
                onMouseDown={(e) => handleNodeMouseDown(e, device.id, device.x, device.y)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDevice(device.id);
                }}
                style={{
                  position: 'absolute',
                  left: `${device.x}px`,
                  top: `${device.y}px`,
                  width: '190px',
                  height: '76px',
                }}
                className={`rounded-lg border p-2 flex flex-col justify-between cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none z-10 ${nodeBorderColor}`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 truncate max-w-[145px]">
                    {getNodeIcon(device)}
                    <div className="truncate text-left">
                      <h4 className="font-bold text-xs text-slate-800 truncate leading-tight">
                        {device.name}
                      </h4>
                      <span className="text-[9px] text-slate-400 block truncate font-mono mt-0.5">
                        {device.model}
                      </span>
                    </div>
                  </div>
                  
                  {/* U badge */}
                  <span className="text-[8px] font-bold font-mono px-1 py-0.5 bg-slate-100 text-slate-500 border border-slate-200/50 rounded shrink-0">
                    {device.isExternal ? 'DIŞ' : (device.uPosition ? `${device.uPosition}U` : 'RAF')}
                  </span>
                </div>

                {/* Node Footer */}
                <div className="flex justify-between items-center text-[9px] border-t border-slate-100 pt-1.5 text-slate-500">
                  <span className="font-mono">{device.ipAddress || 'IP Yok'}</span>
                  <span className="font-mono text-slate-400 font-semibold">
                    {device.ports.filter(p => p.connectedToCableId).length} / {device.ports.length} Port
                  </span>
                </div>

                {/* Visual Connector Ports Overlay dots for aesthetics */}
                <div className="absolute -bottom-1 left-4 right-4 flex justify-between px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white border border-slate-300" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white border border-slate-300" />
                </div>
              </div>
            );
          })}
          </div>

          {devices.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-slate-400">
              <Network className="h-8 w-8 mb-2 opacity-50 text-blue-500" />
              <p className="text-xs font-bold uppercase tracking-wider">Tasarım Alanı Boş</p>
              <p className="text-[11px] text-slate-400 mt-1">Sol kütüphaneden kabine cihaz ekleyin ve aralarında kablo çekin.</p>
            </div>
          )}
        </div>

        {/* Selected Cable Details Bar / Drawer - Polished theme */}
        {selectedCableId && (
          <div className="w-full md:w-64 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-4 flex flex-col justify-between text-slate-700 animate-in slide-in-from-right duration-150">
            <div>
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider">Kablo Bilgileri</h4>
                <button
                  onClick={() => setSelectedCableId(null)}
                  className="text-slate-400 hover:text-slate-600 font-mono text-xs font-bold"
                >
                  Kapat
                </button>
              </div>

              {(() => {
                const cable = cables.find(c => c.id === selectedCableId);
                if (!cable) return null;
                const srcDev = devices.find(d => d.id === cable.fromDeviceId);
                const dstDev = devices.find(d => d.id === cable.toDeviceId);
                const srcPort = srcDev?.ports.find(p => p.id === cable.fromPortId);
                const dstPort = dstDev?.ports.find(p => p.id === cable.toPortId);

                return (
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-slate-400 block font-semibold">Kablo Etiketi:</span>
                      <span className="font-bold text-slate-800 text-sm">{cable.label || 'İsimsiz Kablo'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-semibold">Kablo Türü:</span>
                      <span className="inline-block px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-slate-600">
                        {getCableTypeLabel(cable.type)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 block font-semibold">Uzunluk:</span>
                        <span className="font-bold text-slate-700">{cable.length} Metre</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Renk:</span>
                        <span className="flex items-center gap-1.5 font-bold text-slate-700">
                          <span className="w-3.5 h-3.5 rounded border border-slate-300" style={{ backgroundColor: cable.color }} />
                          Sınıfı
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
                      <div>
                        <strong className="text-blue-600 block text-[9px] uppercase tracking-wider font-bold">A BAĞLANTISI (KAYNAK):</strong>
                        <span className="font-bold text-slate-800">{srcDev?.name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">Port: {srcPort?.name}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2">
                        <strong className="text-blue-600 block text-[9px] uppercase tracking-wider font-bold">B BAĞLANTISI (HEDEF):</strong>
                        <span className="font-bold text-slate-800">{dstDev?.name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">Port: {dstPort?.name}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsLabelModalOpen(true)}
                      className="w-full mt-3 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Kablo Etiketi Bas
                    </button>

                    <button
                      onClick={() => {
                        onRemoveCable(cable.id);
                        setSelectedCableId(null);
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Bağlantıyı Sök (Sil)
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>

      {/* CABLE LABEL PRINTING MODAL */}
      {isLabelModalOpen && activeCable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4 select-none">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-150">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-600 animate-pulse" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Profesyonel Kablo Etiketi Bas</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Datacenter / Network kablonuz için termal yazıcı formatında etiket çıktısı alın.</p>
                </div>
              </div>
              <button
                onClick={() => setIsLabelModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Presets and Size Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left side: Controls */}
                <div className="space-y-4">
                  
                  {/* Quick Preset Buttons */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider text-left">HIZLI YAZICI BOYUTU ŞABLONLARI:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => { setLabelWidth(90); setLabelHeight(36); setLabelFontSize(10); }}
                        className={`text-[10px] p-2 rounded-lg border text-left transition-all cursor-pointer ${labelWidth === 90 && labelHeight === 36 ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Brother 36mm (90x36mm) ⭐
                      </button>
                      <button
                        onClick={() => { setLabelWidth(62); setLabelHeight(29); setLabelFontSize(10); }}
                        className={`text-[10px] p-2 rounded-lg border text-left transition-all cursor-pointer ${labelWidth === 62 && labelHeight === 29 ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Brother 62mm x 29mm
                      </button>
                      <button
                        onClick={() => { setLabelWidth(54); setLabelHeight(25); setLabelFontSize(9); }}
                        className={`text-[10px] p-2 rounded-lg border text-left transition-all cursor-pointer ${labelWidth === 54 && labelHeight === 25 ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Dymo 54mm x 25mm
                      </button>
                      <button
                        onClick={() => { setLabelWidth(38); setLabelHeight(90); setLabelFontSize(11); }}
                        className={`text-[10px] p-2 rounded-lg border text-left transition-all cursor-pointer ${labelWidth === 38 && labelHeight === 90 ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Zebra 38mm x 90mm
                      </button>
                      <button
                        onClick={() => { setLabelWidth(80); setLabelHeight(40); setLabelFontSize(13); }}
                        className={`text-[10px] p-2 rounded-lg border text-left transition-all cursor-pointer ${labelWidth === 80 && labelHeight === 40 ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Geniş 80mm x 40mm
                      </button>
                    </div>
                  </div>

                  {/* Manual dimensions */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">EN (MM):</label>
                      <input
                        type="number"
                        min="15"
                        max="150"
                        value={labelWidth}
                        onChange={(e) => setLabelWidth(Number(e.target.value) || 62)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">BOY (MM):</label>
                      <input
                        type="number"
                        min="10"
                        max="150"
                        value={labelHeight}
                        onChange={(e) => setLabelHeight(Number(e.target.value) || 29)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">YAZI (PX):</label>
                      <input
                        type="number"
                        min="6"
                        max="24"
                        value={labelFontSize}
                        onChange={(e) => setLabelFontSize(Number(e.target.value) || 10)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Label style selectors */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider text-left">ETİKET TASARIM TÜRÜ:</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => setLabelStyle('flag')}
                        className={`text-[10px] py-1.5 rounded border font-semibold text-center transition-all cursor-pointer ${labelStyle === 'flag' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        Bayrak (Flag)
                      </button>
                      <button
                        onClick={() => setLabelStyle('wrap')}
                        className={`text-[10px] py-1.5 rounded border font-semibold text-center transition-all cursor-pointer ${labelStyle === 'wrap' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        Sarma (Wrap)
                      </button>
                      <button
                        onClick={() => setLabelStyle('single')}
                        className={`text-[10px] py-1.5 rounded border font-semibold text-center transition-all cursor-pointer ${labelStyle === 'single' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        Tek Yüz (Patch)
                      </button>
                    </div>
                  </div>

                  {/* Toggle Barcode representation */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[11px] font-bold text-slate-700">Etikette Barkod / Grafik Göster</span>
                    <input
                      type="checkbox"
                      checked={showBarcode}
                      onChange={(e) => setShowBarcode(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                    />
                  </div>

                </div>

                {/* Right side: Real-time visual mockup preview */}
                <div className="flex flex-col justify-between border border-slate-200 rounded-xl bg-slate-50 p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 bg-slate-800 text-white text-[8px] px-2 py-0.5 rounded-br font-mono select-none">CANLI ETİKET ÖNİZLEME (MOCKUP)</span>
                  
                  {/* Dynamic Scaled Label Area */}
                  <div className="flex-1 flex items-center justify-center py-6 min-h-[160px]">
                    <div 
                      id="cable-label-preview-wrapper"
                      className="border border-dashed border-red-400 bg-white shadow-md relative overflow-hidden flex flex-col justify-center items-center p-2 font-sans"
                      style={{
                        width: `${Math.min(labelWidth * 3.5, 260)}px`,
                        height: `${Math.min(labelHeight * 3.5, 160)}px`,
                        fontSize: `${labelFontSize}px`
                      }}
                    >
                      {/* RED dashed bounds represents physical sticker edge */}
                      <span className="absolute top-0 right-0 text-[7px] text-red-500 font-semibold px-1 select-none">KESİM HATTI ({labelWidth}x{labelHeight}mm)</span>

                      {/* Content based on selected label style */}
                      {labelStyle === 'flag' && (
                        <div className="w-full h-full flex select-text text-black">
                          {/* Top / Left Half */}
                          <div className="flex-1 flex flex-col justify-center items-center border-r border-dashed border-black text-center px-1 text-[80%]">
                            <span className="font-extrabold text-black leading-none">A: {activeSrcDev?.name || 'KAYNAK'}</span>
                            <span className="text-black font-bold text-[85%] mt-0.5">PORT: {activeSrcPort?.name || 'P1'}</span>
                            <span className="text-[70%] text-black/60 block mt-1">▲ KATLA</span>
                          </div>
                          {/* Fold marker indicator */}
                          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col justify-between items-center z-10 py-1">
                            <span className="w-1.5 h-1.5 bg-black rounded-full select-none" />
                            <span className="text-[7px] text-black rotate-90 leading-none select-none font-bold">KATLAMA SEVİYESİ</span>
                            <span className="w-1.5 h-1.5 bg-black rounded-full select-none" />
                          </div>
                          {/* Bottom / Right Half */}
                          <div className="flex-1 flex flex-col justify-center items-center text-center px-1 text-[80%]">
                            <span className="font-extrabold text-black leading-none">B: {activeDstDev?.name || 'HEDEF'}</span>
                            <span className="text-black font-bold text-[85%] mt-0.5">PORT: {activeDstPort?.name || 'P2'}</span>
                            <span className="font-bold text-[80%] border border-black px-1.5 py-0.5 rounded bg-white mt-1 select-all">{activeCable?.label || 'CAB-01'}</span>
                          </div>
                        </div>
                      )}

                      {labelStyle === 'wrap' && (
                        <div className="w-full h-full flex flex-col justify-around items-start pl-2 select-text text-[80%] text-black">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black">A:</span>
                            <strong>{activeSrcDev?.name} ({activeSrcPort?.name})</strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black">B:</span>
                            <strong>{activeDstDev?.name} ({activeDstPort?.name})</strong>
                          </div>
                          <div className="text-[75%] flex justify-between w-full pr-2 text-black/80">
                            <span className="font-bold">KOD: {activeCable?.label || activeCable?.id}</span>
                            <span className="font-bold">{activeCable?.length}M</span>
                          </div>
                        </div>
                      )}

                      {labelStyle === 'single' && (
                        <div className="w-full h-full flex items-center justify-between gap-2 px-2 select-text text-black">
                          <div className="flex-1 flex flex-col justify-center text-left space-y-0.5">
                            <div className="font-black text-black truncate max-w-[140px] text-[105%]">{activeCable?.label || 'CAB-01'}</div>
                            <div className="text-[75%] font-semibold text-black/85 truncate">A: {activeSrcDev?.name} • {activeSrcPort?.name}</div>
                            <div className="text-[75%] font-semibold text-black/85 truncate">B: {activeDstDev?.name} • {activeDstPort?.name}</div>
                          </div>
                          {showBarcode && (
                            <div className="w-12 h-10 border-l border-black pl-2 shrink-0 flex flex-col justify-center items-center">
                              {/* Simple aesthetic vector barcode */}
                              <svg className="w-8 h-6" viewBox="0 0 30 15">
                                <rect x="0" width="1.5" height="15" fill="black" />
                                <rect x="3.5" width="3" height="15" fill="black" />
                                <rect x="8" width="1" height="15" fill="black" />
                                <rect x="11.5" width="2" height="15" fill="black" />
                                <rect x="15" width="1" height="15" fill="black" />
                                <rect x="18" width="3.5" height="15" fill="black" />
                                <rect x="23" width="1" height="15" fill="black" />
                                <rect x="26" width="2" height="15" fill="black" />
                              </svg>
                              <span className="text-[5.5px] text-black scale-[0.8] mt-0.5 font-bold">{activeCable?.id.substring(0,6).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Print Tips inside preview */}
                  <div className="text-[9px] bg-amber-50 border border-amber-100 p-2 text-amber-800 leading-normal rounded select-text text-left">
                    <strong>Etiket Yazdırma Tavsiyesi:</strong> Yazdırma ekranında kağıt boyutunu tam olarak <strong>{labelWidth}mm x {labelHeight}mm</strong> yapın ve sayfa kenar boşluklarını (Margins) <strong>"Yok" (None)</strong> olarak ayarlayın.
                  </div>

                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setIsLabelModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Kapat
              </button>
              
              <button
                onClick={() => {
                  document.body.classList.add('printing-cable-label');
                  window.print();
                  setTimeout(() => {
                    document.body.classList.remove('printing-cable-label');
                  }, 500);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer text-xs"
              >
                <Printer className="h-4 w-4" />
                Etiketi Yazdır
              </button>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN PRINT-ONLY TARGET CONTAINER FOR CABLE LABELS */}
      {activeCable && (
        <div 
          id="cable-label-print-box" 
          className="hidden"
          style={{
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            width: `${labelWidth}mm`,
            height: `${labelHeight}mm`,
            padding: '1mm',
            boxSizing: 'border-box',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            color: '#000000'
          }}
        >
          {labelStyle === 'flag' && (
            <div style={{ display: 'flex', width: '100%', height: '100%', fontSize: `${labelFontSize}px`, border: 'none', margin: 0, padding: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
              {/* Left Half */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px dashed #000000', textAlign: 'center', padding: '1px', boxSizing: 'border-box', overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', color: '#000000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>A: {activeSrcDev?.name}</div>
                <div style={{ color: '#000000', fontSize: '90%', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>PORT: {activeSrcPort?.name}</div>
                <div style={{ fontSize: '75%', color: '#000000', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', opacity: 0.8 }}>KATLA</div>
              </div>
              {/* Right Half */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1px', boxSizing: 'border-box', overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', color: '#000000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>B: {activeDstDev?.name}</div>
                <div style={{ color: '#000000', fontSize: '90%', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>PORT: {activeDstPort?.name}</div>
                <div style={{ fontWeight: 'bold', border: '1px solid #000000', padding: '1px 3px', borderRadius: '2px', backgroundColor: '#ffffff', marginTop: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>
                  {activeCable.label || 'CAB'}
                </div>
              </div>
            </div>
          )}

          {labelStyle === 'wrap' && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: '100%', height: '100%', fontSize: `${labelFontSize}px`, paddingLeft: '4px', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ fontWeight: 'bold', color: '#000000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>A: {activeSrcDev?.name} ({activeSrcPort?.name})</div>
              <div style={{ fontWeight: 'bold', color: '#000000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>B: {activeDstDev?.name} ({activeDstPort?.name})</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '80%', color: '#000000', paddingRight: '4px', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' }}>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 'bold' }}>LABEL: {activeCable.label || activeCable.id}</span>
                <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>{activeCable.length}m</span>
              </div>
            </div>
          )}

          {labelStyle === 'single' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%', fontSize: `${labelFontSize}px`, padding: '0 4px', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left', lineHeight: 1.2, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: '110%', color: '#000000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>{activeCable.label || 'CAB-01'}</div>
                <div style={{ color: '#000000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>A: {activeSrcDev?.name} ({activeSrcPort?.name})</div>
                <div style={{ color: '#000000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>B: {activeDstDev?.name} ({activeDstPort?.name})</div>
              </div>
              {showBarcode && (
                <div style={{ width: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #000000', paddingLeft: '4px', boxSizing: 'border-box', overflow: 'hidden' }}>
                  <svg style={{ width: '32px', height: '14px' }} viewBox="0 0 30 15">
                    <rect x="0" width="1.5" height="15" fill="black" />
                    <rect x="3.5" width="3" height="15" fill="black" />
                    <rect x="8" width="1" height="15" fill="black" />
                    <rect x="11.5" width="2" height="15" fill="black" />
                    <rect x="15" width="1" height="15" fill="black" />
                    <rect x="18" width="3.5" height="15" fill="black" />
                    <rect x="23" width="1" height="15" fill="black" />
                    <rect x="26" width="2" height="15" fill="black" />
                  </svg>
                  <span style={{ fontSize: '6px', color: '#000000', marginTop: '1px', fontWeight: 'bold' }}>{activeCable.id.substring(0,6).toUpperCase()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SVG Animation and Cable printing stylesheet */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }

        @media print {
          ${isLabelModalOpen ? `
            @page {
              size: ${labelWidth}mm ${labelHeight}mm !important;
              margin: 0 !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              width: ${labelWidth}mm !important;
              height: ${labelHeight}mm !important;
              overflow: hidden !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          ` : ''}

          body.printing-cable-label * {
            visibility: hidden !important;
            background: none !important;
          }
          body.printing-cable-label #cable-label-print-box,
          body.printing-cable-label #cable-label-print-box * {
            visibility: visible !important;
          }
          body.printing-cable-label #cable-label-print-box {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${labelWidth}mm !important;
            height: ${labelHeight}mm !important;
            padding: 1mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  );
}
