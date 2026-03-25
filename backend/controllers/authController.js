const test = (req, res) => {
    res.json({ message: "Auth funcionando" });
};

module.exports = { test };const register = (req, res) => {
    res.json({ message: "Register funcionando" });
};

const login = (req, res) => {
    res.json({ message: "Login funcionando" });
};

const logout = (req, res) => {
    res.json({ message: "Logout funcionando" });
};

module.exports = {
    register,
    login,
    logout
};