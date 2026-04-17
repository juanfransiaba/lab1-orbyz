const isAdmin = (req, res, next) => {
    const userRole = req.user?.roles ?? req.user?.role;

    if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado: se requiere rol admin' });
    }

    next();
};

module.exports = isAdmin;
