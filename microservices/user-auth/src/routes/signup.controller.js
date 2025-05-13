const { registerUser } = require('../models/user.model');
const { hashWithKey } = require('../../utils/crypting');
const { validateEmail, validatePassword, validateGroup } = require('../../utils/validate');

async function signup(req, res) {
    const { email, password, confirmPassword, grouptag, yeartag } = req.body;

    if (!validateEmail(email) || !validatePassword(password) || 
    !validatePassword(confirmPassword) || !await validateGroup(grouptag, yeartag)) {
        return res.status(403).json({ error: 'Forbidden.' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Password does not match the confirm password.' });
    }

    const hashedPassword = hashWithKey(password, process.env.HASH_KEY);
    const userData = { email, password: hashedPassword, tag: grouptag, yeartag };

    try {
        const userCreated = await registerUser(userData);

        if (!userCreated) {
            return res.status(409).json({ error: 'User already exists.' });
        }

        return res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { signup };