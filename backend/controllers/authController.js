const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID");

exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    // Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID",
    });
    const payload = ticket.getPayload();
    const { email, name, hd } = payload;

    // Optional: check hosted domain if provided in env
    if (process.env.ALLOWED_DOMAIN && hd !== process.env.ALLOWED_DOMAIN) {
      return res.status(403).json({ error: "Domain not authorized." });
    }

    // Check allowlist or create pending user
    let admin = await AdminUser.findOne({ email });
    if (!admin) {
      admin = await AdminUser.create({
        email,
        name: name || '',
        role: 'pending',
        campus: null
      });
    }

    // Issue custom JWT
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
    const authToken = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role, campus: admin.campus },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token: authToken, admin: { email: admin.email, name: admin.name, role: admin.role, campus: admin.campus } });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};
