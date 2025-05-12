const { decrypt } = require('../../utils/crypting');
const { PORTS } = require('../../whitelistports');

async function validate(req, res) {
    const sessionToken = req.cookies?.default;

    if (!sessionToken) {
        return res.status(401).json({ error: 'No session token provided.' });
    }

    try {
        const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);
        const [userId, role, tag, expiration] = decryptedToken.split('|');

        if (Date.now() > parseInt(expiration)) {
            return res.status(401).json({ error: 'Session expired.' });
        }

        // parse origin port
        const origin = req.headers.origin;
        let originPort = null;

        if (origin) {
            try {
                const parsedUrl = new URL(origin);
                originPort = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');
            } catch (err) {
                return res.status(400).json({ error: 'Invalid origin format.' });
            }
        } else {
            return res.status(400).json({ error: 'Missing origin header.' });
        }

        // role-based response for known microservices
        switch (parseInt(originPort)) {
            case PORTS.timetable:
            case PORTS.front:
                return res.status(200).json({ role, tag });
            default:
                return res.status(403).json({ error: 'Origin not allowed.' });
        }

    } catch (error) {
        return res.status(500).json({
            error: 'Failed to decrypt token or invalid token format.'
        });
    }
}

module.exports = { validate };