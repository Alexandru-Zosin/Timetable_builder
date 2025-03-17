const crypto = require('crypto');

function hashWithKey(data, hashKey) {
    const hmac = crypto.createHmac('sha256', hashKey);
    hmac.update(data);
    return hmac.digest('hex');
}

function encrypt(data, secretKey) {
    const hashedKey = crypto.createHash('sha256').update(secretKey).digest();
    const iv = crypto.randomBytes(16); 
    const cipher = crypto.createCipheriv('aes-256-cbc', hashedKey, iv);
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    return iv.toString('hex') + encryptedData;
}

function decrypt(encryptedData, secretKey) { // [128, 255, 0, 33] => 80, ff, 00, 21 (16bytes=>32chars)
    const hashedKey = crypto.createHash('sha256').update(secretKey).digest();
    const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
    const encryptedText = encryptedData.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', hashedKey, iv);
    let decryptedData = decipher.update(encryptedText, 'hex', 'utf8');
    decryptedData += decipher.final('utf8'); // Complete the decryption
    return decryptedData;
}

module.exports = { hashWithKey, encrypt, decrypt };