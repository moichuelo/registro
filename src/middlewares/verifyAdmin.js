const jwt = require("jsonwebtoken");

function verifyAdmin(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(403).json({ error: "Acceso denegado" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== "admin") {
            return res.status(403).json({ error: "Acceso solo para administradores" });
        }
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Token inválido:", err.message);
        return res.status(403).json({ error: "Token inválido" });
    }
}

module.exports = verifyAdmin;
