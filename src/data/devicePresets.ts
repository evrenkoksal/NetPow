/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Device, Port, Cable } from '../types';

export interface DevicePreset {
  name: string;
  model: string;
  type: Device['type'];
  subtype: Device['subtype'];
  uSize: number;
  ports: { name: string; type: Port['type'] }[];
  powerDraw: number; // Watts
  powerLimit?: number; // for power sources
  weight: number; // kg
  ipAddress?: string;
  vlan?: string;
  notes?: string;
  isExternal?: boolean;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  // --- HARİCİ / DIŞ BAĞLANTILAR & KGK ---
  {
    name: 'Metro İnternet (Dış Bağlantı)',
    model: 'Metro Fiber WAN',
    type: 'network',
    subtype: 'router',
    uSize: 0,
    ports: [
      { name: 'Metro Fiber A', type: 'fiber' },
      { name: 'Metro Fiber B', type: 'fiber' },
      { name: 'Metro RJ45 A', type: 'ethernet' },
      { name: 'Metro RJ45 B', type: 'ethernet' },
    ],
    powerDraw: 0,
    weight: 0,
    notes: 'Kabin dışı yüksek hızlı metro ethernet fiber internet girişi.',
    isExternal: true
  },
  {
    name: '100 KVA Harici KGK (UPS)',
    model: '3-Faz Endüstriyel Harici UPS',
    type: 'power',
    subtype: 'ups',
    uSize: 0,
    ports: [
      { name: 'L1 Güç Çıkışı 1', type: 'power_out' },
      { name: 'L1 Güç Çıkışı 2', type: 'power_out' },
      { name: 'L2 Güç Çıkışı 1', type: 'power_out' },
      { name: 'L2 Güç Çıkışı 2', type: 'power_out' },
      { name: 'L3 Güç Çıkışı 1', type: 'power_out' },
      { name: 'L3 Güç Çıkışı 2', type: 'power_out' },
    ],
    powerDraw: 0,
    powerLimit: 90000,
    weight: 0,
    notes: 'Kabin dışı ana kesintisiz güç kaynağı (KGK) ünitesi.',
    isExternal: true
  },
  {
    name: '30 KVA Harici KGK (UPS)',
    model: '3-Faz Kompakt Harici UPS',
    type: 'power',
    subtype: 'ups',
    uSize: 0,
    ports: [
      { name: 'L1 Güç Çıkışı', type: 'power_out' },
      { name: 'L2 Güç Çıkışı', type: 'power_out' },
      { name: 'L3 Güç Çıkışı', type: 'power_out' },
    ],
    powerDraw: 0,
    powerLimit: 27000,
    weight: 0,
    notes: 'Kabin dışı yardımcı kesintisiz güç kaynağı (KGK) ünitesi.',
    isExternal: true
  },

