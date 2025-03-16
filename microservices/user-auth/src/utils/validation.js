const validator = require('validator');

function validateEmail(email) {
    return validator.isEmail(email);
}

function validatePassword(pass) {
    return validator.isStrongPassword(pass, {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minSymbols: 1
    });
}

module.exports = { validateEmail, validatePassword };