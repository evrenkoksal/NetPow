import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "netpow.db");

app.use(express.json({ limit: "50mb" }));

let db: DatabaseSync;

// Helper function to initialize database and tables
function initDb() {
  db = new DatabaseSync(DB_PATH);

  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON;");

  // Create cabinets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cabinets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_u INTEGER NOT NULL DEFAULT 24,
      max_weight_kg INTEGER NOT NULL DEFAULT 800,
      max_power_w INTEGER NOT NULL DEFAULT 3680,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Create devices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      cabinet_id TEXT NOT NULL,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      type TEXT NOT NULL,
      subtype TEXT NOT NULL,
      u_size INTEGER NOT NULL,
      u_position INTEGER,
      ports TEXT NOT NULL,
      power_draw INTEGER NOT NULL,
      power_limit INTEGER,
      weight REAL NOT NULL,
      ip_address TEXT,
      vlan TEXT,
      notes TEXT,
      is_redundant INTEGER DEFAULT 0,
      is_external INTEGER DEFAULT 0,
      x REAL NOT NULL,
      y REAL NOT NULL,
      FOREIGN KEY(cabinet_id) REFERENCES cabinets(id) ON DELETE CASCADE
    );
  `);

  // Ensure is_external column exists on existing databases (backward compatibility)
  try {
    db.exec("ALTER TABLE devices ADD COLUMN is_external INTEGER DEFAULT 0;");
  } catch (e) {
    // Column already exists or table does not exist yet (handled above)
  }

  // Create cables table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cables (
      id TEXT PRIMARY KEY,
      cabinet_id TEXT NOT NULL,
      from_device_id TEXT NOT NULL,
      from_port_id TEXT NOT NULL,
      to_device_id TEXT NOT NULL,
      to_port_id TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT NOT NULL,
      length REAL NOT NULL,
      label TEXT,
      FOREIGN KEY(cabinet_id) REFERENCES cabinets(id) ON DELETE CASCADE
    );
  `);

  // Check if any cabinets exist, if not, create a default cabinet with some initial data
  const cabinetCountResult = db.prepare("SELECT COUNT(*) as count FROM cabinets").get() as any;
  if (cabinetCountResult && cabinetCountResult.count === 0) {
    const now = new Date().toISOString();
    const defaultCabinetId = "default-cabinet";
    db.prepare(
      `INSERT INTO cabinets (id, name, total_u, max_weight_kg, max_power_w, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(defaultCabinetId, "Sistem Odası Kabini - A", 24, 800, 3680, now, now);

    // Initial devices for standard enterprise preset
    const initialDevices = [
      {
        id: "dev-ups",
        cabinet_id: defaultCabinetId,
        name: "Ana Kesintisiz Güç Kaynağı",
        model: "APC Smart-UPS 3000",
        type: "power",
        subtype: "ups",
        u_size: 2,
        u_position: 1,
        ports: JSON.stringify([
          { id: "p-u-in", name: "Şebeke Girişi", type: "power_in", connectedToCableId: null },
          { id: "p-u-1", name: "Çıkış 1 (C13)", type: "power_out", connectedToCableId: "cable-p1" },
          { id: "p-u-2", name: "Çıkış 2 (C13)", type: "power_out", connectedToCableId: null },
          { id: "p-u-3", name: "Çıkış 3 (C13)", type: "power_out", connectedToCableId: null },
          { id: "p-u-4", name: "Çıkış 4 (C13)", type: "power_out", connectedToCableId: null },
          { id: "p-u-5", name: "Yüksek Akım 1 (C19)", type: "power_out", connectedToCableId: null },
          { id: "p-u-6", name: "Yüksek Akım 2 (C19)", type: "power_out", connectedToCableId: null },
        ]),
        power_draw: 50,
        power_limit: 2700,
        weight: 38.6,
        ip_address: "192.168.1.251",
        vlan: "",
        notes: "",
        is_redundant: 0,
        x: 100,
        y: 450,
      },
      {
        id: "dev-pdu",
        cabinet_id: defaultCabinetId,
        name: "Kabinet Akıllı PDU",
        model: "APC AP8959",
        type: "power",
        subtype: "pdu",
        u_size: 1,
        u_position: 3,
        ports: JSON.stringify([
          { id: "p-p-in", name: "Giriş (C20)", type: "power_in", connectedToCableId: "cable-p1" },
          { id: "p-p-1", name: "Çıkış 1 (C13)", type: "power_out", connectedToCableId: "cable-ps1" },
          { id: "p-p-2", name: "Çıkış 2 (C13)", type: "power_out", connectedToCableId: "cable-ps2" },
          { id: "p-p-3", name: "Çıkış 3 (C13)", type: "power_out", connectedToCableId: "cable-p-sw" },
          { id: "p-p-4", name: "Çıkış 4 (C13)", type: "power_out", connectedToCableId: "cable-p-fw" },
          { id: "p-p-5", name: "Çıkış 5 (C13)", type: "power_out", connectedToCableId: null },
          { id: "p-p-6", name: "Çıkış 6 (C13)", type: "power_out", connectedToCableId: null },
          { id: "p-p-7", name: "Çıkış 7 (C19)", type: "power_out", connectedToCableId: null },
          { id: "p-p-8", name: "Çıkış 8 (C19)", type: "power_out", connectedToCableId: null },
        ]),
        power_draw: 15,
        power_limit: 3680,
        weight: 3.2,
        ip_address: "192.168.1.252",
        vlan: "",
        notes: "",
        is_redundant: 0,
        x: 350,
        y: 450,
      },
    ];

    const insertDev = db.prepare(`
      INSERT INTO devices (id, cabinet_id, name, model, type, subtype, u_size, u_position, ports, power_draw, power_limit, weight, ip_address, vlan, notes, is_redundant, x, y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const dev of initialDevices) {
      insertDev.run(
        dev.id,
        dev.cabinet_id,
        dev.name,
        dev.model,
        dev.type,
        dev.subtype,
        dev.u_size,
        dev.u_position,
        dev.ports,
        dev.power_draw,
        dev.power_limit,
        dev.weight,
        dev.ip_address,
        dev.vlan,
        dev.notes,
        dev.is_redundant,
        dev.x,
        dev.y
      );
    }

    // Initial cables
    const initialCables = [
      {
        id: "cable-p1",
        cabinet_id: defaultCabinetId,
        from_device_id: "dev-ups",
        from_port_id: "p-u-1",
        to_device_id: "dev-pdu",
        to_port_id: "p-p-in",
        type: "power_c19",
        color: "#000000",
        length: 1.0,
        label: "PDU Ana Güç",
      },
    ];

    const insertCable = db.prepare(`
      INSERT INTO cables (id, cabinet_id, from_device_id, from_port_id, to_device_id, to_port_id, type, color, length, label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const cab of initialCables) {
      insertCable.run(
        cab.id,
        cab.cabinet_id,
        cab.from_device_id,
        cab.from_port_id,
        cab.to_device_id,
        cab.to_port_id,
        cab.type,
        cab.color,
        cab.length,
        cab.label
      );
    }
  }
}

// REST API Endpoints

// 1. Get all cabinets
app.get("/api/cabinets", (req, res) => {
  try {
    const cabinets = db.prepare(`
      SELECT c.*, COUNT(d.id) as device_count 
      FROM cabinets c 
      LEFT JOIN devices d ON c.id = d.cabinet_id 
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();
    res.json(cabinets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get active state data for a cabinet (devices, cables, settings)
app.get("/api/cabinets/:id/data", (req, res) => {
  const cabinetId = req.params.id;
  try {
    const cabinet = db.prepare("SELECT * FROM cabinets WHERE id = ?").get(cabinetId) as any;
    if (!cabinet) {
      return res.status(404).json({ error: "Cabinet not found" });
    }

    const devicesRaw = db.prepare("SELECT * FROM devices WHERE cabinet_id = ?").all(cabinetId) as any[];
    const cablesRaw = db.prepare("SELECT * FROM cables WHERE cabinet_id = ?").all(cabinetId) as any[];

    const devices = devicesRaw.map((d: any) => ({
      id: d.id,
      name: d.name,
      model: d.model,
      type: d.type,
      subtype: d.subtype,
      uSize: d.u_size,
      uPosition: d.u_position,
      ports: JSON.parse(d.ports),
      powerDraw: d.power_draw,
      powerLimit: d.power_limit,
      weight: d.weight,
      ipAddress: d.ip_address || "",
      vlan: d.vlan || "",
      notes: d.notes || "",
      isRedundant: d.is_redundant === 1,
      isExternal: d.is_external === 1,
      x: d.x,
      y: d.y,
    }));

    const cables = cablesRaw.map((c: any) => ({
      id: c.id,
      fromDeviceId: c.from_device_id,
      fromPortId: c.from_port_id,
      toDeviceId: c.to_device_id,
      toPortId: c.to_port_id,
      type: c.type,
      color: c.color,
      length: c.length,
      label: c.label || "",
    }));

    res.json({
      cabinetId: cabinet.id,
      name: cabinet.name,
      rackSettings: {
        totalU: cabinet.total_u,
        maxWeightKg: cabinet.max_weight_kg,
        maxPowerW: cabinet.max_power_w,
      },
      devices,
      cables,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create a new cabinet
app.post("/api/cabinets", (req, res) => {
  const { name, totalU, maxWeightKg, maxPowerW } = req.body;
  const id = "cab-" + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO cabinets (id, name, total_u, max_weight_kg, max_power_w, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name || "Yeni Kabin",
      totalU || 24,
      maxWeightKg || 800,
      maxPowerW || 3680,
      now,
      now
    );

    const newCab = db.prepare("SELECT * FROM cabinets WHERE id = ?").get(id);
    res.status(211).json(newCab);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update cabinet name and basic settings
app.put("/api/cabinets/:id", (req, res) => {
  const cabinetId = req.params.id;
  const { name, totalU, maxWeightKg, maxPowerW } = req.body;
  const now = new Date().toISOString();

  try {
    const exists = db.prepare("SELECT 1 FROM cabinets WHERE id = ?").get(cabinetId);
    if (!exists) {
      return res.status(404).json({ error: "Cabinet not found" });
    }

    db.prepare(
      `UPDATE cabinets 
       SET name = ?, total_u = ?, max_weight_kg = ?, max_power_w = ?, updated_at = ?
       WHERE id = ?`
    ).run(name, totalU, maxWeightKg, maxPowerW, now, cabinetId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Save all cabinet's inner data (devices, cables, settings atomic save)
app.post("/api/cabinets/:id/data", (req, res) => {
  const cabinetId = req.params.id;
  const { devices, cables, rackSettings, name } = req.body;
  const now = new Date().toISOString();

  try {
    const exists = db.prepare("SELECT 1 FROM cabinets WHERE id = ?").get(cabinetId);
    if (!exists) {
      return res.status(404).json({ error: "Cabinet not found" });
    }

    // Begin Transaction
    db.exec("BEGIN TRANSACTION;");

    // Update cabinet settings
    db.prepare(
      `UPDATE cabinets 
       SET name = ?, total_u = ?, max_weight_kg = ?, max_power_w = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      rackSettings.totalU,
      rackSettings.maxWeightKg,
      rackSettings.maxPowerW,
      now,
      cabinetId
    );

    // Wipe existing devices and cables for this cabinet
    db.prepare("DELETE FROM devices WHERE cabinet_id = ?").run(cabinetId);
    db.prepare("DELETE FROM cables WHERE cabinet_id = ?").run(cabinetId);

    // Bulk insert devices
    if (devices && devices.length > 0) {
      const devStmt = db.prepare(`
        INSERT INTO devices (id, cabinet_id, name, model, type, subtype, u_size, u_position, ports, power_draw, power_limit, weight, ip_address, vlan, notes, is_redundant, is_external, x, y)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const dev of devices) {
        devStmt.run(
          dev.id,
          cabinetId,
          dev.name,
          dev.model,
          dev.type,
          dev.subtype,
          dev.uSize,
          dev.uPosition !== undefined && dev.uPosition !== null ? dev.uPosition : null,
          JSON.stringify(dev.ports),
          dev.powerDraw,
          dev.powerLimit !== undefined && dev.powerLimit !== null ? dev.powerLimit : null,
          dev.weight,
          dev.ipAddress !== undefined && dev.ipAddress !== null ? dev.ipAddress : null,
          dev.vlan !== undefined && dev.vlan !== null ? dev.vlan : null,
          dev.notes !== undefined && dev.notes !== null ? dev.notes : null,
          dev.isRedundant ? 1 : 0,
          dev.isExternal ? 1 : 0,
          dev.x,
          dev.y
        );
      }
    }

    // Bulk insert cables
    if (cables && cables.length > 0) {
      const cabStmt = db.prepare(`
        INSERT INTO cables (id, cabinet_id, from_device_id, from_port_id, to_device_id, to_port_id, type, color, length, label)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const cab of cables) {
        cabStmt.run(
          cab.id,
          cabinetId,
          cab.fromDeviceId,
          cab.fromPortId,
          cab.toDeviceId,
          cab.toPortId,
          cab.type,
          cab.color,
          cab.length,
          cab.label !== undefined && cab.label !== null ? cab.label : null
        );
      }
    }

    // Commit
    db.exec("COMMIT;");
    res.json({ success: true });
  } catch (error: any) {
    try {
      db.exec("ROLLBACK;");
    } catch (e) {}
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete a cabinet
app.delete("/api/cabinets/:id", (req, res) => {
  const cabinetId = req.params.id;
  try {
    const cabinet = db.prepare("SELECT id FROM cabinets WHERE id = ?").get(cabinetId);
    if (!cabinet) {
      return res.status(404).json({ error: "Cabinet not found" });
    }

    // This triggers cascade deletes in devices & cables due to foreign key constraint
    db.prepare("DELETE FROM cabinets WHERE id = ?").run(cabinetId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Database Backup - Download complete database state as JSON
app.get("/api/db/backup", (req, res) => {
  try {
    const cabinets = db.prepare("SELECT * FROM cabinets").all();
    const devices = db.prepare("SELECT * FROM devices").all();
    const cables = db.prepare("SELECT * FROM cables").all();

    const backupData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      cabinets,
      devices: devices.map((d: any) => ({
        ...d,
        ports: JSON.parse(d.ports), // Normalize ports representation
      })),
      cables,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="netpow_backup_${new Date().toISOString().split("T")[0]}.json"`
    );
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Database Restore - Restore complete database state from JSON upload
app.post("/api/db/restore", (req, res) => {
  const { cabinets, devices, cables } = req.body;

  if (!cabinets || !Array.isArray(cabinets)) {
    return res.status(400).json({ error: "Invalid backup format: cabinets array is missing" });
  }

  try {
    db.exec("BEGIN TRANSACTION;");

    // Clear all existing data
    db.prepare("DELETE FROM cables;").run();
    db.prepare("DELETE FROM devices;").run();
    db.prepare("DELETE FROM cabinets;").run();

    // Insert restored cabinets
    const insertCab = db.prepare(
      `INSERT INTO cabinets (id, name, total_u, max_weight_kg, max_power_w, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const cab of cabinets) {
      insertCab.run(
        cab.id,
        cab.name,
        cab.total_u || cab.totalU || 24,
        cab.max_weight_kg || cab.maxWeightKg || 800,
        cab.max_power_w || cab.maxPowerW || 3680,
        cab.created_at || new Date().toISOString(),
        cab.updated_at || new Date().toISOString()
      );
    }

    // Insert restored devices
    if (devices && Array.isArray(devices)) {
      const insertDev = db.prepare(
        `INSERT INTO devices (id, cabinet_id, name, model, type, subtype, u_size, u_position, ports, power_draw, power_limit, weight, ip_address, vlan, notes, is_redundant, is_external, x, y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const dev of devices) {
        const uPos = dev.u_position !== undefined && dev.u_position !== null ? dev.u_position : (dev.uPosition !== undefined && dev.uPosition !== null ? dev.uPosition : null);
        const pDraw = dev.power_draw !== undefined && dev.power_draw !== null ? dev.power_draw : (dev.powerDraw !== undefined && dev.powerDraw !== null ? dev.powerDraw : 0);
        const pLimit = dev.power_limit !== undefined && dev.power_limit !== null ? dev.power_limit : (dev.powerLimit !== undefined && dev.powerLimit !== null ? dev.powerLimit : null);
        const ip = dev.ip_address !== undefined && dev.ip_address !== null ? dev.ip_address : (dev.ipAddress !== undefined && dev.ipAddress !== null ? dev.ipAddress : null);
        const vl = dev.vlan !== undefined && dev.vlan !== null ? dev.vlan : (dev.vlan !== undefined && dev.vlan !== null ? dev.vlan : null);
        const nt = dev.notes !== undefined && dev.notes !== null ? dev.notes : (dev.notes !== undefined && dev.notes !== null ? dev.notes : null);
        const isRed = dev.is_redundant !== undefined && dev.is_redundant !== null ? dev.is_redundant : (dev.isRedundant !== undefined && dev.isRedundant !== null ? dev.isRedundant : 0);
        const isExt = dev.is_external !== undefined && dev.is_external !== null ? dev.is_external : (dev.isExternal !== undefined && dev.isExternal !== null ? dev.isExternal : 0);

        insertDev.run(
          dev.id,
          dev.cabinet_id || dev.cabinetId,
          dev.name,
          dev.model,
          dev.type,
          dev.subtype,
          dev.u_size || dev.uSize || 1,
          uPos,
          typeof dev.ports === "string" ? dev.ports : JSON.stringify(dev.ports),
          pDraw,
          pLimit,
          dev.weight,
          ip,
          vl,
          nt,
          isRed ? 1 : 0,
          isExt ? 1 : 0,
          dev.x,
          dev.y
        );
      }
    }

    // Insert restored cables
    if (cables && Array.isArray(cables)) {
      const insertCable = db.prepare(
        `INSERT INTO cables (id, cabinet_id, from_device_id, from_port_id, to_device_id, to_port_id, type, color, length, label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const cab of cables) {
        insertCable.run(
          cab.id,
          cab.cabinet_id || cab.cabinetId,
          cab.from_device_id || cab.fromDeviceId,
          cab.from_port_id || cab.fromPortId,
          cab.to_device_id || cab.toDeviceId,
          cab.to_port_id || cab.toPortId,
          cab.type,
          cab.color,
          cab.length,
          cab.label !== undefined && cab.label !== null ? cab.label : null
        );
      }
    }

    db.exec("COMMIT;");
    res.json({ success: true });
  } catch (error: any) {
    try {
      db.exec("ROLLBACK;");
    } catch (e) {}
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  initDb();

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server", err);
});
