const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");
const { Agent, setGlobalDispatcher } = require("undici");
require("dotenv").config();

const { allowedOrigins } = require("../utils/allowedOrigins");
const { getCurrentTimetable, generateNewTimetable } = require("./routes/timetable.controller");
const { addRequest, getRequests, removeRequest } = require("./routes/constraints.controller");

const PORT = 3557;
const options = {
    key: fs.readFileSync("../key.pem", "utf-8"),
    cert: fs.readFileSync("../cert.pem", "utf-8")
};

// allow insecure self-signed TLS certs for internal validation requests
const agent = new Agent({
    connect: {
        rejectUnauthorized: false
    }
});
setGlobalDispatcher(agent);

const app = express();

// JSON bodyparser
app.use(express.json({ limit: "1mb" }));

// this function is designed to allow the dynamic loading of allowed origin(s) from a 
// backing datasource, like a database
const corsOptions = {   // https://expressjs.com/en/resources/middleware/cors.html
    origin: (origin, callback) => { // dynamic validation of origin using a function
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// when using this middleware as 'use' middleware,
//  pre-flight requests are already handled for all routes

// auth helper
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
    return await validation.json();
}

function authorize(roles = []) {
    return async (req, res, next) => {
        try {
            const auth = await authorizeRequest(req);
            req.auth = auth;

            if (roles.length > 0 && !roles.includes(auth.role)) {
                return res.status(401).json({error: "Unauthorized."});
            }
            next();
        } catch (err) {
            res.status(500).json({error: "Authorization failed."});
        }
    };
}

app.get("/timetable", authorize(["admin", "teacher", "student"]), getCurrentTimetable);

app.get("/constraints", authorize(["admin"]), getRequests);

app.post("/timetable", authorize(["admin"]), generateNewTimetable);

app.post("/constraints", authorize(["teacher"]), addRequest);

app.delete("/constraints/:id", authorize(["admin"]), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({error: "Invalid constraint ID."});
    }
    await removeRequest(id, res);
});

app.use((req, res) => {
    res.status(404).json({ error: "Not found." });
});

https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is running at https://localhost:${PORT}`);
});