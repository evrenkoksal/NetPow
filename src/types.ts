/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DeviceType = 'network' | 'power' | 'compute' | 'accessory';

export type DeviceSubtype = 
  | 'router' 
  | 'switch' 
  | 'patch_panel' 
  | 'firewall' 
  | 'pdu' 
  | 'ups' 
  | 'server' 
  | 'storage' 
  | 'organizer' 
  | 'blank';

export type PortType = 'ethernet' | 'fiber' | 'power_in' | 'power_out';

export interface Port {
  id: string;
  name: string;
  type: PortType;
  connectedToCableId: string | null;
}

export interface Device {
  id: string;
  name: string;
  model: string;
  type: DeviceType;
  subtype: DeviceSubtype;
  uSize: number; // e.g. 1, 2, 4 U
  uPosition: number | null; // e.g. 1 to 42 (bottom-aligned rack position)
  ports: Port[];
  powerDraw: number; // current draw in Watts (or max rated)
  powerLimit?: number; // for PDUs/UPS (max capacity in Watts)
  weight: number; // in kg
  ipAddress?: string;
  vlan?: string;
  notes?: string;
  isRedundant?: boolean;
  isExternal?: boolean;
  // Position on the visual topology canvas
  x: number;
  y: number;
}

export type CableType = 'cat6' | 'cat6a' | 'fiber' | 'power_c13' | 'power_c19';

export interface Cable {
  id: string;
  fromDeviceId: string;
  fromPortId: string;
  toDeviceId: string;
  toPortId: string;
  type: CableType;
  color: string;
  length: number; // in meters
  label?: string;
}

export interface RackSettings {
  totalU: number; // typically 42, 24, or 12
  maxWeightKg: number;
  maxPowerW: number;
}

export interface SavedTopology {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  devices: Device[];
  cables: Cable[];
  rackSettings: RackSettings;
}