  // --- AĞ CİHAZLARI ---
  {
    name: 'Kenar Yönlendirici',
    model: 'Cisco ISR 4331',
    type: 'network',
    subtype: 'router',
    uSize: 1,
    ports: [
      { name: 'GE 0/0/0', type: 'ethernet' },
      { name: 'GE 0/0/1', type: 'ethernet' },
      { name: 'GE 0/0/2', type: 'ethernet' },
      { name: 'SFP 0/1/0', type: 'fiber' },
      { name: 'SFP 0/1/1', type: 'fiber' },
      { name: 'Güç Girişi', type: 'power_in' },
    ],
    powerDraw: 60,
    weight: 6.2,
    ipAddress: '192.168.1.1',
    vlan: 'VLAN 10 (WAN)',
    notes: 'Ana internet çıkış ve WAN yönlendiricisi.'
  },
  {
    name: 'Yüksek Performanslı 10G/25G Omurga Anahtar',
    model: 'Cisco Nexus 93180YC-FX3',
    type: 'network',
    subtype: 'switch',
    uSize: 1,
    ports: [
      { name: 'SFP28 Port 1', type: 'fiber' },
      { name: 'SFP28 Port 2', type: 'fiber' },
      { name: 'SFP28 Port 3', type: 'fiber' },
      { name: 'SFP28 Port 4', type: 'fiber' },
      { name: 'QSFP28 Uplink 1', type: 'fiber' },
      { name: 'QSFP28 Uplink 2', type: 'fiber' },
      { name: 'Mgmt Port', type: 'ethernet' },
      { name: 'Güç Girişi A', type: 'power_in' },
      { name: 'Güç Girişi B', type: 'power_in' },
    ],
    powerDraw: 210,
    weight: 9.5,
    ipAddress: '192.168.1.10',
    vlan: 'VLAN 99 (Orkestrasyon)',
    notes: 'Veri merkezi omurga anahtarı, 10G/25G SFP28 ve 100G uplink portları destekler.'
  },
  {
    name: 'Omurga Anahtar (L3)',
    model: 'Cisco Catalyst 9300',
    type: 'network',
    subtype: 'switch',
    uSize: 1,
    ports: [
      { name: 'GigEth 1/0/1', type: 'ethernet' },
      { name: 'GigEth 1/0/2', type: 'ethernet' },
      { name: 'GigEth 1/0/3', type: 'ethernet' },
      { name: 'GigEth 1/0/4', type: 'ethernet' },
      { name: 'GigEth 1/0/5', type: 'ethernet' },
      { name: 'GigEth 1/0/6', type: 'ethernet' },
      { name: 'GigEth 1/0/7', type: 'ethernet' },
      { name: 'GigEth 1/0/8', type: 'ethernet' },
      { name: 'TE 1/1/1', type: 'fiber' },
      { name: 'TE 1/1/2', type: 'fiber' },
      { name: 'Güç Girişi A', type: 'power_in' },
      { name: 'Güç Girişi B', type: 'power_in' },
    ],
    powerDraw: 90,
    weight: 7.4,
    ipAddress: '192.168.1.2',
    vlan: 'VLAN 1 (Yönetim)',
    notes: 'L3 omurga anahtar, VLAN yönlendirmeleri aktif.'
  },
  {
    name: 'Kenar Anahtar (PoE+)',
    model: 'Ubiquiti USW-24-PoE',
    type: 'network',
    subtype: 'switch',
    uSize: 1,
    ports: [
      { name: 'Port 1', type: 'ethernet' },
      { name: 'Port 2', type: 'ethernet' },
      { name: 'Port 3', type: 'ethernet' },
      { name: 'Port 4', type: 'ethernet' },
      { name: 'Port 5', type: 'ethernet' },
      { name: 'Port 6', type: 'ethernet' },
      { name: 'Port 7', type: 'ethernet' },
      { name: 'Port 8', type: 'ethernet' },
      { name: 'SFP 1', type: 'fiber' },
      { name: 'SFP 2', type: 'fiber' },
      { name: 'Güç Girişi', type: 'power_in' },
    ],
    powerDraw: 120, // includes PoE load budget
    weight: 4.8,
    ipAddress: '192.168.1.3',
    vlan: 'VLAN 20 (İç Ağ)',
    notes: 'PoE+ destekli kenar anahtar. IP kameralar ve AP bağlantıları için.'
  },
  {
    name: 'Fibre Channel (SAN) Anahtar',
    model: 'Brocade G620',
    type: 'network',
    subtype: 'switch',
    uSize: 1,
    ports: [
      { name: 'FC Port 1', type: 'fiber' },
      { name: 'FC Port 2', type: 'fiber' },
      { name: 'FC Port 3', type: 'fiber' },
      { name: 'FC Port 4', type: 'fiber' },
      { name: 'FC Port 5', type: 'fiber' },
      { name: 'FC Port 6', type: 'fiber' },
      { name: 'Yönetim Portu', type: 'ethernet' },
      { name: 'Güç Girişi A', type: 'power_in' },
      { name: 'Güç Girişi B', type: 'power_in' },
    ],
    powerDraw: 110,
    weight: 7.8,
    ipAddress: '192.168.1.12',
    vlan: 'SAN Zone A',
    notes: 'Depolama ağları için 32Gbps yüksek hızlı Gen 6 Fibre Channel anahtarı.'
  },
  {
    name: 'Güvenlik Duvarı',
    model: 'FortiGate 100F',
    type: 'network',
    subtype: 'firewall',
    uSize: 1,
    ports: [
      { name: 'WAN 1', type: 'ethernet' },
      { name: 'WAN 2', type: 'ethernet' },
      { name: 'DMZ', type: 'ethernet' },
      { name: 'LAN 1', type: 'ethernet' },
      { name: 'LAN 2', type: 'ethernet' },
      { name: 'SFP+ 1', type: 'fiber' },
      { name: 'SFP+ 2', type: 'fiber' },
      { name: 'Güç Girişi A', type: 'power_in' },
      { name: 'Güç Girişi B', type: 'power_in' },
    ],
    powerDraw: 75,
    weight: 5.1,
    ipAddress: '192.168.1.254',
    vlan: 'Çoklu VLAN',
    notes: 'Kenar güvenlik duvarı. UTM ve SSL inceleme aktif.'
  },
  {
    name: 'Konsol Sunucusu (OOB Yönetim)',
    model: 'Opengear IM7216',
    type: 'network',
    subtype: 'switch',
    uSize: 1,
    ports: [
      { name: 'Konsol 1', type: 'ethernet' },
      { name: 'Konsol 2', type: 'ethernet' },
      { name: 'Konsol 3', type: 'ethernet' },
      { name: 'Konsol 4', type: 'ethernet' },
      { name: 'LAN 1', type: 'ethernet' },
      { name: 'LAN 2', type: 'ethernet' },
      { name: 'SFP Fiber', type: 'fiber' },
      { name: 'Güç Girişi A', type: 'power_in' },
      { name: 'Güç Girişi B', type: 'power_in' },
    ],
    powerDraw: 35,
    weight: 4.2,
    ipAddress: '192.168.99.1',
    vlan: 'VLAN 999 (OOB)',
    notes: 'Cihazların seri konsol portlarına erişim için bant dışı (Out-of-Band) yönetim sunucusu.'
  },
  {
    name: 'RJ45 Bağlantı Paneli',
    model: 'Cat6 Patch Panel 24P',
    type: 'network',
    subtype: 'patch_panel',
    uSize: 1,
    ports: [
      { name: 'Port 1', type: 'ethernet' },
      { name: 'Port 2', type: 'ethernet' },
      { name: 'Port 3', type: 'ethernet' },
      { name: 'Port 4', type: 'ethernet' },
      { name: 'Port 5', type: 'ethernet' },
      { name: 'Port 6', type: 'ethernet' },
      { name: 'Port 7', type: 'ethernet' },
      { name: 'Port 8', type: 'ethernet' },
    ],
    powerDraw: 0,
    weight: 1.5,
    notes: 'Pasif kablo sonlandırma paneli.'
  },

