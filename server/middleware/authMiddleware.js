const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authorization = req.get('Authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Authentication is not configured' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'string') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = { id: decoded.id };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
