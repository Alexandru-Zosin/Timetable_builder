function logout(req, res) {
    res.writeHead(200, {
        'Set-Cookie': [
            'default=; HttpOnly; Secure; Max-Age=0'
        ]
    });
    res.end(JSON.stringify({
        message: 'Logged out successfully.'
    }));
}

module.exports = { logout };