  // --- GÜÇ CİHAZLARI ---
  {
    name: 'Akıllı Yatay PDU',
    model: 'APC AP8959',
    type: 'power',
    subtype: 'pdu',
    uSize: 1,
    ports: [
      { name: 'Giriş (C20)', type: 'power_in' },
      { name: 'Çıkış 1 (C13)', type: 'power_out' },
      { name: 'Çıkış 2 (C13)', type: 'power_out' },
      { name: 'Çıkış 3 (C13)', type: 'power_out' },
      { name: 'Çıkış 4 (C13)', type: 'power_out' },
      { name: 'Çıkış 5 (C13)', type: 'power_out' },
      { name: 'Çıkış 6 (C13)', type: 'power_out' },
      { name: 'Çıkış 7 (C19)', type: 'power_out' },
      { name: 'Çıkış 8 (C19)', type: 'power_out' },
    ],
    powerDraw: 15, // PDU internal monitoring power
    powerLimit: 3680, // Max 16A 230V = 3680W
    weight: 3.2,
    ipAddress: '192.168.1.250',
    notes: 'Akıllı IP kontrollü yatay güç dağıtım ünitesi.'
  },
  {
    name: 'Raf Tipi UPS',
    model: 'APC Smart-UPS 3000',
    type: 'power',
    subtype: 'ups',
    uSize: 2,
    ports: [
      { name: 'Şebeke Girişi', type: 'power_in' },
      { name: 'Çıkış 1 (C13)', type: 'power_out' },
      { name: 'Çıkış 2 (C13)', type: 'power_out' },
      { name: 'Çıkış 3 (C13)', type: 'power_out' },
      { name: 'Çıkış 4 (C13)', type: 'power_out' },
      { name: 'Yüksek Akım 1 (C19)', type: 'power_out' },
      { name: 'Yüksek Akım 2 (C19)', type: 'power_out' },
    ],
    powerDraw: 50, // heat dissipation / charging
    powerLimit: 2700, // 2700 Watts max load
    weight: 38.6,
    ipAddress: '192.168.1.251',
    notes: 'Yüksek kapasiteli akü yedekleme ünitesi.'
  },

