const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { login } = require('./routes/login.controller');
const { signup } = require('./routes/signup.controller');
const { logout } = require('./routes/logout.controller');
const { validate } = require('./routes/validate.controller');
const { PORTS } = require('../whitelistports');
require('dotenv').config();

const app = express();

// ssl Certificate
const options = {
    key: fs.readFileSync('../key.pem', 'utf8'),
    cert: fs.readFileSync('../cert.pem', 'utf8')
};

// CORS configuration
const allowedOrigins = Object.values(PORTS).map(port => `https://localhost:${port}`);
allowedOrigins.push('https://localhost');

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.post('/login', login);
app.post('/signup', signup);
app.post('/logout', logout);
app.post('/validate', validate);

app.use((req, res) => {
    res.status(404).json({ error: 'Not found.' });
});

// HTTPS server
const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
    console.log(`Server running at https://localhost:${PORT}`);
});
