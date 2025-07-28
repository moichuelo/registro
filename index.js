//9 1 Iniciar las librerías
const express = require("express");
const app = express();
require("dotenv").config({ path: "./env/.env" });
// const cookieSession = require("cookie-session");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const http = require("http"); //crear servidor
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server);
const db = require("./database/db");
const setupSocket = require("./src/sockets/socketHandler");
const securityMiddleware = require("./src/middlewares/security");
const i18n = require('i18n');
const path = require('path');
const setGlobals = require('./src/middlewares/setGlobals');

// Configurar lógica internacionalización
i18n.configure({
    locales: ['en', 'es'], // Idiomas disponibles
    directory: path.join(__dirname, 'locales'), // Carpeta donde se guardan los archivos de traducción
    defaultLocale: 'es',
    cookie: 'lang', // Puedes leer el idioma desde una cookie
    queryParameter: 'lang', // O desde la URL ?lang=en
    autoReload: true,
    syncFiles: true
});


// const expressLayouts = require("express-ejs-layouts");

//9 7 Definir la sesión
app.use(cookieParser()); // Necesario para leer cookies
// app.use(cookieSession(sessionConfig));

//9 3 Definir los middlewares
app.use(express.urlencoded({ extended: true })); //nos permite recibir datos de un formulario
app.use(express.json()); //nos permite recibir datos de una API
app.use("/resources", express.static(__dirname + "/public"));
app.use(securityMiddleware);
app.use(i18n.init);
app.use(setGlobals);
app.use("/", require("./src/router"));


//9 6 Definir el motor de vistas
app.set("view engine", "ejs");
// app.use(expressLayouts);
// app.set("views", __dirname + "/views");

//9 8 Configurar lógica WebSocket
setupSocket(io);



//9 2 Crear el servidor
server.listen(3000, () => {
    console.log("Servidor corriendo en http://localhost:3000");
});
