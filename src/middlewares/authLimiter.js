const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3, // solo 1 solicitud en ese período
    handler: (req, res) => {
        res.status(429);
        res.render("errorLimit", {
            mensaje: "Has superado el límite de intentos. Intenta más tarde."
        });
    }
});

module.exports = limiter;