  // --- BİLİŞİM (SUNUCU VE DEPOLAMA) ---
  {
    name: '1U Sunucu (Web/App)',
    model: 'Dell PowerEdge R650',
    type: 'compute',
    subtype: 'server',
    uSize: 1,
    ports: [
      { name: 'LOM 1', type: 'ethernet' },
      { name: 'LOM 2', type: 'ethernet' },
      { name: 'iDRAC (Yön.)', type: 'ethernet' },
      { name: 'Güç Girişi A (PSU1)', type: 'power_in' },
      { name: 'Güç Girişi B (PSU2)', type: 'power_in' },
    ],
    powerDraw: 350,
    weight: 18.2,
    ipAddress: '192.168.1.100',
    vlan: 'VLAN 30 (Sunucular)',
    notes: 'Web ve uygulama katmanı sunucusu. Çift yedekli güç kaynağı (Dual PSU).'
  },
  {
    name: '2U Sunucu (Database)',
    model: 'HPE ProLiant DL380 Gen10',
    type: 'compute',
    subtype: 'server',
    uSize: 2,
    ports: [
      { name: 'Eth 1', type: 'ethernet' },
      { name: 'Eth 2', type: 'ethernet' },
      { name: 'HBA 1 (FC)', type: 'fiber' },
      { name: 'HBA 2 (FC)', type: 'fiber' },
      { name: 'iLO (Yönetim)', type: 'ethernet' },
      { name: 'Güç Girişi A (PSU1)', type: 'power_in' },
      { name: 'Güç Girişi B (PSU2)', type: 'power_in' },
    ],
    powerDraw: 550,
    weight: 26.5,
    ipAddress: '192.168.1.101',
    vlan: 'VLAN 40 (Veritabanı)',
    notes: 'Yüksek performanslı veritabanı sunucusu. Fiber HBA ve yedekli güç.'
  },
  {
    name: 'Yapay Zeka / GPU Sunucusu',
    model: 'NVIDIA DGX H100',
    type: 'compute',
    subtype: 'server',
    uSize: 4,
    ports: [
      { name: 'InfiniBand 1', type: 'fiber' },
      { name: 'InfiniBand 2', type: 'fiber' },
      { name: '400G Eth 1', type: 'fiber' },
      { name: '400G Eth 2', type: 'fiber' },
      { name: 'Yönetim LOM', type: 'ethernet' },
      { name: 'Güç Girişi 1', type: 'power_in' },
      { name: 'Güç Girişi 2', type: 'power_in' },
      { name: 'Güç Girişi 3', type: 'power_in' },
      { name: 'Güç Girişi 4', type: 'power_in' },
    ],
    powerDraw: 2200, // Very high!
    weight: 47.0,
    ipAddress: '192.168.50.10',
    vlan: 'VLAN 500 (AI/ML)',
    notes: 'Yapay zeka modelleri ve derin öğrenme için 8x H100 GPU barındıran canavar sunucu. 4x yedekli 3000W PSU.'
  },
  {
    name: 'SAN Depolama Ünitesi',
    model: 'Dell PowerVault ME5024',
    type: 'compute',
    subtype: 'storage',
    uSize: 2,
    ports: [
      { name: 'Port A1', type: 'fiber' },
      { name: 'Port A2', type: 'fiber' },
      { name: 'Port B1', type: 'fiber' },
      { name: 'Port B2', type: 'fiber' },
      { name: 'Yönetim', type: 'ethernet' },
      { name: 'Güç Girişi A', type: 'power_in' },
      { name: 'Güç Girişi B', type: 'power_in' },
    ],
    powerDraw: 480,
    weight: 32.0,
    ipAddress: '192.168.1.120',
    vlan: 'VLAN 50 (Storage)',
    notes: 'SSD tabanlı hızlı SAN depolama ünitesi.'
  },
  {
    name: 'Yüksek Kapasiteli NAS Depolama (3U)',
    model: 'Synology RS4021xs+',
    type: 'compute',
    subtype: 'storage',
    uSize: 3,
    ports: [
      { name: '10G RJ45 1', type: 'ethernet' },
      { name: '10G RJ45 2', type: 'ethernet' },
      { name: 'GbE Port 1', type: 'ethernet' },
      { name: 'GbE Port 2', type: 'ethernet' },
      { name: 'Güç Girişi A', type: 'power_in' },
      { name: 'Güç Girişi B', type: 'power_in' },
    ],
    powerDraw: 280,
    weight: 22.0,
    ipAddress: '192.168.1.121',
    vlan: 'VLAN 55 (Yedekleme)',
    notes: 'Büyük ölçekli veri depolama ve yedekleme için 16 yuvalı NAS ünitesi.'
  },
  {
    name: 'Synergy Blade Şasi Modülü',
    model: 'HPE Synergy 12000',
    type: 'compute',
    subtype: 'server',
    uSize: 10, // Big chassis!
    ports: [
      { name: 'Interconnect 1', type: 'fiber' },
      { name: 'Interconnect 2', type: 'fiber' },
      { name: 'Frame Link 1', type: 'ethernet' },
      { name: 'Frame Link 2', type: 'ethernet' },
      { name: 'Güç Girişi A1', type: 'power_in' },
      { name: 'Güç Girişi A2', type: 'power_in' },
      { name: 'Güç Girişi B1', type: 'power_in' },
      { name: 'Güç Girişi B2', type: 'power_in' },
    ],
    powerDraw: 1800, // Average composite load
    weight: 85.0, // Extremely heavy
    ipAddress: '192.168.12.1',
    vlan: 'Çoklu (Blade Dağıtımı)',
    notes: '12 adede kadar blade sunucuyu bir arada barındıran, bütünleşik depolama ve ağ modüllerine sahip 10U şasi.'
  },

