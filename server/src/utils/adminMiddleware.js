import jwt from 'jsonwebtoken';
import { getJwtSecret } from './env.js';

const JWT_SECRET = getJwtSecret();

export const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization Header' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Missing Token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check role in token
        if (decoded.role !== 'super_admin' && decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient Permissions' });
        }

        // Attach user payload to request
        req.adminUser = decoded;
        next();
    } catch (err) {
        console.error('JWT Verification Failed:', err.message);
        return res.status(401).json({ error: 'Invalid or Expired Token' });
    }
};
