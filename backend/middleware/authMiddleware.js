const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "No token provided." });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
    
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // attach user info to request
    
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};