  // --- ÇEVRESEL VE DÜZENLEYİCİ ---
  {
    name: 'KVM Konsol Çekmecesi',
    model: 'APC AP5717',
    type: 'accessory',
    subtype: 'blank',
    uSize: 1,
    ports: [
      { name: 'VGA Girişi', type: 'ethernet' },
      { name: 'USB Yönetim', type: 'ethernet' },
      { name: 'Güç Girişi', type: 'power_in' },
    ],
    powerDraw: 30,
    weight: 12.5,
    notes: 'Kabin içi lokal yönetim için entegre 17" LCD, klavye ve touchpad barındıran kızaklı raf ünitesi.'
  },
  {
    name: 'Kablo Düzenleyici',
    model: '1U Yatay Organizer',
    type: 'accessory',
    subtype: 'organizer',
    uSize: 1,
    ports: [],
    powerDraw: 0,
    weight: 1.0,
    notes: 'Kabin içi kablolama estetiği ve düzeni için fırçalı kapak.'
  },
  {
    name: 'Ortam İzleme Sensörü',
    model: 'APC NetBotz 250',
    type: 'accessory',
    subtype: 'blank',
    uSize: 1,
    ports: [
      { name: 'Sensör Port 1', type: 'ethernet' },
      { name: 'Sensör Port 2', type: 'ethernet' },
      { name: 'Ethernet', type: 'ethernet' },
      { name: 'Güç Girişi', type: 'power_in' },
    ],
    powerDraw: 15,
    weight: 1.2,
    ipAddress: '192.168.1.240',
    notes: 'Kabinet içi sıcaklık, nem, sıvı teması ve kapı durumunu takip eden IP tabanlı çevre izleme sistemi.'
  },
  {
    name: 'Kapama Paneli',
    model: '1U Boş Metal Kapak',
    type: 'accessory',
    subtype: 'blank',
    uSize: 1,
    ports: [],
    powerDraw: 0,
    weight: 0.5,
    notes: 'Soğutma performansını artırmak ve hava akışını düzenlemek için boşluk kapayıcı.'
  }
];

