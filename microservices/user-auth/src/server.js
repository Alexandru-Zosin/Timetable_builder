const https = require('https');
const fs = require('fs');
const { login } = require('./routes/login.controller');
const { signup } = require('./routes/signup.controller');
const { logout } = require('./routes/logout.controller');
const { validate } = require('./routes/validate.controller');
const { setCORSHeadersOnValidOrigin } = require('../utils/corsHeaders');
const { parseJSON } = require('../utils/parseJSONBody');
const { Agent, setGlobalDispatcher } = require('undici')
const PORT = 3000;
require("dotenv").config();

let options = {
    key: fs.readFileSync('../key.pem', 'utf8'),
    cert: fs.readFileSync('../cert.pem', 'utf8')
};

const agent = new Agent({
    connect: {
      rejectUnauthorized: false
    }
});
  
setGlobalDispatcher(agent);

const server = https.createServer(options, (req, res) => {
    if (!setCORSHeadersOnValidOrigin(req, res))
        return;

    if (req.method === 'POST') {
        parseJSON(req, res, () => {
            switch (req.url) {
                case '/login':
                    login(req, res);
                    break;
                case '/signup':
                    signup(req, res);
                    break;
                case '/logout':
                    logout(req, res);
                    break;
                case '/validate':
                    validate(req, res);
                    break;
                default:
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Not found.'
                    }));
                    break;
            }
        });
    }
    else if (req.method == 'OPTIONS') { // preflight
        res.writeHead(204, { // No content, successful processing
            'Content-Length': '0'
        });
        res.end();
    }
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Error.'
        }));
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});