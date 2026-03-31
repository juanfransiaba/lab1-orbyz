const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado: se requiere rol admin' });
    }
    next();
};

module.exports = isAdmin;
