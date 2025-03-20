const { registerUser } = require('../models/user.model');
const { hashWithKey } = require('../../utils/crypting');
const { validateEmail, validatePassword, validateGroup } = require('../../utils/validate');
require("dotenv").config();

async function signup(req, res) {
    const { email, password, confirmPassword, grouptag } = req.body;

    if (!validateEmail(email) || !validatePassword(password) || !validatePassword(confirmPassword)
    || !validateGroup(grouptag)) {
        res.writeHead(403, {
            'Content-Type': 'application/json',
        });
        return res.end(JSON.stringify({
            error: 'Fordidden.'
        }));
    }

    if (password !== confirmPassword) {
        res.writeHead(400, {
            'Content-Type': 'application/json',
        });
        return res.end(JSON.stringify({
            error: 'Bad request. Password does not match the confirm password.'
        }));
    }

    const hashedPassword = hashWithKey(password, process.env.HASH_KEY);
    const userData = {
        email: email,
        password: hashedPassword,
        grouptag: grouptag
    };

    try {
        const userCreated = await registerUser(userData);

        if (!userCreated) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                error: 'User already exists.'
            }));
        }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            message: 'User registered successfully.'
        }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            error: 'Internal server error.'
        }));
    }
}

module.exports = { signup };