export const PRESET_TOPOLOGIES: SavedTopologyTemplate[] = [
  {
    name: 'Standart İşletme Kabini (Küçük/Orta)',
    description: '1 adet UPS, 1 adet akıllı PDU, FortiGate güvenlik duvarı, Omurga switch ve 2 adet Web sunucusu barındıran temel kurumsal yapı.',
    devices: [
      {
        id: 'dev-ups',
        name: 'Ana Kesintisiz Güç Kaynağı',
        model: 'APC Smart-UPS 3000',
        type: 'power',
        subtype: 'ups',
        uSize: 2,
        uPosition: 1, // Bottom of rack
        ports: [
          { id: 'p-u-in', name: 'Şebeke Girişi', type: 'power_in', connectedToCableId: null },
          { id: 'p-u-1', name: 'Çıkış 1 (C13)', type: 'power_out', connectedToCableId: 'cable-p1' },
          { id: 'p-u-2', name: 'Çıkış 2 (C13)', type: 'power_out', connectedToCableId: null },
          { id: 'p-u-3', name: 'Çıkış 3 (C13)', type: 'power_out', connectedToCableId: null },
          { id: 'p-u-4', name: 'Çıkış 4 (C13)', type: 'power_out', connectedToCableId: null },
          { id: 'p-u-5', name: 'Yüksek Akım 1 (C19)', type: 'power_out', connectedToCableId: null },
          { id: 'p-u-6', name: 'Yüksek Akım 2 (C19)', type: 'power_out', connectedToCableId: null },
        ],
        powerDraw: 50,
        powerLimit: 2700,
        weight: 38.6,
        ipAddress: '192.168.1.251',
        x: 100,
        y: 450,
      },
      {
        id: 'dev-pdu',
        name: 'Kabinet Akıllı PDU',
        model: 'APC AP8959',
        type: 'power',
        subtype: 'pdu',
        uSize: 1,
        uPosition: 3,
        ports: [
          { id: 'p-p-in', name: 'Giriş (C20)', type: 'power_in', connectedToCableId: 'cable-p1' },
          { id: 'p-p-1', name: 'Çıkış 1 (C13)', type: 'power_out', connectedToCableId: 'cable-ps1' },
          { id: 'p-p-2', name: 'Çıkış 2 (C13)', type: 'power_out', connectedToCableId: 'cable-ps2' },
          { id: 'p-p-3', name: 'Çıkış 3 (C13)', type: 'power_out', connectedToCableId: 'cable-p-sw' },
          { id: 'p-p-4', name: 'Çıkış 4 (C13)', type: 'power_out', connectedToCableId: 'cable-p-fw' },
          { id: 'p-p-5', name: 'Çıkış 5 (C13)', type: 'power_out', connectedToCableId: null },
          { id: 'p-p-6', name: 'Çıkış 6 (C13)', type: 'power_out', connectedToCableId: null },
          { id: 'p-p-7', name: 'Çıkış 7 (C19)', type: 'power_out', connectedToCableId: null },
          { id: 'p-p-8', name: 'Çıkış 8 (C19)', type: 'power_out', connectedToCableId: null },
        ],
        powerDraw: 15,
        powerLimit: 3680,
        weight: 3.2,
        ipAddress: '192.168.1.250',
        x: 100,
        y: 300,
      },
      {
        id: 'dev-fw',
        name: 'Kenar Güvenlik Duvarı',
        model: 'FortiGate 100F',
        type: 'network',
        subtype: 'firewall',
        uSize: 1,
        uPosition: 24, // Top of rack
        ports: [
          { id: 'p-fw-w1', name: 'WAN 1', type: 'ethernet', connectedToCableId: null },
          { id: 'p-fw-w2', name: 'WAN 2', type: 'ethernet', connectedToCableId: null },
          { id: 'p-fw-d', name: 'DMZ', type: 'ethernet', connectedToCableId: null },
          { id: 'p-fw-l1', name: 'LAN 1', type: 'ethernet', connectedToCableId: 'cable-fw-sw' },
          { id: 'p-fw-l2', name: 'LAN 2', type: 'ethernet', connectedToCableId: null },
          { id: 'p-fw-s1', name: 'SFP+ 1', type: 'fiber', connectedToCableId: null },
          { id: 'p-fw-s2', name: 'SFP+ 2', type: 'fiber', connectedToCableId: null },
          { id: 'p-fw-pa', name: 'Güç Girişi A', type: 'power_in', connectedToCableId: 'cable-p-fw' },
          { id: 'p-fw-pb', name: 'Güç Girişi B', type: 'power_in', connectedToCableId: null },
        ],
        powerDraw: 75,
        weight: 5.1,
        ipAddress: '192.168.1.254',
        x: 400,
        y: 80,
      },
      {
        id: 'dev-sw',
        name: 'Omurga Switch',
        model: 'Cisco Catalyst 9300',
        type: 'network',
        subtype: 'switch',
        uSize: 1,
        uPosition: 22,
        ports: [
          { id: 'p-sw-e1', name: 'GigEth 1/0/1', type: 'ethernet', connectedToCableId: 'cable-fw-sw' },
          { id: 'p-sw-e2', name: 'GigEth 1/0/2', type: 'ethernet', connectedToCableId: 'cable-srv1' },
          { id: 'p-sw-e3', name: 'GigEth 1/0/3', type: 'ethernet', connectedToCableId: 'cable-srv2' },
          { id: 'p-sw-e4', name: 'GigEth 1/0/4', type: 'ethernet', connectedToCableId: null },
          { id: 'p-sw-e5', name: 'GigEth 1/0/5', type: 'ethernet', connectedToCableId: null },
          { id: 'p-sw-e6', name: 'GigEth 1/0/6', type: 'ethernet', connectedToCableId: null },
          { id: 'p-sw-e7', name: 'GigEth 1/0/7', type: 'ethernet', connectedToCableId: null },
          { id: 'p-sw-e8', name: 'GigEth 1/0/8', type: 'ethernet', connectedToCableId: null },
          { id: 'p-sw-f1', name: 'TE 1/1/1', type: 'fiber', connectedToCableId: null },
          { id: 'p-sw-f2', name: 'TE 1/1/2', type: 'fiber', connectedToCableId: null },
          { id: 'p-sw-pa', name: 'Güç Girişi A', type: 'power_in', connectedToCableId: 'cable-p-sw' },
          { id: 'p-sw-pb', name: 'Güç Girişi B', type: 'power_in', connectedToCableId: null },
        ],
        powerDraw: 90,
        weight: 7.4,
        ipAddress: '192.168.1.2',
        x: 400,
        y: 220,
      },
      {
        id: 'dev-srv1',
        name: 'Uygulama Sunucusu (A)',
        model: 'Dell PowerEdge R650',
        type: 'compute',
        subtype: 'server',
        uSize: 1,
        uPosition: 14,
        ports: [
          { id: 'p-s1-l1', name: 'LOM 1', type: 'ethernet', connectedToCableId: 'cable-srv1' },
          { id: 'p-s1-l2', name: 'LOM 2', type: 'ethernet', connectedToCableId: null },
          { id: 'p-s1-id', name: 'iDRAC (Yön.)', type: 'ethernet', connectedToCableId: null },
          { id: 'p-s1-pa', name: 'Güç Girişi A (PSU1)', type: 'power_in', connectedToCableId: 'cable-ps1' },
          { id: 'p-s1-pb', name: 'Güç Girişi B (PSU2)', type: 'power_in', connectedToCableId: null },
        ],
        powerDraw: 350,
        weight: 18.2,
        ipAddress: '192.168.1.100',
        vlan: 'VLAN 30 (Sunucular)',
        x: 750,
        y: 150,
      },
      {
        id: 'dev-srv2',
        name: 'Veritabanı Sunucusu (B)',
        model: 'Dell PowerEdge R650',
        type: 'compute',
        subtype: 'server',
        uSize: 1,
        uPosition: 12,
        ports: [
          { id: 'p-s2-l1', name: 'LOM 1', type: 'ethernet', connectedToCableId: 'cable-srv2' },
          { id: 'p-s2-l2', name: 'LOM 2', type: 'ethernet', connectedToCableId: null },
          { id: 'p-s2-id', name: 'iDRAC (Yön.)', type: 'ethernet', connectedToCableId: null },
          { id: 'p-s2-pa', name: 'Güç Girişi A (PSU1)', type: 'power_in', connectedToCableId: 'cable-ps2' },
          { id: 'p-s2-pb', name: 'Güç Girişi B (PSU2)', type: 'power_in', connectedToCableId: null },
        ],
        powerDraw: 400,
        weight: 18.2,
        ipAddress: '192.168.1.101',
        vlan: 'VLAN 40 (Veritabanı)',
        x: 750,
        y: 350,
      },
    ],
    cables: [
      {
        id: 'cable-p1',
        fromDeviceId: 'dev-ups',
        fromPortId: 'p-u-1',
        toDeviceId: 'dev-pdu',
        toPortId: 'p-p-in',
        type: 'power_c19',
        color: '#ef4444', // Red
        length: 1.5,
        label: 'UPS - PDU Ana Besleme'
      },
      {
        id: 'cable-ps1',
        fromDeviceId: 'dev-pdu',
        fromPortId: 'p-p-1',
        toDeviceId: 'dev-srv1',
        toPortId: 'p-s1-pa',
        type: 'power_c13',
        color: '#000000', // Black
        length: 1.0,
        label: 'Sunucu A Güç Beslemesi'
      },
      {
        id: 'cable-ps2',
        fromDeviceId: 'dev-pdu',
        fromPortId: 'p-p-2',
        toDeviceId: 'dev-srv2',
        toPortId: 'p-s2-pa',
        type: 'power_c13',
        color: '#000000', // Black
        length: 1.0,
        label: 'Sunucu B Güç Beslemesi'
      },
      {
        id: 'cable-p-sw',
        fromDeviceId: 'dev-pdu',
        fromPortId: 'p-p-3',
        toDeviceId: 'dev-sw',
        toPortId: 'p-sw-pa',
        type: 'power_c13',
        color: '#000000', // Black
        length: 1.0,
        label: 'Switch Güç Beslemesi'
      },
      {
        id: 'cable-p-fw',
        fromDeviceId: 'dev-pdu',
        fromPortId: 'p-p-4',
        toDeviceId: 'dev-fw',
        toPortId: 'p-fw-pa',
        type: 'power_c13',
        color: '#000000', // Black
        length: 1.5,
        label: 'Güvenlik Duvarı Güç Beslemesi'
      },
      {
        id: 'cable-fw-sw',
        fromDeviceId: 'dev-fw',
        fromPortId: 'p-fw-l1',
        toDeviceId: 'dev-sw',
        toPortId: 'p-sw-e1',
        type: 'cat6',
        color: '#3b82f6', // Blue
        length: 0.5,
        label: 'FW LAN - Switch Uplink'
      },
      {
        id: 'cable-srv1',
        fromDeviceId: 'dev-sw',
        fromPortId: 'p-sw-e2',
        toDeviceId: 'dev-srv1',
        toPortId: 'p-s1-l1',
        type: 'cat6',
        color: '#3b82f6', // Blue
        length: 1.2,
        label: 'Sunucu A Ağ Bağlantısı'
      },
      {
        id: 'cable-srv2',
        fromDeviceId: 'dev-sw',
        fromPortId: 'p-sw-e3',
        toDeviceId: 'dev-srv2',
        toPortId: 'p-s2-l1',
        type: 'cat6',
        color: '#3b82f6', // Blue
        length: 1.2,
        label: 'Sunucu B Ağ Bağlantısı'
      },
    ]
  }
];

export interface SavedTopologyTemplate {
  name: string;
  description: string;
  devices: Device[];
  cables: Cable[];
}
