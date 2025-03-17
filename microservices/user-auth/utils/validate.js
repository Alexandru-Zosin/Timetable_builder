const validator = require('validator');

function validateEmail(email) {
    return validator.isEmail(email);
}

function validatePassword(pass) {
    if (!pass)
        return false;
    const pattern = /^[a-zA-Z0-9._%+-]{2,30}$/;
    return pattern.test(pass);
}

module.exports = { validateEmail, validatePassword };