const validator = require('validator');
const { getGroups } = require('../src/models/user.model');

async function validateGroup(group, year) {
    try {
        const groups = await getGroups();
        groupsList = groups.map((group) => group.name);
        if (!groupsList.includes(group))
            return false;
        if (!['1', '2', '3'].includes(year))
            return false;
        return true;
    } catch (error) {
        return false;
    }
}

function validateEmail(email) {
    return validator.isEmail(email);
}

function validatePassword(pass) {
    if (!pass)
        return false;
    const pattern = /^[a-zA-Z0-9._%+-]{2,30}$/;
    return pattern.test(pass);
}

module.exports = { validateEmail, validatePassword, validateGroup };