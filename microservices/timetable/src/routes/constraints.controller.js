const { userMadeRequest, uploadRequest, getAllRequests, deleteRequest } = require('../models/constraints.model');
require("dotenv").config();

async function addRequest(req, res) {
    const { name, constraint }  = req.body;
    const teacher_id = req.auth?.tag;

    if (!teacher_id) {
        return res.status(400).json({ error: "Missing teacher ID in auth tag." });
    }

    try {
        const requestMade = await userMadeRequest(teacher_id);
        if (requestMade) {
            return res.status(409).json({ message: 'You already made a request. Wait until it is resolved.'});
        }

        await uploadRequest(teacher_id, name, constraint);
        return res.status(201).json({ message: 'Request registered successfully.' });
    } catch (err) {
        return res.status(500).json({error: 'Internal server error.'});
    }
}

async function getRequests(req, res) {
    try {
        const requests = await getAllRequests();
        return res.status(200).json({ requests });
    } catch (err) {
        return res.status(500).json({error: 'Internal server error.'});
    }
}

async function removeRequest(id, res) {
    try {
        const success = await deleteRequest(id);

        if (success) {
            return res.status(200).json({ message: `Constraint ${id} removed.` });
        } else {
            return res.status(404).json({ error: `Constraint with ID ${id} not found.` });
        }
    } catch (err) {
        return res.status(500).json({ error: "Internal server error." });
    }
}

module.exports = { addRequest, getRequests, removeRequest };
