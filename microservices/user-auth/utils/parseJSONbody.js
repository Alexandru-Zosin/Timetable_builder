const getRawBody = require('raw-body');

async function parseJSON(req, res, next) { // middleware to parse req with app/json body from client
    try {
        const data = await getRawBody(req); // arrives as a raw stream of bytes (req.body undefined here)
        req.body = JSON.parse(data.toString()); // string to json ; .then() would've worked, parse is sync
        next();
    } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON format.' }));
    }
}

module.exports = { parseJSON };