/*
 Minimal backend (file-based storage using lowdb)
 Endpoints:
  - POST /api/auth/register   { email, password, name, role } -> { token, user }
  - POST /api/auth/login      { email, password } -> { token, user }
  - GET  /api/requests        -> list emergency requests
  - POST /api/requests       -> create request {requester_name, phone, blood_group, city, state, notes}
  - GET  /api/ngo/posts      -> list NGO posts
  - POST /api/ngo/posts      -> (auth token required, role ngo) create post with photo upload (field name "photo")
  - GET  /api/admin/stats    -> (admin only) counts
*/
require("dotenv").config();
const express = require("express");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

const app = express();
app.use(express.json());

// storage for uploads
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

// lowdb setup (db.json inside backend) - provide default data on creation
const adapter = new JSONFile(path.join(__dirname, "db.json"));
const defaultData = { users: [], requests: [], posts: [] };
const db = new Low(adapter, defaultData);

async function initDB() {
  await db.read();
  db.data = db.data || defaultData;
  await db.write();
}
initDB();

// multer for single file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random()*1e9);
    const ext = path.extname(file.originalname) || "";
    cb(null, `${file.fieldname}-${unique}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// helpers
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
}
async function findUserByEmail(email) {
  await db.read();
  return db.data.users.find(u => u.email.toLowerCase() === (email||"").toLowerCase());
}
async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "missing auth" });
  const token = h.replace("Bearer ", "");
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (e) {
    return res.status(401).json({ error: "invalid token" });
  }
}

// ---------- Auth ----------
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email & password required" });
  const existing = await findUserByEmail(email);
  if (existing) return res.status(400).json({ error: "email already registered" });
  const hash = bcrypt.hashSync(password, 10);
  await db.read();
  const id = (db.data.users.length ? Math.max(...db.data.users.map(u => u.id)) : 0) + 1;
  const user = { id, email, password_hash: hash, name: name || null, role: role || "ngo", created_at: new Date().toISOString() };
  db.data.users.push(user);
  await db.write();
  const token = signToken(user);
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email & password required" });
  const user = await findUserByEmail(email);
  if (!user) return res.status(400).json({ error: "invalid credentials" });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: "invalid credentials" });
  const token = signToken(user);
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
});

// ---------- Emergency requests ----------
app.get("/api/requests", async (req, res) => {
  await db.read();
  res.json({ ok: true, requests: db.data.requests.slice().reverse() });
});

app.post("/api/requests", async (req, res) => {
  const { requester_name, phone, blood_group, city, state, notes } = req.body;
  if (!phone || !blood_group || !city) return res.status(400).json({ error: "phone, blood_group and city required" });
  await db.read();
  const id = (db.data.requests.length ? Math.max(...db.data.requests.map(r => r.id)) : 0) + 1;
  const rec = { id, requester_name: requester_name || "Anonymous", phone, blood_group, city, state: state || "", notes: notes || "", status: "open", created_at: new Date().toISOString() };
  db.data.requests.push(rec);
  await db.write();
  res.json({ ok: true, request: rec });
});

// ---------- NGO posts (photo uploads) ----------
app.get("/api/ngo/posts", async (req, res) => {
  await db.read();
  res.json({ ok: true, posts: db.data.posts.slice().reverse() });
});

app.post("/api/ngo/posts", authMiddleware, upload.single("photo"), async (req, res) => {
  if (![ "ngo", "admin" ].includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
  const { title, description, location_text } = req.body;
  let photoUrl = null;
  if (req.file) {
    photoUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  }
  await db.read();
  const id = (db.data.posts.length ? Math.max(...db.data.posts.map(p => p.id)) : 0) + 1;
  const post = { id, ngo_id: req.user.id, title: title || "", description: description || "", photos: photoUrl ? [photoUrl] : [], location_text: location_text || "", created_at: new Date().toISOString() };
  db.data.posts.push(post);
  await db.write();
  res.json({ ok: true, post });
});

// ---------- Admin stats ----------
app.get("/api/admin/stats", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  await db.read();
  const stats = { users: db.data.users.length, posts: db.data.posts.length, requests: db.data.requests.length };
  res.json({ ok: true, stats });
});

// ---------- fallback ----------
app.get("/", (req, res) => res.send("BPT minimal backend running"));

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
