const { findUserByEmail } = require('../models/user.model');
const { encrypt, hashWithKey } = require('../../utils/crypting');
const { validateEmail, validatePassword } = require('../../utils/validate');

async function login(req, res) {
    const { email, password } = req.body;

    if (!validateEmail(email) || !validatePassword(password)) {
        return res.status(403).json({ error: 'Forbidden.' });
    }

    try {
        const hashedPassword = hashWithKey(password, process.env.HASH_KEY);
        const user = await findUserByEmail(email);

        if (!user || user.password !== hashedPassword) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }

        const token = encrypt(`${user.id}|${user.role}|${user.tag || null}|${user.yeartag || null}|${Date.now() + 3600000 * 24}`, process.env.SECRET_KEY);

        res.cookie('default', token, { // name value options
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            path: '/',
        }); 
        //cookie unaccessible to js, path=/ available whole domain sameS=n allows cookie to be sent; 
               // secure is for cookie to be sent exclusively over https

        return res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { login };