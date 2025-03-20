const { findUserByEmail } = require('../models/user.model');
const { encrypt, hashWithKey } = require('../../utils/crypting');
const { validateEmail, validatePassword } = require('../../utils/validate');

async function login(req, res) {
    const { email, password } = req.body;

    if (!(validateEmail(email)) || !(validatePassword(password))) {
        res.writeHead(403, {
            'Content-Type': 'application/json',
        });
        return res.end(JSON.stringify({
            error: 'Fordidden.'
        }));
    }

    try {
        const hashedPassword = hashWithKey(password, process.env.HASH_KEY);
        const user = await findUserByEmail(email);

        if (user?.password !== hashedPassword) { // safely accessing a possibly null object 
            res.writeHead(401, {
                'Content-Type': 'application/json',
            });
            return res.end(JSON.stringify({
                error: 'Unauthorized.'
            }));
        }

        const token = encrypt(`${user.id}|${user.role}|${user.grouptag ? user.grouptag : String(null)}|${Date.now() + 3600000 * 24}`,
            process.env.SECRET_KEY);

        res.writeHead(200, {
            'Set-Cookie': [ //attributes: default is cookiename
                `default=${token}; HttpOnly; Path=/; SameSite=None; Secure;`
            ], //cookie unaccessible to js, path=/ available whole domain sameS=n allows cookie to be sent; 
        });         // secure is for cookie to be sent exclusively over https

        return res.end(JSON.stringify({
            message: 'Login successful'
        }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            error: 'Internal server error.'
        }));
    }
}

module.exports = { login };