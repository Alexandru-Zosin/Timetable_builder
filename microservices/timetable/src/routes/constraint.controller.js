const { userMadeRequest, uploadRequest, getAllRequests } = require('../models/constraint.model');
//const { resolve } = require('path');

require("dotenv").config();

async function addRequest(req, res, teacher_id) {
    const { request } = req.body;
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

        await uploadRequest(teacher_id, request);
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
        res.writeHead(200, {' Content-Type' : 'application/json'});
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

module.exports = { addRequest, getRequests };