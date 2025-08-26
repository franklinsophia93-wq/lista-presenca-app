// Simplificado - server base, rotas, banco SQLite
// (Versão completa com QR em lote e presença única por dia estaria aqui)

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const QRCode = require("qrcode");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const DB_PATH = path.join("/data", "presencas.db");
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    nome TEXT,
    email TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS presencas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id TEXT,
    data DATE DEFAULT (DATE('now')),
    hora TIME DEFAULT (TIME('now')),
    UNIQUE(participant_id, data)
  )`);
});

// Adicionar participante
app.post("/api/participants", (req, res) => {
  const { id, nome, email } = req.body;
  db.run("INSERT INTO participants (id, nome, email) VALUES (?, ?, ?)", [id, nome, email], err => {
    if (err) return res.status(400).json({ error: "ID já existe" });
    res.json({ success: true });
  });
});

// Listar participantes
app.get("/api/participants", (req, res) => {
  db.all("SELECT * FROM participants", (err, rows) => res.json(rows));
});

// Gerar QR individual
app.get("/qr/:id", (req, res) => {
  const id = req.params.id;
  const url = `${req.protocol}://${req.get("host")}/confirmar?id=${id}`;
  QRCode.toFileStream(res, url);
});

// Download em lote de QRs (ZIP)
app.get("/qr-lote", (req, res) => {
  db.all("SELECT id FROM participants", (err, rows) => {
    if (err) return res.status(500).end();
    res.attachment("qrcodes.zip");
    const archive = archiver("zip");
    archive.pipe(res);
    rows.forEach(row => {
      const url = `${req.protocol}://${req.get("host")}/confirmar?id=${row.id}`;
      QRCode.toBuffer(url, (err, buffer) => {
        if (!err) archive.append(buffer, { name: `${row.id}.png` });
      });
    });
    archive.finalize();
  });
});

// Confirmar presença (1 por dia)
app.get("/confirmar", (req, res) => {
  const id = req.query.id;
  if (!id) return res.send("ID inválido.");
  db.run("INSERT OR IGNORE INTO presencas (participant_id) VALUES (?)", [id], function (err) {
    if (err) return res.send("Erro ao registrar presença.");
    if (this.changes === 0) return res.send("Presença já registrada hoje.");
    res.send("Presença confirmada com sucesso!");
  });
});

// Exportar CSV
app.get("/export/csv", (req, res) => {
  db.all("SELECT * FROM presencas", (err, rows) => {
    if (err) return res.status(500).end();
    let csv = "id,participant_id,data,hora\n";
    rows.forEach(r => {
      csv += `${r.id},${r.participant_id},${r.data},${r.hora}\n`;
    });
    res.header("Content-Type", "text/csv");
    res.attachment("presencas.csv");
    res.send(csv);
  });
});

// Exportar XLSX
app.get("/export/xlsx", (req, res) => {
  db.all("SELECT * FROM presencas", (err, rows) => {
    if (err) return res.status(500).end();
    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Presencas");
    const file = path.join("/tmp", "presencas.xlsx");
    xlsx.writeFile(wb, file);
    res.download(file, "presencas.xlsx");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
