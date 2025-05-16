const crypto = require('crypto');

function hashWithKey(data, hashKey) {
    const hmac = crypto.createHmac('sha256', hashKey); // hmac initd. with hashkey
    // hmac(key, message) = H/sha256( (key xor opad) || H/sha256((key xor ipad) || message) )
    hmac.update(data);
    return hmac.digest('hex'); 
    // 64char hexadecimal string (256bits = 32bytes digest)
    // byte = 8 bits => 2hexa chars
    // sha256 hash fct. still considered secure as of 2025
}

// symmetric encryption&decryption (a xor b = c then c xor b = a)
function encrypt(data, secretKey) {
    const hashedKey = crypto.createHash('sha256').update(secretKey).digest();
    const iv = crypto.randomBytes(16); // init. vector IV of 16 bytes
    // used once by encryption to add randomness (to make it non determin.)
    // (otherwise identical ciphertexts)
    const cipher = crypto.createCipheriv('aes-256-cbc', hashedKey, iv);
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    return iv.toString('hex') + encryptedData; // iv req. for decrpytion
}

function decrypt(encryptedData, secretKey) { // [128, 255, 0, 33] => 80, ff, 00, 21 (16bytes=>32chars)
    // normalizing the key
    const hashedKey = crypto.createHash('sha256').update(secretKey).digest();
    const iv = Buffer.from(encryptedData.slice(0, 32), 'hex'); // first 32 chars(16bytes)
    const encryptedText = encryptedData.slice(32); // the rest is the ciphertext
    const decipher = crypto.createDecipheriv('aes-256-cbc', hashedKey, iv);
    let decryptedData = decipher.update(encryptedText, 'hex', 'utf8');
    decryptedData += decipher.final('utf8'); // completes the decryption
    return decryptedData;
}

module.exports = { hashWithKey, encrypt, decrypt };