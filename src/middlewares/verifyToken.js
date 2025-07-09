const jwt = require("jsonwebtoken"); //para generar el token

const verifyToken = (req, res, next) => {
    const token = req.cookies.token; //obtenemos el token

    if (!token) return res.status(401).send("No autenticado");

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(403).send("Token inválido");
    }
};

module.exports = verifyToken;
