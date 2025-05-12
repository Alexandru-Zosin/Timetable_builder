function logout(req, res) {
    res.cookie('default', '', {
        httpOnly: true,
        secure: true,
        maxAge: 0,
    });
    res.status(200).json({ message: 'Logged out successfully.' });
}

module.exports = { logout };