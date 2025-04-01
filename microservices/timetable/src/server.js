const fs = require("fs");
const https = require("https");
const { Agent, setGlobalDispatcher } = require('undici')
require("dotenv").config();
const { setCORSHeadersOnValidOrigin } = require("../utils/corsheaders");
const { parseJSON } = require("../utils/parseJSONbody");
const { getCurrentTimetable, generateNewTimetable } = require("./routes/timetable.controller");
const { addRequest, getRequests } = require("./routes/constraint.controller");

const PORT = 3557;
const options = {
    key: fs.readFileSync("../key.pem", "utf-8"),
    cert: fs.readFileSync("../cert.pem", "utf-8")
};

const agent = new Agent({
    connect: {
      rejectUnauthorized: false
    }
  })
  
setGlobalDispatcher(agent);

async function authorizeRequest(req) {
    const validation = await fetch("https://localhost:3000/validate", {
        agent,
        method: "POST",
        credentials: "include",
        mode: "cors",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://localhost:3557",
            "Cookie": req.headers.cookie
        },
        body: JSON.stringify({})
    });
        
    const validationJsonPayload = await validation.json();
    return validationJsonPayload;
}

const server = https.createServer(options, async (req, res) => {
    if (!setCORSHeadersOnValidOrigin(req, res)) return;
    
    if (req.method === "GET") {
        const authorizationPayload = await authorizeRequest(req);
        if (!(authorizationPayload.role === 'admin' || authorizationPayload.role === 'teacher' || 
        authorizationPayload.role === 'student')) {
            res.writeHead(401, {
                'Content-Type': 'application/json',
            });
            return res.end(JSON.stringify({
                error: 'Unauthorized.'
            }));
        }

        //parseJSON(req, res, async () => {
            switch(req.url) {
                case '/timetable':
                    getCurrentTimetable(req, res);
                    break;
                case '/constraints':
                    const authorizationPayload = await authorizeRequest(req);
                    if (!(authorizationPayload.role === 'admin')) {
                        res.writeHead(401, {
                            'Content-Type': 'application/json',
                        });
                        return res.end(JSON.stringify({
                            error: 'Unauthorized.'
                        }));
                    }
                    getRequests(req, res);
                    break;
                default:
                    res.writeHead(404, {'Content-Type': 'application-json'});
                    res.end(JSON.stringify({error: "Not found."}));
                    break;
            }
       // });
    } 
    else if (req.method === "POST") {
        parseJSON(req, res, async () => {
            switch (req.url) {
                case "/timetable":
                    let authorizationPayload = await authorizeRequest(req);
                    if (!(authorizationPayload.role === 'admin')) {
                        res.writeHead(401, {
                            'Content-Type': 'application/json',
                        });
                        return res.end(JSON.stringify({
                            error: 'Unauthorized.'
                        }));
                    }
                    generateNewTimetable(req, res);
                    break;
                case "/constraint":
                    authorizationPayload = await authorizeRequest(req);
                    if (!(authorizationPayload.role === 'teacher')) {
                        res.writeHead(401, {
                            'Content-Type': 'application/json',
                        });
                        return res.end(JSON.stringify({
                            error: 'Unauthorized.'
                        }));
                    }
                    addRequest(req, res, authorizationPayload.userId);
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
