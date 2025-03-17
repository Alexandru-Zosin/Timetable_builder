const https = require('https');
const fs = require('fs');
const url = require('url');
const path = require('path');
const mime = require('mime-types');
const PORT = 443;

// fs starting path is the directory where
// the node.js is running

// static files location
const filesLocation = path.join(__dirname, 'public');
let options = {
    key: fs.readFileSync('../key.pem', 'utf8'),
    cert: fs.readFileSync('../cert.pem', 'utf8')
};

// clientul trimite suita criptografica si prim. rasp de la srv, impreuna cu certif digit (pub key)
// acesta este verf la autor. centrala dupa care, in caz de accept, se petrece handshakeul:
// RSA/DH: clientul cript cu pub key_srv, srv decript cu secret_key_srv 

// server runs event loop listening to new connections continuously
https.createServer(options, (req, res) => { // request handler called each time a req is made
    try {
        let parsedUrl = url.parse(req.url).pathname; // extracts path without query parms
        let safePath = path.normalize(parsedUrl).replace(/^(\.\.[\/\\])+/, ''); // removes ../, ...
              // normalizes multiple slashes, ., .. etc.
              // protection against traversal path attack
        const filePath = path.join(filesLocation, safePath);
        // creates and returnes resolved path from given segments
        // determine content type by file extension
        let contentType = mime.lookup(filePath) || 'application/octet-stream'; // generic(01) unknown type

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: '404 Not Found.' })); // js obj -> json
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                fs.createReadStream(filePath).pipe(res); // sends data chunk by chunk
                // automatically res.end() when stream finishes, automatically called
            }
        });
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' }); // unlike res.setHeader, 
        return res.end(JSON.stringify({ error: 'Internal Server Error' })); // it sets multiple and sends headers immediately
    }
}).listen(PORT, () => {
    console.log("Listening to PORT 443...")
});