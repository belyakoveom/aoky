const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("./db");

const SECRET = process.env.JWT_SECRET || "aoky-dev-secret";

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: "30d" });
}

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(h.slice(7), SECRET); next(); }
  catch (e) { return res.status(401).json({ error: "Invalid token" }); }
}

async function register(req, res) {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email и пароль обязательны" });
  if (password.length < 6) return res.status(400).json({ error: "Пароль минимум 6 символов" });
  try {
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: "Email уже зарегистрирован" });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query("INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id,email,name,rate,tax_percent,show_earnings", [email.toLowerCase(), hash, name || email.split("@")[0]]);
    const u = r.rows[0];
    await pool.query("INSERT INTO clients(user_id,uid,name) VALUES($1,$2,$3)", [u.id, "c1", "Клиент 1"]);
    res.json({ token: signToken(u), user: { id: u.id, email: u.email, name: u.name, rate: u.rate, taxPercent: parseFloat(u.tax_percent), showEarnings: u.show_earnings } });
  } catch (e) { console.error(e); res.status(500).json({ error: "Server error" }); }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email и пароль обязательны" });
  try {
    const r = await pool.query("SELECT * FROM users WHERE email=$1", [email.toLowerCase()]);
    if (!r.rows.length) return res.status(401).json({ error: "Неверный email или пароль" });
    const u = r.rows[0];
    if (!(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: "Неверный email или пароль" });
    res.json({ token: signToken(u), user: { id: u.id, email: u.email, name: u.name, rate: u.rate, taxPercent: parseFloat(u.tax_percent), showEarnings: u.show_earnings } });
  } catch (e) { console.error(e); res.status(500).json({ error: "Server error" }); }
}

module.exports = { auth, register, login, signToken };
