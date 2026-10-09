const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT_HTTP = process.env.PORT || 80;
// Por defecto usa las mismas rutas de siempre; las pruebas las sobreescriben
// con variables de entorno para no tocar tu database.sqlite real.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database.sqlite");
const BACKUP_PATH =
  process.env.BACKUP_PATH || path.join(__dirname, "backup.sqlite");

app.use(express.json());
app.use(cors());

// --- BASE DE DATOS ---
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("Error al abrir la base de datos:", err);
  else {
    db.run(`CREATE TABLE IF NOT EXISTS tareas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            completada BOOLEAN NOT NULL DEFAULT 0
        )`);
  }
});

const formatResponse = (statusCode, data) => ({
  statusCode,
  data: Array.isArray(data)
    ? data
    : data !== null && data !== undefined
      ? [data]
      : [],
});

// ==========================================
// ENDPOINTS HTTP
// ==========================================
app.get("/api/tareas", (req, res) => {
  db.all("SELECT * FROM tareas", [], (err, rows) => {
    if (err) return res.status(500).json(formatResponse(500, []));
    res.status(200).json(formatResponse(200, rows));
  });
});

app.get("/api/tareas/:id", (req, res) => {
  db.get("SELECT * FROM tareas WHERE id = ?", [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json(formatResponse(404, []));
    res.status(200).json(formatResponse(200, row));
  });
});

app.post("/api/tareas", (req, res) => {
  const { titulo } = req.body;
  db.run(
    "INSERT INTO tareas (titulo, completada) VALUES (?, ?)",
    [titulo, 0],
    function (err) {
      if (err) return res.status(500).json(formatResponse(500, []));
      res
        .status(201)
        .json(formatResponse(201, { id: this.lastID, titulo, completada: 0 }));
    },
  );
});

app.put("/api/tareas/:id", (req, res) => {
  const { titulo, completada } = req.body;
  db.run(
    "UPDATE tareas SET titulo = ?, completada = ? WHERE id = ?",
    [titulo, completada, req.params.id],
    function (err) {
      if (err || this.changes === 0)
        return res.status(404).json(formatResponse(404, []));
      res
        .status(200)
        .json(formatResponse(200, { id: req.params.id, titulo, completada }));
    },
  );
});

app.delete("/api/tareas/:id", (req, res) => {
  db.run("DELETE FROM tareas WHERE id = ?", [req.params.id], function (err) {
    if (err || this.changes === 0)
      return res.status(404).json(formatResponse(404, []));
    res.status(200).json(formatResponse(200, { message: "Tarea eliminada" }));
  });
});

app.post("/api/database/backup", (req, res) => {
  try {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    res
      .status(200)
      .json(formatResponse(200, { message: "Backup realizado exitosamente" }));
  } catch (error) {
    res.status(500).json(formatResponse(500, []));
  }
});

app.get("/api/database/descargar-backup", (req, res) => {
  if (fs.existsSync(BACKUP_PATH)) {
    res.download(BACKUP_PATH, "backup_aws.sqlite");
  } else {
    res.status(404).json(
      formatResponse(404, {
        message: "El backup no existe. Ejecuta el POST de backup primero.",
      }),
    );
  }
});

app.delete("/api/database/vaciar", (req, res) => {
  db.run("DELETE FROM tareas", [], function (err) {
    if (err) return res.status(500).json(formatResponse(500, []));
    db.run('DELETE FROM sqlite_sequence WHERE name="tareas"', () => {
      res
        .status(200)
        .json(formatResponse(200, { message: "Base de datos vaciada" }));
    });
  });
});
app.get("/api/health", (req, res) => {
  res.status(200).json(
    formatResponse(200, {
      status: "OK",
      message: "todo bien mensaje 1",
      timestamp: new Date(),
    }),
  );
});

app.get("/api/stats", (req, res) => {
  db.get("SELECT COUNT(*) as total FROM tareas", [], (err, row) => {
    if (err) return res.status(500).json(formatResponse(500, []));
    res.status(200).json(formatResponse(200, row));
  });
});

app.post("/api/database/seed", (req, res) => {
  const stmt = db.prepare(
    "INSERT INTO tareas (titulo, completada) VALUES (?, ?)",
  );
  stmt.run("Aprender Docker", 1);
  stmt.run("Desplegar en AWS EC2", 0);
  // Respondemos hasta que terminen los inserts (antes respondía demasiado pronto)
  stmt.finalize(() => {
    res
      .status(201)
      .json(formatResponse(201, { message: "Datos de prueba insertados" }));
  });
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
// Solo abre el puerto cuando ejecutas `node index.js` (o Docker).
// Cuando Jest hace require("./index"), NO se abre ningún puerto.
if (require.main === module) {
  app.listen(PORT_HTTP, () => {
    console.log(`Servidor HTTP escuchando en el puerto ${PORT_HTTP}`);
  });
}

module.exports = { app, db };
