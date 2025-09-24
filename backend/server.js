require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8082'
].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: false }));
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
  const email_verification_token = crypto.randomBytes(32).toString('hex');

    // Try insert with password_hash column; if missing column, fallback to metadata.password_hash
    let insertErr = null;
    let insertResp = await supabase.from('users').insert({
      id,
      email,
      full_name,
      roll_number,
      institute_name,
      password_hash,
      role: 'student',
      is_email_verified: false,
      email_verification_token
    });
    insertErr = insertResp.error || null;
    if (insertErr && String(insertErr.message || '').toLowerCase().includes('password_hash')) {
      // Column doesn't exist yet — store hash in metadata as a temporary fallback
      insertResp = await supabase.from('users').insert({
        id,
        email,
        full_name,
        roll_number,
        institute_name,
        metadata: { password_hash, is_email_verified: false, email_verification_token },
        role: 'student'
      });
      insertErr = insertResp.error || null;
    }
    if (insertErr) return res.status(500).json({ error: 'Insert error', details: insertErr.message });

    // Optional: send verification email
    if (transporter) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const link = `${frontendUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(email_verification_token)}`;
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'Verify your MindCare account',
          text: `Hi ${full_name || 'there'},\n\nPlease verify your account by clicking the link below:\n${link}\n\nIf you did not sign up, you can ignore this email.\n\nThanks,\nMindCareAI`,
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

    // Some deployments may not yet have the password_hash column. Try with it first, then retry without.
    let user = null; let selErr = null;
    let sel = await supabase
      .from('users')
      .select('id,email,full_name,role,password_hash,metadata,is_email_verified')
      .ilike('email', email)
      .maybeSingle();
    user = sel.data; selErr = sel.error || null;
    if (selErr && /password_hash|column .* does not exist/i.test(String(selErr.message))) {
      // Retry without password_hash
      sel = await supabase
        .from('users')
        .select('id,email,full_name,role,metadata,is_email_verified')
        .ilike('email', email)
        .maybeSingle();
      user = sel.data; selErr = sel.error || null;
    }
    if (selErr) return res.status(500).json({ error: 'Lookup error', details: selErr.message });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const storedHash = user.password_hash || (user.metadata && user.metadata.password_hash) || null;
  if (!storedHash) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, storedHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = issueToken({ sub: user.id, email: user.email, role: user.role || 'student' });
    return res.json({
      status: 'ok',
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name || 'Student', role: user.role || 'student', isEmailVerified: user.is_email_verified ?? (user.metadata && user.metadata.is_email_verified) ?? null }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// VERIFY EMAIL endpoint
// GET /student/verify-email?email=...&token=...
app.get('/student/verify-email', async (req, res) => {
  try {
    const email = req.query.email;
    const token = req.query.token;
    if (!email || !token) return res.status(400).json({ error: 'Missing email or token' });
    if (!supabase) return res.status(500).json({ error: 'Supabase admin client not configured' });

    const { data: user, error: selErr } = await supabase
      .from('users')
      .select('id,email,email_verification_token,is_email_verified,metadata')
      .ilike('email', String(email))
      .maybeSingle();
    if (selErr) return res.status(500).json({ error: 'Lookup error', details: selErr.message });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const storedToken = user.email_verification_token || (user.metadata && user.metadata.email_verification_token) || null;
    if (!storedToken || String(storedToken) !== String(token)) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Try to update real columns first
    let updErr = null;
    let updResp = await supabase
      .from('users')
      .update({ is_email_verified: true, email_verification_token: null })
      .eq('id', user.id);
    updErr = updResp.error || null;
    if (updErr && /is_email_verified|email_verification_token/i.test(String(updErr.message))) {
      // Fallback to metadata
      const newMetadata = Object.assign({}, user.metadata || {}, { is_email_verified: true });
      delete newMetadata.email_verification_token;
      updResp = await supabase
        .from('users')
        .update({ metadata: newMetadata })
        .eq('id', user.id);
      updErr = updResp.error || null;
    }
    if (updErr) return res.status(500).json({ error: 'Update error', details: updErr.message });

    return res.json({ status: 'ok' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`[node-backend] listening on http://localhost:${port}`));
