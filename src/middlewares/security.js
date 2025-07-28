const helmet = require("helmet");

const securityMiddleware = helmet({
    contentSecurityPolicy: false, // ⚠️ desactivado por compatibilidad con EJS y scripts inline
    crossOriginEmbedderPolicy: false, // ⚠️ necesario si usas socket.io o recursos externos
    // Puedes añadir más ajustes si los necesitas
});

module.exports = securityMiddleware;