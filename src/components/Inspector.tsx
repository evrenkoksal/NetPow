/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Device, Cable, CableType, Port, PortType } from '../types';
import { Settings, Zap, Network, Shield, Cpu, AlertTriangle, CheckCircle, Info, Edit, FileText, ArrowRight, Plus, Trash2, Link, X, Check, Copy } from 'lucide-react';

interface InspectorProps {
  devices: Device[];
  cables: Cable[];
  selectedDeviceId: string | null;
  onUpdateDevice: (device: Device) => void;
  onRemoveDevice: (deviceId: string) => void;
  onRemoveCable: (cableId: string) => void;
  onSelectDevice: (deviceId: string | null) => void;
  onAddCable?: (
    cableData: Omit<Cable, 'id'>,
    newPortsToCreate?: { deviceId: string; name: string; type: PortType }[]
  ) => void;
  onCloneDevice?: (deviceId: string) => void;
}

export function Inspector({
  devices,
  cables,
  selectedDeviceId,
  onUpdateDevice,
  onRemoveDevice,
  onRemoveCable,
  onSelectDevice,
  onAddCable,
  onCloneDevice,
}: InspectorProps) {
  const device = devices.find((d) => d.id === selectedDeviceId);

  // Edit fields state
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [vlan, setVlan] = useState('');
  const [notes, setNotes] = useState('');
  const [powerDraw, setPowerDraw] = useState(0);
  const [weight, setWeight] = useState(0);
  const [uSize, setUSize] = useState(1);

  // Port addition state
  const [isAddingPort, setIsAddingPort] = useState(false);
  const [newPortName, setNewPortName] = useState('');
  const [newPortType, setNewPortType] = useState<PortType>('ethernet');

  // Port bulk addition & edit states
  const [isBulkAdd, setIsBulkAdd] = useState(false);
  const [bulkStartName, setBulkStartName] = useState('ETH0');
  const [bulkCount, setBulkCount] = useState(16);

  const [editingPortId, setEditingPortId] = useState<string | null>(null);
  const [editingPortName, setEditingPortName] = useState('');
  const [editingPortType, setEditingPortType] = useState<PortType>('ethernet');

  // Cable connection state
  const [connectingPortId, setConnectingPortId] = useState<string | null>(null);
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [targetPortId, setTargetPortId] = useState('');
  const [newCableType, setNewCableType] = useState<CableType>('cat6');
  const [newCableLength, setNewCableLength] = useState(2);
  const [newCableColor, setNewCableColor] = useState('#2563eb');
  const [newCableLabel, setNewCableLabel] = useState('');

  // Global cable addition states
  const [isAddingGlobalCable, setIsAddingGlobalCable] = useState(false);
  const [globalSrcDeviceId, setGlobalSrcDeviceId] = useState('');
  const [globalSrcPortId, setGlobalSrcPortId] = useState(''); 
  const [globalSrcNewPortName, setGlobalSrcNewPortName] = useState('');
  const [globalSrcNewPortType, setGlobalSrcNewPortType] = useState<PortType>('ethernet');

  const [globalDstDeviceId, setGlobalDstDeviceId] = useState('');
  const [globalDstPortId, setGlobalDstPortId] = useState(''); 
  const [globalDstNewPortName, setGlobalDstNewPortName] = useState('');
  const [globalDstNewPortType, setGlobalDstNewPortType] = useState<PortType>('ethernet');

  const [globalCableType, setGlobalCableType] = useState<CableType>('cat6');
  const [globalCableColor, setGlobalCableColor] = useState('#3b82f6');
  const [globalCableLength, setGlobalCableLength] = useState(2);
  const [globalCableLabel, setGlobalCableLabel] = useState('');

  // Synchronize state when selected device changes
  useEffect(() => {
    if (device) {
      setName(device.name);
      setModel(device.model);
      setIpAddress(device.ipAddress || '');
      setVlan(device.vlan || '');
      setNotes(device.notes || '');
      setPowerDraw(device.powerDraw);
      setWeight(device.weight);
      setUSize(device.uSize);
      
      // Reset forms
      setIsAddingPort(false);
      setNewPortName('');
      setConnectingPortId(null);
      setIsBulkAdd(false);
      setEditingPortId(null);
    }
  }, [selectedDeviceId, device?.id]);

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;

    const newUSize = Number(uSize) || 1;

    // Overlap validation if the device is currently mounted
    if (device.uPosition !== null) {
      const occupiedByOthers = new Set<number>();
      devices.forEach((d) => {
        if (d.id !== device.id && d.uPosition !== null) {
          for (let i = 0; i < d.uSize; i++) {
            occupiedByOthers.add(d.uPosition + i);
          }
        }
      });

      let hasOverlap = false;
      for (let i = 0; i < newUSize; i++) {
        const checkPos = device.uPosition + i;
        if (occupiedByOthers.has(checkPos) || checkPos > 42) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        alert("Hata: Belirttiğiniz yeni cihaz yüksekliği (U), kabinde diğer yüklü cihazlarla çakışıyor veya kabin sınırlarını (42U) aşıyor! Lütfen önce cihazı raftan sökün veya uygun boş bir alana taşıyın.");
        return;
      }
    }

    onUpdateDevice({
      ...device,
      name,
      model,
      ipAddress,
      vlan,
      notes,
      powerDraw: Number(powerDraw) || 0,
      weight: Number(weight) || 0,
      uSize: newUSize,
    });
  };

  const handleAddPort = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device || !newPortName.trim()) return;

    // Check duplicate port name
    const nameExists = device.ports.some(p => p.name.toLowerCase() === newPortName.trim().toLowerCase());
    if (nameExists) {
      alert("Bu isimde bir port zaten mevcut!");
      return;
    }

    const newPort: Port = {
      id: `port-${device.id}-${Math.random().toString(36).substring(2, 7)}`,
      name: newPortName.trim(),
      type: newPortType,
      connectedToCableId: null,
    };

    onUpdateDevice({
      ...device,
      ports: [...device.ports, newPort],
    });

    setNewPortName('');
    setIsAddingPort(false);
  };

  // Helper to parse and increment port names for bulk addition (e.g. ETH0 -> ETH0, ETH1... SFP01 -> SFP01, SFP02...)
  const generateBulkPortNames = (startName: string, count: number): string[] => {
    const regex = /(\d+)$/;
    const match = startName.match(regex);
    
    if (!match) {
      // If no trailing number, append numbers starting from 1
      return Array.from({ length: count }, (_, i) => `${startName}${i + 1}`);
    }
    
    const numStr = match[1];
    const startNum = parseInt(numStr, 10);
    const prefix = startName.substring(0, startName.length - numStr.length);
    const padLength = numStr.startsWith('0') && numStr.length > 1 ? numStr.length : 0;
    
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const currentNum = startNum + i;
      const paddedNum = padLength > 0 ? String(currentNum).padStart(padLength, '0') : String(currentNum);
      names.push(`${prefix}${paddedNum}`);
    }
    return names;
  };

  const handleBulkAddPorts = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device || !bulkStartName.trim() || bulkCount <= 0) return;

    const count = Math.min(128, Math.max(1, Number(bulkCount) || 1));
    const generatedNames = generateBulkPortNames(bulkStartName.trim(), count);

    // Filter out names that already exist to avoid duplicate errors, or warn user
    const existingNames = new Set(device.ports.map(p => p.name.toLowerCase()));
    const duplicates = generatedNames.filter(name => existingNames.has(name.toLowerCase()));

    if (duplicates.length > 0) {
      if (!confirm(`Oluşturulacak portlardan bazıları (${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}) zaten mevcut. Bunlar atlanarak diğerleri eklensin mi?`)) {
        return;
      }
    }

    const uniqueGeneratedNames = generatedNames.filter(name => !existingNames.has(name.toLowerCase()));

    if (uniqueGeneratedNames.length === 0) {
      alert("Eklenebilecek yeni benzersiz port üretilemedi!");
      return;
    }

    const newPorts: Port[] = uniqueGeneratedNames.map(name => ({
      id: `port-${device.id}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      type: newPortType,
      connectedToCableId: null,
    }));

    onUpdateDevice({
      ...device,
      ports: [...device.ports, ...newPorts],
    });

    setIsAddingPort(false);
  };

  const handleSavePortEdit = (portId: string) => {
    if (!device || !editingPortName.trim()) return;

    const trimmedName = editingPortName.trim();

    // Check duplicate name on other ports
    const nameExists = device.ports.some(
      p => p.id !== portId && p.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameExists) {
      alert("Bu isimde başka bir port zaten mevcut!");
      return;
    }

    const updatedPorts = device.ports.map((p) => {
      if (p.id === portId) {
        return { ...p, name: trimmedName, type: editingPortType };
      }
      return p;
    });

    onUpdateDevice({
      ...device,
      ports: updatedPorts,
    });

    setEditingPortId(null);
  };

  const handleRemovePort = (portId: string) => {
    if (!device) return;
    
    // Confirm first
    if (!confirm("Portu silmek istediğinize emin misiniz? (Bağlı kablolar da silinecektir)")) return;

    // First, disconnect any cable attached
    const attachedCable = getCableConnectedToPort(portId);
    if (attachedCable) {
      onRemoveCable(attachedCable.id);
    }

    onUpdateDevice({
      ...device,
      ports: device.ports.filter(p => p.id !== portId),
    });
  };

  const handleConnectPortSubmit = (e: React.FormEvent, portId: string) => {
    e.preventDefault();
    if (!device || !onAddCable || !targetDeviceId || !targetPortId) return;

    onAddCable({
      fromDeviceId: device.id,
      fromPortId: portId,
      toDeviceId: targetDeviceId,
      toPortId: targetPortId,
      type: newCableType,
      color: newCableColor,
      length: Number(newCableLength) || 2,
      label: newCableLabel.trim() || undefined,
    });

    // Reset connecting state
    setConnectingPortId(null);
    setTargetDeviceId('');
    setTargetPortId('');
    setNewCableLabel('');
  };

  const handleAddGlobalCableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddCable || !globalSrcDeviceId || !globalDstDeviceId) return;

    const srcDev = devices.find(d => d.id === globalSrcDeviceId);
    const dstDev = devices.find(d => d.id === globalDstDeviceId);

    if (!srcDev || !dstDev) return;

    const newPortsToCreate: { deviceId: string; name: string; type: PortType }[] = [];

    let finalSrcPortId = globalSrcPortId;
    let finalDstPortId = globalDstPortId;

    if (globalSrcPortId === 'new') {
      if (!globalSrcNewPortName.trim()) {
        alert('Lütfen kaynak cihaz için yeni port adını girin.');
        return;
      }
      const nameExists = srcDev.ports.some(p => p.name.toLowerCase() === globalSrcNewPortName.trim().toLowerCase());
      if (nameExists) {
        alert(`Kaynak cihazda "${globalSrcNewPortName.trim()}" isminde bir port zaten mevcut!`);
        return;
      }
      finalSrcPortId = `new-port-${globalSrcDeviceId}`;
      newPortsToCreate.push({
        deviceId: globalSrcDeviceId,
        name: globalSrcNewPortName.trim(),
        type: globalSrcNewPortType
      });
    }

    if (globalDstPortId === 'new') {
      if (!globalDstNewPortName.trim()) {
        alert('Lütfen hedef cihaz için yeni port adını girin.');
        return;
      }
      const nameExists = dstDev.ports.some(p => p.name.toLowerCase() === globalDstNewPortName.trim().toLowerCase());
      if (nameExists) {
        alert(`Hedef cihazda "${globalDstNewPortName.trim()}" isminde bir port zaten mevcut!`);
        return;
      }
      finalDstPortId = `new-port-${globalDstDeviceId}`;
      newPortsToCreate.push({
        deviceId: globalDstDeviceId,
        name: globalDstNewPortName.trim(),
        type: globalDstNewPortType
      });
    }

    if (!finalSrcPortId || !finalDstPortId) {
      alert('Lütfen bağlantı kurulacak portları seçin veya oluşturun.');
      return;
    }

    onAddCable({
      fromDeviceId: globalSrcDeviceId,
      fromPortId: finalSrcPortId,
      toDeviceId: globalDstDeviceId,
      toPortId: finalDstPortId,
      type: globalCableType,
      color: globalCableColor,
      length: Number(globalCableLength) || 2,
      label: globalCableLabel.trim() || `${srcDev.name} ➔ ${dstDev.name}`,
    }, newPortsToCreate);

    // Reset fields
    setIsAddingGlobalCable(false);
    setGlobalSrcDeviceId('');
    setGlobalSrcPortId('');
    setGlobalSrcNewPortName('');
    setGlobalDstDeviceId('');
    setGlobalDstPortId('');
    setGlobalDstNewPortName('');
    setGlobalCableLabel('');
  };

  const getCableConnectedToPort = (portId: string) => {
    return cables.find((c) => c.fromPortId === portId || c.toPortId === portId);
  };

  const getOppositePortDetails = (cable: Cable, currentPortId: string) => {
    const isFrom = cable.fromPortId === currentPortId;
    const oppDevId = isFrom ? cable.toDeviceId : cable.fromDeviceId;
    const oppPortId = isFrom ? cable.toPortId : cable.fromPortId;

    const oppDev = devices.find((d) => d.id === oppDevId);
    const oppPort = oppDev?.ports.find((p) => p.id === oppPortId);

    return {
      deviceName: oppDev?.name || 'Bilinmeyen Cihaz',
      portName: oppPort?.name || 'Bilinmeyen Port',
      deviceId: oppDevId,
    };
  };

  // Stats for empty selection
  const totalPower = devices.reduce((sum, d) => sum + d.powerDraw, 0);
  const totalWeight = devices.reduce((sum, d) => sum + d.weight, 0);
  const totalCables = cables.length;
  const netCablesCount = cables.filter(c => !c.type.startsWith('power')).length;
  const pwrCablesCount = cables.filter(c => c.type.startsWith('power')).length;

  // Real-time analysis for warnings
  const warnings: { type: 'danger' | 'warning' | 'info'; text: string; deviceId?: string }[] = [];

  // 1. Redundant Power Supplies warnings
  devices.forEach((d) => {
    if (d.subtype === 'server' || d.subtype === 'storage' || d.subtype === 'switch') {
      const powerInPorts = d.ports.filter((p) => p.type === 'power_in');
      if (powerInPorts.length > 1) {
        // Redundant power design
        const connectedPowerIn = powerInPorts.filter((p) => {
          const cable = getCableConnectedToPort(p.id);
          return !!cable;
        });

        if (connectedPowerIn.length === 0) {
          warnings.push({
            type: 'danger',
            text: `"${d.name}" cihazının hiçbir güç besleme bağlantısı yapılmamış!`,
            deviceId: d.id,
          });
        } else if (connectedPowerIn.length < powerInPorts.length) {
          warnings.push({
            type: 'warning',
            text: `"${d.name}" yedekli güç kaynağına sahip ancak sadece tek güç girişi besleniyor (Yedeksiz Çalışma Riski).`,
            deviceId: d.id,
          });
        } else {
          // Check if connected to the same PDU or separate PDUs
          const pduSourceIds = connectedPowerIn.map((p) => {
            const cable = getCableConnectedToPort(p.id);
            if (!cable) return null;
            return cable.fromDeviceId === d.id ? cable.toDeviceId : cable.fromDeviceId;
          }).filter(Boolean);

          const uniquePduSources = Array.from(new Set(pduSourceIds));
          if (uniquePduSources.length === 1 && pduSourceIds.length > 1) {
            warnings.push({
              type: 'info',
              text: `"${d.name}" yedek güç kabloları aynı PDU'ya bağlı! Farklı PDU veya UPS hatlarına bağlayarak yedekliliği artırın.`,
              deviceId: d.id,
            });
          }
        }
      } else if (powerInPorts.length === 1) {
        // Single power supply
        const cable = getCableConnectedToPort(powerInPorts[0].id);
        if (!cable) {
          warnings.push({
            type: 'danger',
            text: `"${d.name}" cihazının güç kablosu bağlı değil!`,
            deviceId: d.id,
          });
        }
      }
    }
  });

  // 2. Overloaded PDU check
  devices.forEach((d) => {
    if (d.subtype === 'pdu' || d.subtype === 'ups') {
      const powerOutPorts = d.ports.filter((p) => p.type === 'power_out');
      // Calculate total load of devices connected to these power out ports
      let pduActiveLoad = 0;
      powerOutPorts.forEach((p) => {
        const cable = getCableConnectedToPort(p.id);
        if (cable) {
          const opp = getOppositePortDetails(cable, p.id);
          const oppDevObj = devices.find((dev) => dev.id === opp.deviceId);
          if (oppDevObj) {
            pduActiveLoad += oppDevObj.powerDraw;
          }
        }
      });

      const maxLimit = d.powerLimit || 3680;
      if (pduActiveLoad > maxLimit) {
        warnings.push({
          type: 'danger',
          text: `"${d.name}" (${d.model}) maksimum kapasiteyi AŞTI! Aktif Yük: ${pduActiveLoad}W, Limit: ${maxLimit}W.`,
          deviceId: d.id,
        });
      } else if (pduActiveLoad > maxLimit * 0.8) {
        warnings.push({
          type: 'warning',
          text: `"${d.name}" yüksek yük altında (%${Math.round((pduActiveLoad / maxLimit) * 100)}). Boşta kalan kapasite kritik seviyede.`,
          deviceId: d.id,
        });
      }
    }
  });

  return (
    <div id="inspector-panel" className="w-full lg:w-80 h-full bg-white border-l border-slate-200 flex flex-col">
      {/* Tab Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Settings className="h-4.5 w-4.5 text-slate-400" />
          ÖZELLİK DENETLEYİCİSİ
        </h2>
        {device && (
          <button
            onClick={() => onSelectDevice(null)}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded uppercase tracking-wider transition-all cursor-pointer"
          >
            Genel Rapor
          </button>
        )}
      </div>

      {device ? (
        /* DEVICE DETAILED INSPECTOR & EDITOR */
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Device Core Details Card */}
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 relative overflow-hidden text-left">
            <span className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full -mr-8 -mt-8 -z-10" />
            
            <h3 className="font-bold text-slate-800 text-xs leading-snug mb-0.5">{device.name}</h3>
            <p className="text-[10px] text-slate-400 font-mono mb-2">{device.model}</p>
            
            <div className="flex gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold">
                {device.uSize} U Yüksekliği
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold">
                {device.uPosition ? `Kabin Slot: U${device.uPosition}` : 'Kabine Monte Değil'}
              </span>
            </div>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSaveChanges} className="space-y-4 border-t border-slate-100 pt-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">CİHAZ AYARLARI</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">CİHAZ ADI / ETİKETİ:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">MARKA / MODEL:</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="örn: Dell R740"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">IP ADRESİ:</label>
                <input
                  type="text"
                  placeholder="örn: 192.168.10.5"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">VLAN / ALT AĞ:</label>
                <input
                  type="text"
                  placeholder="örn: VLAN 100"
                  value={vlan}
                  onChange={(e) => setVlan(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">GÜÇ (WATT):</label>
                <input
                  type="number"
                  min="0"
                  value={powerDraw}
                  onChange={(e) => setPowerDraw(Number(e.target.value) || 0)}
                  className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">AĞIRLIK (KG):</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value) || 0)}
                  className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">YÜKSEKLİK (U):</label>
                <select
                  value={uSize}
                  onChange={(e) => setUSize(Number(e.target.value))}
                  className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(u => (
                    <option key={u} value={u}>{u}U</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 text-left">CİHAZ NOTLARI:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notlar ekleyin..."
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-left"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
              >
                Kaydet
              </button>
              {onCloneDevice && (
                <button
                  type="button"
                  onClick={() => onCloneDevice(device.id)}
                  className="py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5"
                  title="Cihazı aynı özelliklerle kopyalayıp altına yerleştirir"
                >
                  <Copy className="h-3.5 w-3.5" /> Klonla
                </button>
              )}
            </div>
          </form>

          {/* Port & Cable Mapping List (Visualizing specific cabling details) */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex flex-col items-start text-left">
                <span>PORT VE KABLO HARİTASI</span>
                <span className="text-[9px] text-slate-500 font-mono font-normal mt-0.5">
                  {device.ports.filter(p => getCableConnectedToPort(p.id)).length} / {device.ports.length} Port Bağlı
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingPort(!isAddingPort)}
                className="flex items-center gap-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-2 py-1 rounded transition-colors cursor-pointer border border-blue-100/50"
              >
                {isAddingPort ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {isAddingPort ? 'Kapat' : 'Port Ekle'}
              </button>
            </div>

            {/* Inline Add Port Form */}
            {isAddingPort && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-left">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 mb-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkAdd(false)}
                    className={`flex-1 text-center py-1 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                      !isBulkAdd
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Tekli Port
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBulkAdd(true)}
                    className={`flex-1 text-center py-1 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                      isBulkAdd
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Toplu Port
                  </button>
                </div>

                {!isBulkAdd ? (
                  /* SINGLE ADD */
                  <form onSubmit={handleAddPort} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-slate-400 font-bold mb-1">PORT ADI:</label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="Örn: ETH5, SFP2"
                          value={newPortName}
                          onChange={(e) => setNewPortName(e.target.value)}
                          className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 font-bold mb-1">PORT TİPİ:</label>
                        <select
                          value={newPortType}
                          onChange={(e) => setNewPortType(e.target.value as PortType)}
                          className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 font-medium text-slate-700"
                        >
                          <option value="ethernet">RJ45 Ethernet</option>
                          <option value="fiber">Fiber SFP</option>
                          <option value="power_in">Güç Girişi</option>
                          <option value="power_out">Güç Çıkışı</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingPort(false)}
                        className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> Ekle
                      </button>
                    </div>
                  </form>
                ) : (
                  /* BULK ADD */
                  <form onSubmit={handleBulkAddPorts} className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="col-span-2">
                        <label className="block text-[9px] text-slate-400 font-bold mb-1">BAŞLANGIÇ ADI:</label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="Örn: ETH0, SFP01"
                          value={bulkStartName}
                          onChange={(e) => setBulkStartName(e.target.value)}
                          className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 font-bold mb-1">PORT ADET:</label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="128"
                          value={bulkCount}
                          onChange={(e) => setBulkCount(Number(e.target.value) || 16)}
                          className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1">PORT TİPİ:</label>
                      <select
                        value={newPortType}
                        onChange={(e) => setNewPortType(e.target.value as PortType)}
                        className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 font-medium text-slate-700"
                      >
                        <option value="ethernet">RJ45 Ethernet</option>
                        <option value="fiber">Fiber SFP</option>
                        <option value="power_in">Güç Girişi</option>
                        <option value="power_out">Güç Çıkışı</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingPort(false)}
                        className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> Toplu Ekle
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {device.ports.map((port) => {
                const cable = getCableConnectedToPort(port.id);
                const isConnected = !!cable;

                if (editingPortId === port.id) {
                  return (
                    <div
                      key={port.id}
                      className="p-2.5 border border-blue-200 rounded-lg bg-blue-50/50 flex flex-col gap-2 text-[11px]"
                    >
                      <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider text-left">PORTU DÜZENLE</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] text-slate-500 font-bold mb-0.5 text-left">PORT ADI:</label>
                          <input
                            type="text"
                            required
                            autoFocus
                            className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 font-medium"
                            value={editingPortName}
                            onChange={(e) => setEditingPortName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-slate-500 font-bold mb-0.5 text-left">PORT TİPİ:</label>
                          <select
                            className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 font-medium text-slate-700"
                            value={editingPortType}
                            onChange={(e) => setEditingPortType(e.target.value as PortType)}
                          >
                            <option value="ethernet">RJ45 Ethernet</option>
                            <option value="fiber">Fiber SFP</option>
                            <option value="power_in">Güç Girişi</option>
                            <option value="power_out">Güç Çıkışı</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingPortId(null)}
                          className="px-2 py-0.5 text-[9px] font-bold text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          İptal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePortEdit(port.id)}
                          className="px-2.5 py-0.5 text-[9px] font-bold text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Check className="h-2.5 w-2.5" /> Kaydet
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={port.id}
                    className="p-2 border border-slate-200/80 rounded-lg bg-slate-50 flex flex-col gap-1 text-[11px]"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-sm ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {port.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-400 font-mono uppercase font-bold bg-white px-1.5 py-0.5 border border-slate-200/60 rounded">
                          {port.type === 'ethernet' ? 'RJ45' : port.type === 'fiber' ? 'Fiber' : port.type === 'power_in' ? 'Giriş' : 'Çıkış'}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPortId(port.id);
                            setEditingPortName(port.name);
                            setEditingPortType(port.type);
                          }}
                          className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                          title="Portu Düzenle"
                        >
                          <Edit className="h-3 w-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemovePort(port.id)}
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer"
                          title="Portu Sil"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {cable ? (
                      (() => {
                        const opp = getOppositePortDetails(cable, port.id);
                        return (
                          <div className="flex items-center justify-between text-[10px] bg-white border border-slate-200/60 p-1.5 rounded-md mt-1">
                            <div className="text-slate-600 truncate max-w-[150px] text-left">
                              <ArrowRight className="inline h-3 w-3 text-blue-500 mr-1" />
                              <span 
                                onClick={() => onSelectDevice(opp.deviceId)}
                                className="font-bold hover:underline text-blue-600 cursor-pointer"
                              >
                                {opp.deviceName}
                              </span>{' '}
                              <span className="text-slate-400">({opp.portName})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemoveCable(cable.id)}
                              className="text-red-500 hover:text-red-700 font-bold text-[9px] uppercase tracking-wider cursor-pointer pl-2 shrink-0"
                              title="Kabloyu Sök"
                            >
                              SÖK
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex flex-col mt-1 pt-1 border-t border-dashed border-slate-200/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 italic">Bağlantı yok</span>
                          {connectingPortId !== port.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setConnectingPortId(port.id);
                                setTargetDeviceId('');
                                setTargetPortId('');
                                if (port.type === 'ethernet') {
                                  setNewCableType('cat6');
                                } else if (port.type === 'fiber') {
                                  setNewCableType('fiber');
                                } else {
                                  setNewCableType('power_c13');
                                }
                              }}
                              className="flex items-center gap-1 text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer border border-blue-100"
                            >
                              <Link className="h-2.5 w-2.5" /> Bağla
                            </button>
                          )}
                        </div>

                        {connectingPortId === port.id && (
                          <form 
                            onSubmit={(e) => handleConnectPortSubmit(e, port.id)} 
                            className="mt-2 p-2 bg-white border border-blue-100 rounded-md space-y-2 text-left"
                          >
                            <div className="text-[9px] font-bold text-blue-700 uppercase tracking-wider flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Link className="h-2.5 w-2.5" /> BAĞLANTI AYARLARI
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setConnectingPortId(null)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            
                            <div>
                              <label className="block text-[8px] text-slate-400 font-bold mb-0.5">HEDEF CİHAZ:</label>
                              <select
                                required
                                value={targetDeviceId}
                                onChange={(e) => {
                                  setTargetDeviceId(e.target.value);
                                  setTargetPortId('');
                                }}
                                className="w-full text-[10px] px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                              >
                                <option value="">-- Cihaz Seçin --</option>
                                {devices
                                  .filter(d => d.id !== device.id)
                                  .map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.model})</option>
                                  ))
                                }
                              </select>
                            </div>

                            {targetDeviceId && (
                              <div>
                                <label className="block text-[8px] text-slate-400 font-bold mb-0.5">HEDEF BOŞ PORT:</label>
                                <select
                                  required
                                  value={targetPortId}
                                  onChange={(e) => setTargetPortId(e.target.value)}
                                  className="w-full text-[10px] px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                                >
                                  <option value="">-- Port Seçin --</option>
                                  {devices
                                    .find(d => d.id === targetDeviceId)
                                    ?.ports.filter(p => {
                                      const hasCable = getCableConnectedToPort(p.id);
                                      if (hasCable) return false;
                                      if (port.type === 'ethernet' && p.type === 'ethernet') return true;
                                      if (port.type === 'fiber' && p.type === 'fiber') return true;
                                      if (port.type === 'power_in' && p.type === 'power_out') return true;
                                      if (port.type === 'power_out' && p.type === 'power_in') return true;
                                      return false;
                                    })
                                    .map(p => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.type === 'ethernet' ? 'RJ45' : p.type === 'fiber' ? 'Fiber' : 'Güç'})</option>
                                    ))
                                  }
                                </select>
                              </div>
                            )}

                            {targetPortId && (
                              <>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold mb-0.5">KABLO TİPİ:</label>
                                    <select
                                      value={newCableType}
                                      onChange={(e) => setNewCableType(e.target.value as CableType)}
                                      className="w-full text-[9px] px-1 py-0.5 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                                    >
                                      {port.type === 'ethernet' && (
                                        <>
                                          <option value="cat6">Cat6 Ethernet</option>
                                          <option value="cat6a">Cat6a Ethernet</option>
                                        </>
                                      )}
                                      {port.type === 'fiber' && (
                                        <option value="fiber">Fiber Optik</option>
                                      )}
                                      {(port.type === 'power_in' || port.type === 'power_out') && (
                                        <>
                                          <option value="power_c13">C13 Güç</option>
                                          <option value="power_c19">C19 Güç</option>
                                        </>
                                      )}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold mb-0.5">KABLO BOYU (M):</label>
                                    <input
                                      type="number"
                                      min="0.5"
                                      max="100"
                                      step="0.5"
                                      value={newCableLength}
                                      onChange={(e) => setNewCableLength(Number(e.target.value) || 2)}
                                      className="w-full text-[9px] px-1 py-0.5 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold mb-0.5">KABLO RENGİ:</label>
                                    <select
                                      value={newCableColor}
                                      onChange={(e) => setNewCableColor(e.target.value)}
                                      className="w-full text-[9px] px-1 py-0.5 bg-slate-50 border border-slate-200 rounded focus:outline-none font-medium"
                                    >
                                      <option value="#2563eb" style={{color: '#2563eb'}}>Mavi</option>
                                      <option value="#dc2626" style={{color: '#dc2626'}}>Kırmızı</option>
                                      <option value="#eab308" style={{color: '#eab308'}}>Sarı</option>
                                      <option value="#16a34a" style={{color: '#16a34a'}}>Yeşil</option>
                                      <option value="#475569" style={{color: '#475569'}}>Gri</option>
                                      <option value="#090d16" style={{color: '#090d16'}}>Siyah</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold mb-0.5">ETİKET:</label>
                                    <input
                                      type="text"
                                      placeholder="KABLO-01"
                                      value={newCableLabel}
                                      onChange={(e) => setNewCableLabel(e.target.value)}
                                      className="w-full text-[9px] px-1 py-0.5 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            <div className="flex justify-end gap-1 pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setConnectingPortId(null)}
                                className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500 bg-slate-50 rounded"
                              >
                                İptal
                              </button>
                              <button
                                type="submit"
                                disabled={!targetPortId}
                                className={`px-2 py-0.5 text-[9px] font-bold text-white rounded flex items-center gap-0.5 ${
                                  targetPortId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'
                                }`}
                              >
                                <Check className="h-2.5 w-2.5" /> Bağla
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* GLOBAL SYSTEM SUMMARY REPORT */
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          
          {/* Quick Dashboard Overview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-widest text-slate-400 text-left">SİSTEM GENEL DURUMU</h3>
            
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-2.5 bg-white border border-slate-200/60 rounded-lg shadow-sm">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">CİHAZ SAYISI</span>
                <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{devices.length} Adet</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200/60 rounded-lg shadow-sm">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">TOPLAM GÜÇ</span>
                <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{totalPower} W</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200/60 rounded-lg shadow-sm">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">TOPLAM KABLO</span>
                <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{totalCables} Adet</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200/60 rounded-lg shadow-sm flex flex-col justify-center items-center">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">AĞ / GÜÇ DAĞ.</span>
                <span className="text-[10px] font-bold text-slate-600 font-mono mt-1 block">
                  {netCablesCount} Ağ • {pwrCablesCount} Güç
                </span>
              </div>
            </div>
          </div>

          {/* Active alerts & Network/Power redundancy checks */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 text-left">
              <Shield className="h-4 w-4 text-slate-400" />
              SİBER / FİZİKSEL RISK ANALİZİ
            </h4>

            {warnings.length === 0 ? (
              <div className="p-3 border border-emerald-100 bg-emerald-50 rounded-xl text-xs text-emerald-800 flex gap-2.5 items-start">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Kusursuz Tasarım!</h5>
                  <p className="mt-1 text-emerald-700 leading-normal">Güç yedekliliği ve cihaz konumlandırma kurallarına tam uyum tespit edildi.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {warnings.map((warn, index) => {
                  const isDanger = warn.type === 'danger';
                  const isWarning = warn.type === 'warning';
                  const cardBg = isDanger ? 'bg-red-50 border-red-200 text-red-800' : isWarning ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800';
                  const iconColor = isDanger ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600';

                  return (
                    <div
                      key={index}
                      onClick={() => warn.deviceId && onSelectDevice(warn.deviceId)}
                      className={`p-2.5 border rounded-lg text-[11px] flex gap-2 items-start cursor-pointer transition-transform hover:-translate-y-0.5 ${cardBg}`}
                    >
                      <AlertTriangle className={`h-4 w-4 ${iconColor} mt-0.5 shrink-0`} />
                      <div className="flex-1 text-left">
                        <p className="leading-tight font-medium">{warn.text}</p>
                        {warn.deviceId && (
                          <span className="text-[9px] uppercase tracking-wider font-bold underline mt-1.5 block opacity-80">
                            CİHAZI İNCELE ➔
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detailed Cabling Summary & Cable Schedule List */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 text-left">
                <FileText className="h-4 w-4 text-slate-400" />
                KABLO METRAJI VE ÇİZELGESİ
              </h4>
              {devices.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setIsAddingGlobalCable(!isAddingGlobalCable)}
                  className="flex items-center gap-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-2 py-1 rounded transition-colors cursor-pointer border border-blue-100/50"
                >
                  {isAddingGlobalCable ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {isAddingGlobalCable ? 'Kapat' : 'Kablo Ekle'}
                </button>
              )}
            </div>

            {/* Global Cable Addition Form */}
            {isAddingGlobalCable && devices.length >= 2 && (
              <form onSubmit={handleAddGlobalCableSubmit} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-left">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b pb-1 flex items-center gap-1.5">
                  <Link className="h-3.5 w-3.5 text-blue-500" />
                  YENİ BAĞLANTI EKLE
                </div>

                {/* Source Device */}
                <div>
                  <label className="block text-[9px] text-slate-400 font-bold mb-1">A UCU (KAYNAK CİHAZ):</label>
                  <select
                    required
                    value={globalSrcDeviceId}
                    onChange={(e) => {
                      setGlobalSrcDeviceId(e.target.value);
                      setGlobalSrcPortId('');
                    }}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="">-- Cihaz Seçin --</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.model})</option>
                    ))}
                  </select>
                </div>

                {/* Source Port Selection */}
                {globalSrcDeviceId && (
                  <div className="p-2 bg-white rounded-lg border border-slate-150 space-y-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1">PORT SEÇİN VEYA OLUŞTURUN:</label>
                      <select
                        required
                        value={globalSrcPortId}
                        onChange={(e) => setGlobalSrcPortId(e.target.value)}
                        className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                      >
                        <option value="">-- Seçin --</option>
                        {devices.find(d => d.id === globalSrcDeviceId)?.ports.map(p => {
                          const hasCable = getCableConnectedToPort(p.id);
                          return (
                            <option key={p.id} value={p.id} disabled={!!hasCable}>
                              {p.name} ({p.type === 'ethernet' ? 'RJ45' : p.type === 'fiber' ? 'Fiber' : p.type === 'power_in' ? 'Güç Giriş' : 'Güç Çıkış'}) {hasCable ? '• [BAĞLI]' : ''}
                            </option>
                          );
                        })}
                        <option value="new">+ YENİ PORT OLUŞTUR...</option>
                      </select>
                    </div>

                    {/* New Source Port Details */}
                    {globalSrcPortId === 'new' && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <div>
                          <label className="block text-[8px] text-slate-400 font-bold mb-0.5">YENİ PORT ADI:</label>
                          <input
                            type="text"
                            required
                            placeholder="örn: ETH1"
                            value={globalSrcNewPortName}
                            onChange={(e) => setGlobalSrcNewPortName(e.target.value)}
                            className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-slate-400 font-bold mb-0.5">PORT TİPİ:</label>
                          <select
                            value={globalSrcNewPortType}
                            onChange={(e) => setGlobalSrcNewPortType(e.target.value as PortType)}
                            className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                          >
                            <option value="ethernet">RJ45 Ethernet</option>
                            <option value="fiber">Fiber SFP</option>
                            <option value="power_in">Güç Girişi</option>
                            <option value="power_out">Güç Çıkışı</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Target Device */}
                <div>
                  <label className="block text-[9px] text-slate-400 font-bold mb-1">B UCU (HEDEF CİHAZ):</label>
                  <select
                    required
                    value={globalDstDeviceId}
                    onChange={(e) => {
                      setGlobalDstDeviceId(e.target.value);
                      setGlobalDstPortId('');
                    }}
                    disabled={!globalSrcDeviceId}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none disabled:bg-slate-100 disabled:opacity-65"
                  >
                    <option value="">-- Cihaz Seçin --</option>
                    {devices
                      .filter(d => d.id !== globalSrcDeviceId)
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.model})</option>
                      ))
                    }
                  </select>
                </div>

                {/* Target Port Selection */}
                {globalDstDeviceId && (
                  <div className="p-2 bg-white rounded-lg border border-slate-150 space-y-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1">PORT SEÇİN VEYA OLUŞTURUN:</label>
                      <select
                        required
                        value={globalDstPortId}
                        onChange={(e) => setGlobalDstPortId(e.target.value)}
                        className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                      >
                        <option value="">-- Seçin --</option>
                        {devices.find(d => d.id === globalDstDeviceId)?.ports.map(p => {
                          const hasCable = getCableConnectedToPort(p.id);
                          return (
                            <option key={p.id} value={p.id} disabled={!!hasCable}>
                              {p.name} ({p.type === 'ethernet' ? 'RJ45' : p.type === 'fiber' ? 'Fiber' : p.type === 'power_in' ? 'Güç Giriş' : 'Güç Çıkış'}) {hasCable ? '• [BAĞLI]' : ''}
                            </option>
                          );
                        })}
                        <option value="new">+ YENİ PORT OLUŞTUR...</option>
                      </select>
                    </div>

                    {/* New Target Port Details */}
                    {globalDstPortId === 'new' && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <div>
                          <label className="block text-[8px] text-slate-400 font-bold mb-0.5">YENİ PORT ADI:</label>
                          <input
                            type="text"
                            required
                            placeholder="örn: ETH2"
                            value={globalDstNewPortName}
                            onChange={(e) => setGlobalDstNewPortName(e.target.value)}
                            className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-slate-400 font-bold mb-0.5">PORT TİPİ:</label>
                          <select
                            value={globalDstNewPortType}
                            onChange={(e) => setGlobalDstNewPortType(e.target.value as PortType)}
                            className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                          >
                            <option value="ethernet">RJ45 Ethernet</option>
                            <option value="fiber">Fiber SFP</option>
                            <option value="power_in">Güç Girişi</option>
                            <option value="power_out">Güç Çıkışı</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cable Specifications */}
                {globalSrcDeviceId && globalDstDeviceId && (
                  <div className="space-y-2.5 pt-1 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-slate-400 font-bold mb-0.5">KABLO TÜRÜ:</label>
                        <select
                          value={globalCableType}
                          onChange={(e) => {
                            const t = e.target.value as CableType;
                            setGlobalCableType(t);
                            if (t.startsWith('power')) setGlobalCableColor('#000000');
                            else if (t === 'fiber') setGlobalCableColor('#eab308');
                            else setGlobalCableColor('#3b82f6');
                          }}
                          className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded text-slate-700 font-medium"
                        >
                          <option value="cat6">Cat6 Ethernet</option>
                          <option value="cat6a">Cat6A S/FTP</option>
                          <option value="fiber">Fiber SFP</option>
                          <option value="power_c13">Güç C13/C14</option>
                          <option value="power_c19">Güç C19/C20</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[8px] text-slate-400 font-bold mb-0.5">KABLO RENGİ:</label>
                        <select
                          value={globalCableColor}
                          onChange={(e) => setGlobalCableColor(e.target.value)}
                          className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded text-slate-700 font-medium"
                        >
                          <option value="#3b82f6">Mavi (Veri)</option>
                          <option value="#eab308">Sarı (Fiber)</option>
                          <option value="#ef4444">Kırmızı (Kritik)</option>
                          <option value="#10b981">Yeşil (Management)</option>
                          <option value="#000000">Siyah (Güç)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-slate-400 font-bold mb-0.5">UZUNLUK (METRE):</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          required
                          value={globalCableLength}
                          onChange={(e) => setGlobalCableLength(parseFloat(e.target.value) || 2)}
                          className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded text-slate-700 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] text-slate-400 font-bold mb-0.5">ETİKET:</label>
                        <input
                          type="text"
                          placeholder="örn: Trunk link"
                          value={globalCableLabel}
                          onChange={(e) => setGlobalCableLabel(e.target.value)}
                          className="w-full text-[10px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingGlobalCable(false)}
                        className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer font-sans"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1 font-sans"
                      >
                        <Check className="h-3.5 w-3.5" /> Bağlantıyı Ekle
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {cables.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-left">Henüz hiçbir kablolama yapılmadı.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {cables.map((c) => {
                  const srcDev = devices.find(d => d.id === c.fromDeviceId);
                  const dstDev = devices.find(d => d.id === c.toDeviceId);
                  const isPower = c.type.startsWith('power');

                  return (
                    <div 
                      key={c.id} 
                      className="p-2 border border-slate-200/80 rounded-lg hover:border-slate-300 bg-slate-50/50 flex flex-col gap-1 text-[10px]"
                    >
                      <div className="flex justify-between items-center text-left">
                        <span className="font-bold text-slate-700 truncate max-w-[130px]" title={c.label}>
                          {c.label || 'Kablo Bağlantısı'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded font-mono text-[8px] font-bold" style={{ backgroundColor: `${c.color}15`, color: c.color }}>
                          {isPower ? 'GÜÇ' : 'VERİ'} • {c.length}m
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-semibold truncate text-left">
                        {srcDev?.name} ➔ {dstDev?.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
