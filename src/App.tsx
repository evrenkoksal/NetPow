/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DeviceLibrary } from './components/DeviceLibrary';
import { CabinetRack } from './components/CabinetRack';
import { TopologyCanvas } from './components/TopologyCanvas';
import { Inspector } from './components/Inspector';
import { PrintReport } from './components/PrintReport';
import { PRESET_TOPOLOGIES, DevicePreset } from './data/devicePresets';
import { Device, Cable, RackSettings, SavedTopology, Port } from './types';
import { 
  Network, 
  Layers, 
  Trash2, 
  Download, 
  Upload, 
  Save, 
  Database, 
  Server, 
  CheckCircle, 
  AlertTriangle,
  Info,
  Printer,
  Plus
} from 'lucide-react';

export default function App() {
  // Tab State: 'rack' (Cabinet Layout) or 'topology' (Connection Diagram)
  const [activeTab, setActiveTab] = useState<'rack' | 'topology'>('rack');

  // Cabinet List and Selection State
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [activeCabinetId, setActiveCabinetId] = useState<string>('default-cabinet');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Topology state
  const [designName, setDesignName] = useState('Kabin Tasarım Planı');
  const [devices, setDevices] = useState<Device[]>([]);
  const [cables, setCables] = useState<Cable[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Settings
  const [rackSettings, setRackSettings] = useState<RackSettings>({
    totalU: 24, // Standard default U size for standard office
    maxWeightKg: 800,
    maxPowerW: 3680, // Max power at 16A 230V
  });

  // Fetch all cabinets
  const fetchCabinets = async () => {
    try {
      const res = await fetch('/api/cabinets');
      if (res.ok) {
        const data = await res.json();
        setCabinets(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch cabinets', err);
    }
    return [];
  };

  // Load selected cabinet data
  const loadCabinetData = async (id: string) => {
    try {
      const res = await fetch(`/api/cabinets/${id}/data`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setCables(data.cables || []);
        setDesignName(data.name || 'Kabin Planı');
        if (data.rackSettings) {
          setRackSettings(data.rackSettings);
        }
        setActiveCabinetId(id);
      }
    } catch (err) {
      console.error('Failed to load cabinet data', err);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      const cabs = await fetchCabinets();
      if (cabs && cabs.length > 0) {
        const lastActive = localStorage.getItem('netpow-active-cabinet-id');
        const exists = cabs.some((c: any) => c.id === lastActive);
        const idToLoad = exists ? lastActive! : cabs[0].id;
        loadCabinetData(idToLoad);
      }
    };
    init();
  }, []);

  // Redefined save to server (keeping name saveToLocalStorage to avoid modifying all 12 callers)
  const saveToLocalStorage = async (
    currentDevices: Device[],
    currentCables: Cable[],
    settings: RackSettings,
    name: string
  ) => {
    // Keep localstorage fallback
    const payload: SavedTopology = {
      id: activeCabinetId,
      name,
      description: 'Aktif kabin topoloji planı',
      updatedAt: new Date().toISOString(),
      devices: currentDevices,
      cables: currentCables,
      rackSettings: settings,
    };
    localStorage.setItem('cabin-topology-design', JSON.stringify(payload));

    // Save to server SQLite DB
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/cabinets/${activeCabinetId}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          devices: currentDevices,
          cables: currentCables,
          rackSettings: settings,
        }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        // Silent refresh of cabinet list to update devices count/names
        fetchCabinets();
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Failed to save to SQLite database', err);
      setSaveStatus('error');
    }
  };

  // Cabinet Action Handlers
  const handleAddNewCabinet = async () => {
    const name = window.prompt('Yeni kabin adını giriniz:', `Kabin - ${cabinets.length + 1}`);
    if (name === null) return; // Cancelled
    const cabinetName = name.trim() || `Kabin - ${cabinets.length + 1}`;

    try {
      const res = await fetch('/api/cabinets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cabinetName,
          totalU: 24,
          maxWeightKg: 800,
          maxPowerW: 3680,
        }),
      });
      if (res.ok) {
        const newCab = await res.json();
        await fetchCabinets();
        localStorage.setItem('netpow-active-cabinet-id', newCab.id);
        loadCabinetData(newCab.id);
      }
    } catch (err) {
      console.error('Failed to create new cabinet', err);
    }
  };

  const handleDeleteCabinet = async () => {
    if (cabinets.length <= 1) {
      alert('Sistemde en az bir adet kabin bulunmalıdır. Son kabini silemezsiniz.');
      return;
    }
    if (!window.confirm(`"${designName}" isimli kabini ve içindeki tüm cihaz ve kabloları silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      return;
    }

    try {
      const res = await fetch(`/api/cabinets/${activeCabinetId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const updatedCabs = await fetchCabinets();
        if (updatedCabs && updatedCabs.length > 0) {
          localStorage.setItem('netpow-active-cabinet-id', updatedCabs[0].id);
          loadCabinetData(updatedCabs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to delete cabinet', err);
    }
  };

  // DB Backup and Restore handlers
  const handleDbBackup = async () => {
    try {
      const res = await fetch('/api/db/backup');
      const data = await res.json();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `netpow_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Yedek indirilirken bir hata oluştu: ' + err);
    }
  };

  const handleDbRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Veritabanını bu yedekten geri yüklemek istediğinize emin misiniz? Mevcut tüm kabinler, cihazlar ve kablolar silinecektir!')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/db/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupData),
        });

        if (res.ok) {
          alert('Veritabanı başarıyla yedekten geri yüklendi!');
          const cabs = await fetchCabinets();
          if (cabs && cabs.length > 0) {
            localStorage.setItem('netpow-active-cabinet-id', cabs[0].id);
            loadCabinetData(cabs[0].id);
          }
        } else {
          const errorData = await res.json();
          alert('Geri yükleme başarısız: ' + (errorData.error || 'Bilinmeyen hata'));
        }
      } catch (err) {
        alert('Yedek dosyası okunurken hata oluştu: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Helper to load a template
  const loadPresetTopology = (index: number) => {
    const preset = PRESET_TOPOLOGIES[index];
    if (!preset) return;
    
    setDevices(preset.devices);
    setCables(preset.cables);
    setDesignName(preset.name);
    setSelectedDeviceId(null);
    saveToLocalStorage(preset.devices, preset.cables, rackSettings, preset.name);
  };

  // Generate Unique Device object from Preset
  const createDeviceFromPreset = (preset: DevicePreset, uPosition: number | null): Device => {
    const devId = 'dev-' + Math.random().toString(36).substring(2, 9);
    
    // Create new unique port objects
    const ports = preset.ports.map((p, index) => ({
      id: `${devId}-port-${index}`,
      name: p.name,
      type: p.type,
      connectedToCableId: null,
    }));

    // Topology placement coordinates
    let x = 100 + Math.random() * 200;
    let y = 100 + Math.random() * 200;

    // Auto place on canvas according to category hierarchy
    if (preset.isExternal) {
      if (preset.type === 'network') {
        // Metro internet - top left
        x = 50 + Math.random() * 40;
        y = 50 + Math.random() * 40;
      } else {
        // External UPS - bottom left
        x = 50 + Math.random() * 40;
        y = 350 + Math.random() * 40;
      }
    } else if (preset.type === 'network') {
      y = 80 + Math.random() * 40;
    } else if (preset.type === 'compute') {
      y = 220 + Math.random() * 40;
    } else if (preset.type === 'power') {
      y = 360 + Math.random() * 40;
    }

    return {
      id: devId,
      name: preset.name,
      model: preset.model,
      type: preset.type,
      subtype: preset.subtype,
      uSize: preset.uSize,
      uPosition: preset.isExternal ? null : uPosition,
      ports,
      powerDraw: preset.powerDraw,
      powerLimit: preset.powerLimit,
      weight: preset.weight,
      ipAddress: preset.ipAddress,
      vlan: preset.vlan,
      notes: preset.notes,
      isExternal: preset.isExternal,
      x,
      y,
    };
  };

  // Handle adding device from Library (via Click on + button)
  const handleAddDevice = (preset: DevicePreset) => {
    if (preset.isExternal) {
      const newDevice = createDeviceFromPreset(preset, null);
      const updatedDevices = [...devices, newDevice];
      setDevices(updatedDevices);
      setSelectedDeviceId(newDevice.id);
      saveToLocalStorage(updatedDevices, cables, rackSettings, designName);
      return;
    }

    // Find first free U space in the rack
    let freeU: number | null = null;
    const { totalU } = rackSettings;

    // Build map of occupied slots
    const occupied = new Set<number>();
    devices.forEach((d) => {
      if (d.uPosition !== null) {
        for (let i = 0; i < d.uSize; i++) {
          occupied.add(d.uPosition + i);
        }
      }
    });

    // Check slots from bottom to top for placing
    for (let u = 1; u <= totalU - preset.uSize + 1; u++) {
      let rangeFree = true;
      for (let i = 0; i < preset.uSize; i++) {
        if (occupied.has(u + i)) {
          rangeFree = false;
          break;
        }
      }
      if (rangeFree) {
        freeU = u;
        break;
      }
    }

    const newDevice = createDeviceFromPreset(preset, freeU);
    const updatedDevices = [...devices, newDevice];
    setDevices(updatedDevices);
    setSelectedDeviceId(newDevice.id);
    saveToLocalStorage(updatedDevices, cables, rackSettings, designName);

    if (freeU === null) {
      alert(`Uyarı: Kabin içerisinde bu cihaz için (${preset.uSize}U) uygun boş alan bulunamadı. Cihaz 'Raf / Boşta Cihazlar' rafına eklendi. Buradan manuel yerleşim yapabilirsiniz.`);
    }
  };

  // Custom preset dropped directly onto a rack slot (received from CabinetRack event)
  const handleAddPresetAtU = (preset: DevicePreset, uPosition: number) => {
    if (preset.isExternal) {
      const newDevice = createDeviceFromPreset(preset, null);
      const updatedDevices = [...devices, newDevice];
      setDevices(updatedDevices);
      setSelectedDeviceId(newDevice.id);
      saveToLocalStorage(updatedDevices, cables, rackSettings, designName);
      return;
    }
    const newDevice = createDeviceFromPreset(preset, uPosition);
    const listWithNewDevice = [...devices, newDevice];
    const updatedDevices = shoveDevices(newDevice.id, uPosition, listWithNewDevice);
    setDevices(updatedDevices);
    setSelectedDeviceId(newDevice.id);
    saveToLocalStorage(updatedDevices, cables, rackSettings, designName);
  };

  // Drag-drop window listener for presets
  useEffect(() => {
    const handlePresetDrop = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { preset, uPosition } = customEvent.detail;
      handleAddPresetAtU(preset, uPosition);
    };
    window.addEventListener('preset-dropped', handlePresetDrop);
    return () => window.removeEventListener('preset-dropped', handlePresetDrop);
  }, [devices, cables, rackSettings, designName]);

  // Remove Device
  const handleRemoveDevice = (deviceId: string) => {
    const updatedDevices = devices.filter((d) => d.id !== deviceId);
    // Also remove any cables attached to this device
    const updatedCables = cables.filter(
      (c) => c.fromDeviceId !== deviceId && c.toDeviceId !== deviceId
    );

    setDevices(updatedDevices);
    setCables(updatedCables);
    if (selectedDeviceId === deviceId) {
      setSelectedDeviceId(null);
    }
    saveToLocalStorage(updatedDevices, updatedCables, rackSettings, designName);
  };

  // Clone Device
  const handleCloneDevice = (deviceId: string) => {
    const original = devices.find((d) => d.id === deviceId);
    if (!original) return;

    // Create unique ID for the new clone
    const cloneId = 'dev-' + Math.random().toString(36).substring(2, 9);

    // Deep clone ports with new unique IDs and clear cable connections
    const clonedPorts: Port[] = original.ports.map((p, index) => ({
      id: `${cloneId}-port-${index}`,
      name: p.name,
      type: p.type,
      connectedToCableId: null,
    }));

    // Build map of occupied slots in the cabinet
    const occupied = new Set<number>();
    devices.forEach((d) => {
      if (d.id !== original.id && d.uPosition !== null) {
        for (let i = 0; i < d.uSize; i++) {
          occupied.add(d.uPosition + i);
        }
      }
    });

    let cloneUPosition: number | null = null;
    const uSize = original.uSize;

    if (original.uPosition !== null) {
      let found = false;

      // 1. Search downwards starting from right below the original device
      for (let startPos = original.uPosition - uSize; startPos >= 1; startPos--) {
        let isFree = true;
        for (let i = 0; i < uSize; i++) {
          if (occupied.has(startPos + i)) {
            isFree = false;
            break;
          }
        }
        if (isFree) {
          cloneUPosition = startPos;
          found = true;
          break;
        }
      }

      // 2. If no space is found below, search upwards starting from above the original device
      if (!found) {
        for (let startPos = original.uPosition + uSize; startPos <= rackSettings.totalU - uSize + 1; startPos++) {
          let isFree = true;
          for (let i = 0; i < uSize; i++) {
            if (occupied.has(startPos + i)) {
              isFree = false;
              break;
            }
          }
          if (isFree) {
            cloneUPosition = startPos;
            found = true;
            break;
          }
        }
      }
    }

    // Smart naming logic: "Name (Klon)" or "Name (Klon 2)", "Name (Klon 3)", etc.
    let cloneName = `${original.name} (Klon)`;
    const match = original.name.match(/\(Klon\s*(\d+)?\)$/);
    if (match) {
      const num = match[1] ? parseInt(match[1], 10) + 1 : 2;
      cloneName = original.name.replace(/\(Klon\s*(\d+)?\)$/, `(Klon ${num})`);
    }

    // Set placement on the visual topology canvas (offset y to place below original node)
    const cloneDevice: Device = {
      ...original,
      id: cloneId,
      name: cloneName,
      ports: clonedPorts,
      uPosition: cloneUPosition,
      x: original.x,
      y: original.y + 100, // Shift downwards by 100px
    };

    const updatedDevices = [...devices, cloneDevice];
    setDevices(updatedDevices);
    setSelectedDeviceId(cloneId); // Auto-select the newly created clone
    saveToLocalStorage(updatedDevices, cables, rackSettings, designName);

    if (original.uPosition !== null && cloneUPosition === null) {
      alert("Uyarı: Kabinde bu cihazı klonlamak için uygun boş alan bulunamadı. Cihaz 'Raf / Boşta Cihazlar' bölümüne eklendi.");
    }
  };

  // Update Device Details
  const handleUpdateDevice = (updatedDevice: Device) => {
    const updatedDevices = devices.map((d) => (d.id === updatedDevice.id ? updatedDevice : d));
    setDevices(updatedDevices);
    saveToLocalStorage(updatedDevices, cables, rackSettings, designName);
  };

  // Helper to shove/push devices dynamically inside the rack when one is moved/placed
  const shoveDevices = (
    deviceId: string,
    newPosition: number,
    currentDevices: Device[]
  ): Device[] => {
    const totalU = rackSettings.totalU;
    let tempDevices = currentDevices.map((d) => ({ ...d }));
    const movingDevice = tempDevices.find((d) => d.id === deviceId);
    if (!movingDevice) return currentDevices;

    movingDevice.uPosition = newPosition;

    let hasOverlap = true;
    let attempts = 0;
    const maxAttempts = 100;

    while (hasOverlap && attempts < maxAttempts) {
      hasOverlap = false;
      attempts++;

      // Build map of occupied slots locked by moving/shoved devices in this step
      const occupied = new Map<number, string>();
      for (let i = 0; i < movingDevice.uSize; i++) {
        occupied.set(movingDevice.uPosition + i, movingDevice.id);
      }

      // Check for overlaps with other devices and shift them
      for (let d of tempDevices) {
        if (d.id === deviceId || d.uPosition === null || d.isExternal) continue;

        let overlaps = false;
        for (let i = 0; i < d.uSize; i++) {
          if (occupied.has(d.uPosition + i)) {
            overlaps = true;
            break;
          }
        }

        if (overlaps) {
          // Attempt shoving upward first
          let pushedPosition = d.uPosition;
          let valid = false;

          while (pushedPosition + d.uSize - 1 <= totalU) {
            pushedPosition++;
            let canPlace = true;
            for (let i = 0; i < d.uSize; i++) {
              if (occupied.has(pushedPosition + i)) {
                canPlace = false;
                break;
              }
            }
            if (canPlace) {
              valid = true;
              break;
            }
          }

          // Attempt shoving downward if upward is blocked
          if (!valid) {
            pushedPosition = d.uPosition;
            while (pushedPosition >= 1) {
              pushedPosition--;
              let canPlace = true;
              for (let i = 0; i < d.uSize; i++) {
                if (occupied.has(pushedPosition + i)) {
                  canPlace = false;
                  break;
                }
              }
              if (canPlace) {
                valid = true;
                break;
              }
            }
          }

          if (valid) {
            d.uPosition = pushedPosition;
            hasOverlap = true;
          } else {
            // Unmount if there's absolutely no space
            d.uPosition = null;
            hasOverlap = true;
          }
        }

        if (d.uPosition !== null) {
          for (let i = 0; i < d.uSize; i++) {
            occupied.set(d.uPosition + i, d.id);
          }
        }
      }
    }

    return tempDevices;
  };

  // Update Device Position (Relocate in Rack)
  const handleUpdateDevicePosition = (deviceId: string, newPosition: number | null) => {
    let updatedDevices;
    if (newPosition === null) {
      updatedDevices = devices.map((d) => (d.id === deviceId ? { ...d, uPosition: null } : d));
    } else {
      updatedDevices = shoveDevices(deviceId, newPosition, devices);
    }
    setDevices(updatedDevices);
    saveToLocalStorage(updatedDevices, cables, rackSettings, designName);
  };

  // Mount unmounted device to a slot
  const handleMountDevice = (deviceId: string, uPosition: number) => {
    handleUpdateDevicePosition(deviceId, uPosition);
  };

  // Update coordinates on visual topology canvas (supports single update or batch update array)
  const handleUpdateDeviceCoords = (
    updates: { id: string; x: number; y: number }[] | string,
    x?: number,
    y?: number
  ) => {
    setDevices((prevDevices) => {
      let updated;
      if (Array.isArray(updates)) {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        updated = prevDevices.map((d) => {
          const match = updateMap.get(d.id);
          if (match) {
            return { ...d, x: match.x, y: match.y };
          }
          return d;
        });
      } else {
        const deviceId = updates;
        updated = prevDevices.map((d) => {
          if (d.id === deviceId) {
            return { ...d, x: x!, y: y! };
          }
          return d;
        });
      }
      // Save inside state callback to guarantee we write the correct final state
      saveToLocalStorage(updated, cables, rackSettings, designName);
      return updated;
    });
  };

  // Connect new cable
  const handleAddCable = (
    newCableData: Omit<Cable, 'id'>,
    newPortsToCreate?: { deviceId: string; name: string; type: Port['type'] }[]
  ) => {
    const cableId = 'cable-' + Math.random().toString(36).substring(2, 9);
    
    // Copy devices
    let currentDevices = [...devices];

    // Create any new ports first and update our local array of devices
    let finalFromPortId = newCableData.fromPortId;
    let finalToPortId = newCableData.toPortId;

    if (newPortsToCreate && newPortsToCreate.length > 0) {
      newPortsToCreate.forEach((newPortSpec) => {
        const devIndex = currentDevices.findIndex(d => d.id === newPortSpec.deviceId);
        if (devIndex !== -1) {
          const dev = currentDevices[devIndex];
          const newPortId = `port-${dev.id}-${Math.random().toString(36).substring(2, 7)}`;
          const newPort = {
            id: newPortId,
            name: newPortSpec.name,
            type: newPortSpec.type,
            connectedToCableId: null,
          };
          currentDevices[devIndex] = {
            ...dev,
            ports: [...dev.ports, newPort],
          };

          // Re-map the placeholder port ID in cable data if matched
          if (newPortSpec.deviceId === newCableData.fromDeviceId && newCableData.fromPortId === `new-port-${newPortSpec.deviceId}`) {
            finalFromPortId = newPortId;
          }
          if (newPortSpec.deviceId === newCableData.toDeviceId && newCableData.toPortId === `new-port-${newPortSpec.deviceId}`) {
            finalToPortId = newPortId;
          }
        }
      });
    }

    const newCable: Cable = {
      ...newCableData,
      fromPortId: finalFromPortId,
      toPortId: finalToPortId,
      id: cableId,
    };

    const updatedCables = [...cables, newCable];

    // Mark ports as connected
    const updatedDevices = currentDevices.map((device) => {
      let portsChanged = false;
      const updatedPorts = device.ports.map((port) => {
        if (
          (device.id === newCable.fromDeviceId && port.id === newCable.fromPortId) ||
          (device.id === newCable.toDeviceId && port.id === newCable.toPortId)
        ) {
          portsChanged = true;
          return { ...port, connectedToCableId: cableId };
        }
        return port;
      });

      if (portsChanged) {
        return { ...device, ports: updatedPorts };
      }
      return device;
    });

    setDevices(updatedDevices);
    setCables(updatedCables);
    saveToLocalStorage(updatedDevices, updatedCables, rackSettings, designName);
  };

  // Disconnect / Remove cable
  const handleRemoveCable = (cableId: string) => {
    const updatedCables = cables.filter((c) => c.id !== cableId);

    // Unmark ports
    const updatedDevices = devices.map((device) => {
      let portsChanged = false;
      const updatedPorts = device.ports.map((port) => {
        if (port.connectedToCableId === cableId) {
          portsChanged = true;
          return { ...port, connectedToCableId: null };
        }
        return port;
      });

      if (portsChanged) {
        return { ...device, ports: updatedPorts };
      }
      return device;
    });

    setDevices(updatedDevices);
    setCables(updatedCables);
    saveToLocalStorage(updatedDevices, updatedCables, rackSettings, designName);
  };

  // Clear workspace completely
  const handleClearWorkspace = () => {
    if (window.confirm('Tüm tasarımı, cihazları ve kabloları temizlemek istediğinize emin misiniz?')) {
      setDevices([]);
      setCables([]);
      setSelectedDeviceId(null);
      setDesignName('Yeni Kabin Planı');
      localStorage.removeItem('cabin-topology-design');
    }
  };

  // Import JSON File
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as SavedTopology;
        if (parsed && Array.isArray(parsed.devices)) {
          setDevices(parsed.devices);
          setCables(parsed.cables || []);
          setDesignName(parsed.name || 'İçe Aktarılan Kabin Planı');
          if (parsed.rackSettings) setRackSettings(parsed.rackSettings);
          setSelectedDeviceId(null);
          saveToLocalStorage(parsed.devices, parsed.cables || [], parsed.rackSettings || rackSettings, parsed.name);
          alert('Tasarım başarıyla içe aktarıldı!');
        } else {
          alert('Geçersiz dosya formatı. Lütfen doğru bir topoloji tasarım JSON dosyası yükleyin.');
        }
      } catch (err) {
        alert('Dosya okunurken bir hata oluştu: ' + err);
      }
    };
    reader.readAsText(file);
  };

  // Export JSON File
  const handleExportJson = () => {
    const payload: SavedTopology = {
      id: 'active-design',
      name: designName,
      description: 'Kabinet ağ ve güç topoloji tasarımı',
      updatedAt: new Date().toISOString(),
      devices,
      cables,
      rackSettings,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${designName.replace(/\s+/g, '_')}_topoloji_plani.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Header metric totals
  const totalWeight = devices.reduce((sum, d) => sum + d.weight, 0);
  const totalPower = devices.reduce((sum, d) => sum + d.powerDraw, 0);
  const activeAlertsCount = devices.filter((d) => {
    // Basic power check to flag warning badge in top bar
    if (d.subtype === 'server' || d.subtype === 'storage') {
      const pwrInPorts = d.ports.filter(p => p.type === 'power_in');
      const connectedCount = pwrInPorts.filter(p => p.connectedToCableId).length;
      return connectedCount < pwrInPorts.length;
    }
    return false;
  }).length;

  return (
    <div id="main-app" className="flex flex-col h-screen bg-[#F8FAFC] font-sans overflow-hidden text-slate-800">
      
      {/* Upper High-Tech Title Banner - Professional Polish Style */}
      <header className="min-h-[3.5rem] py-2 md:py-0 border-b bg-white border-slate-200 flex flex-col lg:flex-row items-center justify-between px-4 lg:px-6 shadow-sm z-10 shrink-0 gap-3">
        <div className="flex flex-wrap items-center justify-between w-full lg:w-auto gap-3">
          <div className="flex items-center gap-3">
            <div 
              onClick={handleAddNewCabinet}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
              title="Yeni Kabin Ekle (+)"
            >
              <svg className="w-5 h-5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7zM9 12h6M12 9v6"></path>
              </svg>
            </div>
            <h1 className="font-bold text-base tracking-tight text-slate-900 flex items-center gap-1 font-mono shrink-0">
              Net<span className="text-blue-600">Pow</span>
              <button
                onClick={handleAddNewCabinet}
                className="p-1 hover:bg-blue-50 hover:text-blue-600 rounded text-blue-600 hover:scale-110 transition-all cursor-pointer"
                title="Yeni Kabin Ekle"
              >
                <Plus className="h-4 w-4" />
              </button>
            </h1>
            <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded uppercase tracking-wider ml-1 shrink-0">v4.2.0</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Kabin:</span>
            <select
              value={activeCabinetId}
              onChange={(e) => {
                const selectedId = e.target.value;
                localStorage.setItem('netpow-active-cabinet-id', selectedId);
                loadCabinetData(selectedId);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs px-2 py-1 rounded outline-none cursor-pointer max-w-[150px] transition-colors hover:bg-slate-100"
            >
              {cabinets.map((cab) => (
                <option key={cab.id} value={cab.id}>
                  {cab.name} ({cab.device_count || 0} Cihaz)
                </option>
              ))}
            </select>

            <input
              type="text"
              value={designName}
              onChange={(e) => {
                setDesignName(e.target.value);
                saveToLocalStorage(devices, cables, rackSettings, e.target.value);
              }}
              className="bg-transparent border-b border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none font-semibold text-xs text-slate-600 px-1 py-0.5 transition-colors max-w-[120px] sm:max-w-[150px]"
              title="Tasarım adını değiştirmek için tıklayın"
              placeholder="Kabin Adı"
            />

            {cabinets.length > 1 && (
              <button
                onClick={handleDeleteCabinet}
                className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-slate-400 transition-colors cursor-pointer shrink-0"
                title="Aktif Kabini Sil"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Save Status */}
            <span className="text-[10px] font-mono shrink-0 ml-1">
              {saveStatus === 'saving' && <span className="text-amber-500 animate-pulse">● Kaydediliyor</span>}
              {saveStatus === 'saved' && <span className="text-emerald-500">● Kaydedildi</span>}
              {saveStatus === 'error' && <span className="text-red-500">● Hata!</span>}
            </span>
          </div>
        </div>

        {/* Dashboard quick-info stats strip (Light Theme Polish) - Hide on medium screen sizes for layout spacing */}
        <div className="hidden xl:flex gap-4 bg-slate-50 border border-slate-100 rounded-lg p-1.5 px-3.5 text-[11px] font-mono shrink-0">
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Kabin Boyutu</span>
            <select
              value={rackSettings.totalU}
              onChange={(e) => {
                const totalU = Number(e.target.value);
                const updatedSettings = { ...rackSettings, totalU };
                setRackSettings(updatedSettings);
                saveToLocalStorage(devices, cables, updatedSettings, designName);
              }}
              className="bg-transparent text-slate-700 outline-none font-semibold border-none cursor-pointer py-0"
            >
              <option value="12">12U Küçük</option>
              <option value="24">24U Orta</option>
              <option value="42">42U Standart</option>
            </select>
          </div>
          <div className="w-px bg-slate-200 self-stretch" />
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Aktif Güç Yükü</span>
            <span className={`font-semibold ${totalPower > rackSettings.maxPowerW * 0.8 ? 'text-amber-600' : 'text-slate-700'}`}>
              {totalPower} W / {rackSettings.maxPowerW} W
            </span>
          </div>
          <div className="w-px bg-slate-200 self-stretch" />
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Statik Ağırlık</span>
            <span className="font-semibold text-slate-700">
              {totalWeight.toFixed(1)} kg / {rackSettings.maxWeightKg} kg
            </span>
          </div>
          <div className="w-px bg-slate-200 self-stretch" />
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Sistem Doğrulama</span>
            {activeAlertsCount > 0 ? (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {activeAlertsCount} Risk
              </span>
            ) : (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Doğrulandı
              </span>
            )}
          </div>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs w-full lg:w-auto shrink-0">
          {/* Database backup & restore buttons */}
          <button
            onClick={handleDbBackup}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
            title="Tüm veritabanı yedeğini JSON olarak indir"
          >
            <Database className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden xl:inline">Veritabanı Yedeği Al</span>
            <span className="hidden md:inline xl:hidden">Yedek Al</span>
          </button>

          <label className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0">
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden md:inline">Yedek Yükle</span>
            <input
              type="file"
              accept=".json"
              onChange={handleDbRestore}
              className="hidden"
            />
          </label>

          {/* Template loader dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value !== "") {
                loadPresetTopology(Number(e.target.value));
                e.target.value = ""; // Reset
              }
            }}
            className="bg-white border border-slate-200 text-slate-600 font-semibold px-2 py-1.5 hover:bg-slate-50 rounded-lg outline-none cursor-pointer text-xs max-w-[120px] md:max-w-[150px] shrink-0"
            defaultValue=""
          >
            <option value="" disabled>Şablon Yükle...</option>
            {PRESET_TOPOLOGIES.map((top, idx) => (
              <option key={idx} value={idx}>{top.name}</option>
            ))}
          </select>

          {/* Import JSON button wrapper */}
          <label className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">İçe Aktar</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
            title="Kabin yerleşimi ve topolojiyi PDF olarak çıktı al"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF Raporu</span><span className="hidden xl:inline"> / Yazdır</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
            title="Tasarlanmış yapıyı JSON olarak indir"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">İndir (JSON)</span>
            <span className="hidden sm:inline md:hidden">İndir</span>
          </button>

          <button
            onClick={handleClearWorkspace}
            className="flex items-center gap-1.5 bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Tasarım alanındaki her şeyi siler"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Temizle</span>
          </button>
        </div>
      </header>

      {/* Main content body with 3-column system layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left column: Device presets library */}
        <div className="w-full md:w-64 lg:w-72 shrink-0 h-2/5 md:h-full border-b md:border-b-0">
          <DeviceLibrary onAddDevice={handleAddDevice} />
        </div>

        {/* Middle column: Interactive rack mount view or topology drawing canvas */}
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          {/* Internal sub-tabs toolbar matching Professional Polish design mode style */}
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex justify-between items-center shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-md">
              <button
                onClick={() => setActiveTab('rack')}
                className={`px-3 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                  activeTab === 'rack'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                19" Kabin Yerleşimi
              </button>
              <button
                onClick={() => setActiveTab('topology')}
                className={`px-3 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                  activeTab === 'topology'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ağ & Güç Topolojisi
              </button>
            </div>

            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
              {activeTab === 'rack' 
                ? 'MONTАJ VE YERLEŞİM MODU'
                : 'AKTİF KABLOLAMA VE ŞEMA MODU'
              }
            </div>
          </div>

          {/* Active View Container */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'rack' ? (
              <CabinetRack
                devices={devices}
                rackSettings={rackSettings}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onRemoveDevice={handleRemoveDevice}
                onUpdateDevicePosition={handleUpdateDevicePosition}
                onMountDevice={handleMountDevice}
              />
            ) : (
              <TopologyCanvas
                devices={devices}
                cables={cables}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onUpdateDeviceCoords={handleUpdateDeviceCoords}
                onAddCable={handleAddCable}
                onRemoveCable={handleRemoveCable}
              />
            )}
          </div>
        </div>

        {/* Right column: Inspector & overall system analyzer */}
        <div className="w-full md:w-72 lg:w-80 shrink-0 h-2/5 md:h-full border-t md:border-t-0">
          <Inspector
            devices={devices}
            cables={cables}
            selectedDeviceId={selectedDeviceId}
            onUpdateDevice={handleUpdateDevice}
            onRemoveDevice={handleRemoveDevice}
            onRemoveCable={handleRemoveCable}
            onSelectDevice={setSelectedDeviceId}
            onAddCable={handleAddCable}
            onCloneDevice={handleCloneDevice}
          />
        </div>

      </div>

      {/* Elegant Professional Polish Footer */}
      <footer className="h-8 bg-slate-900 text-white/50 text-[10px] flex items-center px-6 justify-between font-mono shrink-0">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            SYSTEM: ONLINE
          </span>
          <span>LATENCY: 12ms</span>
          <span>DB: connected_replica_01</span>
        </div>
        <div>© 2026 NetPow Corp. Tüm hakları saklıdır.</div>
      </footer>

      <PrintReport
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        devices={devices}
        cables={cables}
        rackSettings={rackSettings}
        designName={designName}
      />

    </div>
  );
}
