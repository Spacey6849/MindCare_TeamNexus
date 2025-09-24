require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: [ 'http://localhost:8080', 'http://127.0.0.1:8080' ], credentials: false }));
app.use(express.json());

// Supabase admin client (service role)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.warn('[startup] Missing Supabase env vars. Ensure backend/.env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
} else {
  try {
    supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch (e) {
    console.error('[startup] Failed to create Supabase client:', e?.message || e);
    supabase = null;
  }
}

// Nodemailer
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
} else {
  console.warn('[startup] SMTP not configured; verification emails will be skipped.');
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    supabaseUrlSet: !!SUPABASE_URL,
    serviceRoleSet: !!SERVICE_ROLE,
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  });
});

// Helper: minimal JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function issueToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// STUDENT SIGNUP using public.users only (no auth.users)
app.post('/student/signup', async (req, res) => {
  try {
    const { email, password, full_name, roll_number, institute_name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    if (!supabase) return res.status(500).json({ error: 'Supabase admin client not configured' });

    // Check if email exists
    const { data: existing, error: existErr } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (existErr) return res.status(500).json({ error: 'Lookup error', details: existErr.message });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 10);

    const { error: insertErr } = await supabase.from('users').insert({
      id,
      email,
      full_name,
      roll_number,
      institute_name,
      password_hash,
      role: 'student'
    });
    if (insertErr) return res.status(500).json({ error: 'Insert error', details: insertErr.message });

    // Optional: send verification email
    if (transporter) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const link = `${frontendUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(email)}`;
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'Verify your MindCare account',
          text: `Hi ${full_name || 'there'},\n\nPlease verify your account: ${link}\n\nThanks,\nMindCareAI`,
        });
      } catch (e) {
        console.warn('[student/signup] email send failed:', e?.message || e);
      }
    }

    return res.json({ status: 'ok', user_id: id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// STUDENT LOGIN using public.users
app.post('/student/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    if (!supabase) return res.status(500).json({ error: 'Supabase admin client not configured' });

    const { data: user, error: selErr } = await supabase
      .from('users')
      .select('id,email,full_name,role,password_hash')
      .ilike('email', email)
      .maybeSingle();
    if (selErr) return res.status(500).json({ error: 'Lookup error', details: selErr.message });
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = issueToken({ sub: user.id, email: user.email, role: user.role || 'student' });
    return res.json({
      status: 'ok',
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name || 'Student', role: user.role || 'student' }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`[node-backend] listening on http://localhost:${port}`));
