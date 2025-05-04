const { userMadeRequest, uploadRequest, getAllRequests, deleteRequest } = require('../models/constraints.model');

require("dotenv").config();

async function addRequest(req, res, teacher_id) {
    const { name, constraint }  = req.body;
    try {
        const requestMade = await userMadeRequest(teacher_id);
        if (requestMade) {
            res.writeHead(409, {
                'Content-Type': 'application/json',
            });
            return res.end(JSON.stringify({
                message: 'You already made a request. Wait until it is resolved.'
            }));
        }

        await uploadRequest(teacher_id, name, constraint);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            message: 'Request registered successfully.'
        }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            error: 'Internal server error.'
        }));
    }
}

async function getRequests(req, res) {
    try {
        const requests = await getAllRequests();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            requests
        }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            error: 'Internal server error.'
        }));
    }
}

async function removeRequest(id, res) {
    try {
        const success = await deleteRequest(id);

        if (success) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: `Constraint ${id} removed.` }));
        } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: `Constraint with ID ${id} not found.` }));
        }
    } catch (err) {
        console.error("Error in removeRequest:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Internal server error." }));
    }
}

module.exports = { addRequest, getRequests, removeRequest };