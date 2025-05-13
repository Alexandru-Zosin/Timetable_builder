const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// fs starting path is the directory where
// the node.js is running

// ssl credentials
const options = {
    key: fs.readFileSync('../key.pem', 'utf8'),
    cert: fs.readFileSync('../cert.pem', 'utf8')
};

// the client sends the crypto suit and receives answer from server, along the certificate (pub key)
// this is send to central authority, after which handshake follows
// RSA/DH: client encry with pub, serv decr with secr key 

// static files location
const filesLocation = path.join(__dirname, 'public');

const app = express();

// middleware to serve static files with protection
app.use(express.static(filesLocation, { // mounts /public as ROOT
    dotfiles: 'deny',             // deny hidden files like .env
    extensions: false,            // don't automatically resolve .html
    index: false,                 // don't serve index.html automatically
    setHeaders: (res, filePath) => {
        res.setHeader("Content-Type", mime.lookup(filePath) || 'application/octet-stream');
    }
}));

app.use((req, res) => {
    res.status(404).json({ error: '404 Not Found.' });
});

// server runs event loop listening to new connections continuously
https.createServer(options, app).listen(443, () => {
    console.log('Listening on PORT 443...');
});