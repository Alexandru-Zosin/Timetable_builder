const fs = require("fs");
const https = require("https");
require("dotenv").config();
const { setCORSHeadersOnValidOrigin } = require("../utils/corsheaders");
const { parseJSON } = require("../utils/parseJSONbody");
const { parse } = require("url");
const { getCurrentTimetable, generateNewTimetable } = require("./routes/timetable.controller");
const { addRequest } = require("./routes/constraint.controller");

const PORT = 3557;
const options = {
    key: fs.readFileSync("../key.pem", "utf-8"),
    cert: fs.readFileSync("../cert.pem", "utf-8")
};

const server = https.createServer(options, async (req, res) => {
    if (!setCORSHeadersOnValidOrigin(req, res)) return;
    
    if (req.method === "GET") {
        parseJSON(req, res, async () => {
            switch(req.url) {
                case '/timetable':
                    //...
                    break;
                default:
                    res.writeHead(404, {'Content-Type': 'application-json'});
                    res.end(JSON.stringify({error: "Not found."}));
                    break;
            }
        });
    } 
    else if (req.method === "POST") {
        parseJSON(req, res, () => {
            switch (req.url) {
                case "/timetable":
                    generateNewTimetable(req, res);
                    break;
                case "/constraint":
                    addRequest(req, res);
                    break;
                default:
                    res.writeHead(404, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Not found." }));
                    break;
            }
        });
    } 
    else if (req.method === "OPTIONS") {
        res.writeHead(204, { "Content-Length": 0 });
        res.end();
    } 
    else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error" }));
    }
});

server.listen(PORT, () => {
    console.log(`Server is running at https://localhost:${PORT}`);
});
