const express = require("express");
const cors = require("cors");
const { pool, ensureMigrated } = require("./db");
const { auth, register, login } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

// Auto-migrate on first request
app.use(async (req, res, next) => { try { await ensureMigrated(); next(); } catch (e) { console.error("Migration error:", e); res.status(500).json({ error: "DB init failed" }); } });

// ── Auth ──
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);
app.get("/api/auth/me", auth, async (req, res) => {
  const r = await pool.query("SELECT id,email,name,rate,tax_percent,show_earnings FROM users WHERE id=$1", [req.user.id]);
  if (!r.rows.length) return res.status(404).json({ error: "Not found" });
  const u = r.rows[0];
  res.json({ id: u.id, email: u.email, name: u.name, rate: u.rate, taxPercent: parseFloat(u.tax_percent), showEarnings: u.show_earnings });
});

// ── Settings ──
app.put("/api/settings", auth, async (req, res) => {
  const { rate, taxPercent, showEarnings, name } = req.body;
  const f = [], v = []; let i = 1;
  if (rate !== undefined) { f.push("rate=$" + i++); v.push(rate); }
  if (taxPercent !== undefined) { f.push("tax_percent=$" + i++); v.push(taxPercent); }
  if (showEarnings !== undefined) { f.push("show_earnings=$" + i++); v.push(showEarnings); }
  if (name !== undefined) { f.push("name=$" + i++); v.push(name); }
  if (!f.length) return res.json({ ok: true });
  v.push(req.user.id);
  await pool.query("UPDATE users SET " + f.join(",") + " WHERE id=$" + i, v);
  res.json({ ok: true });
});

// ── Clients ──
app.get("/api/clients", auth, async (req, res) => { res.json((await pool.query("SELECT uid as id,name FROM clients WHERE user_id=$1 ORDER BY created_at", [req.user.id])).rows); });
app.post("/api/clients", auth, async (req, res) => {
  const { id, name } = req.body;
  await pool.query("INSERT INTO clients(user_id,uid,name) VALUES($1,$2,$3)", [req.user.id, id, name]);
  res.json({ id, name });
});
app.delete("/api/clients/:uid", auth, async (req, res) => {
  await pool.query("DELETE FROM clients WHERE user_id=$1 AND uid=$2", [req.user.id, req.params.uid]);
  res.json({ ok: true });
});

// ── Projects ──
app.get("/api/projects", auth, async (req, res) => { res.json((await pool.query("SELECT uid as id,client_uid as \"clientId\",name,archived FROM projects WHERE user_id=$1 ORDER BY created_at", [req.user.id])).rows); });
app.post("/api/projects", auth, async (req, res) => {
  const { id, name, clientId } = req.body;
  await pool.query("INSERT INTO projects(user_id,uid,client_uid,name) VALUES($1,$2,$3,$4)", [req.user.id, id, clientId, name]);
  res.json({ id, name, clientId, archived: false });
});
app.put("/api/projects/:uid", auth, async (req, res) => {
  const { archived, name } = req.body;
  const f = [], v = []; let i = 1;
  if (archived !== undefined) { f.push("archived=$" + i++); v.push(archived); }
  if (name !== undefined) { f.push("name=$" + i++); v.push(name); }
  if (!f.length) return res.json({ ok: true });
  v.push(req.user.id, req.params.uid);
  await pool.query("UPDATE projects SET " + f.join(",") + " WHERE user_id=$" + i++ + " AND uid=$" + i, v);
  res.json({ ok: true });
});
app.delete("/api/projects/:uid", auth, async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE user_id=$1 AND project_uid=$2", [req.user.id, req.params.uid]);
  await pool.query("DELETE FROM projects WHERE user_id=$1 AND uid=$2", [req.user.id, req.params.uid]);
  res.json({ ok: true });
});
app.post("/api/projects/bulk-archive", auth, async (req, res) => {
  const { ids } = req.body;
  const ph = ids.map((_, i) => "$" + (i + 2)).join(",");
  await pool.query("UPDATE projects SET archived=true WHERE user_id=$1 AND uid IN(" + ph + ")", [req.user.id, ...ids]);
  res.json({ ok: true });
});
app.post("/api/projects/bulk-delete", auth, async (req, res) => {
  const { ids } = req.body;
  const ph = ids.map((_, i) => "$" + (i + 2)).join(",");
  await pool.query("DELETE FROM sessions WHERE user_id=$1 AND project_uid IN(" + ph + ")", [req.user.id, ...ids]);
  await pool.query("DELETE FROM projects WHERE user_id=$1 AND uid IN(" + ph + ")", [req.user.id, ...ids]);
  res.json({ ok: true });
});

// ── Sessions ──
app.get("/api/sessions", auth, async (req, res) => {
  const r = await pool.query("SELECT uid as id,project_uid as \"projectId\",duration,date,EXTRACT(EPOCH FROM created_at)::bigint*1000 as timestamp FROM sessions WHERE user_id=$1 ORDER BY created_at", [req.user.id]);
  r.rows.forEach(function(row) { row.duration = parseInt(row.duration); row.timestamp = parseInt(row.timestamp); });
  res.json(r.rows);
});
app.post("/api/sessions", auth, async (req, res) => {
  const { id, projectId, duration, date } = req.body;
  await pool.query("INSERT INTO sessions(user_id,uid,project_uid,duration,date) VALUES($1,$2,$3,$4,$5)", [req.user.id, id, projectId, duration, date]);
  res.json({ id, projectId, duration, date });
});
app.delete("/api/sessions/:uid", auth, async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE user_id=$1 AND uid=$2", [req.user.id, req.params.uid]);
  res.json({ ok: true });
});

// ── All data ──
app.get("/api/data", auth, async (req, res) => {
  const [uR, cR, pR, sR] = await Promise.all([
    pool.query("SELECT id,email,name,rate,tax_percent,show_earnings FROM users WHERE id=$1", [req.user.id]),
    pool.query("SELECT uid as id,name FROM clients WHERE user_id=$1 ORDER BY created_at", [req.user.id]),
    pool.query("SELECT uid as id,client_uid as \"clientId\",name,archived FROM projects WHERE user_id=$1 ORDER BY created_at", [req.user.id]),
    pool.query("SELECT uid as id,project_uid as \"projectId\",duration,date,EXTRACT(EPOCH FROM created_at)::bigint*1000 as timestamp FROM sessions WHERE user_id=$1 ORDER BY created_at", [req.user.id]),
  ]);
  const u = uR.rows[0];
  sR.rows.forEach(function(r) { r.duration = parseInt(r.duration); r.timestamp = parseInt(r.timestamp); });
  res.json({ user: { id: u.id, email: u.email, name: u.name }, rate: u.rate, taxPercent: parseFloat(u.tax_percent), showEarnings: u.show_earnings, clients: cR.rows, projects: pR.rows, sessions: sR.rows });
});

module.exports = app;
