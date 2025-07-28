const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const db = require("../database/db");
const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");
const PDFDocument = require("pdfkit");



const crud = require("./controllers");

const jwt = require("jsonwebtoken");
const verifyToken = require("./middlewares/verifyToken");
const verifyAdmin = require("./middlewares/verifyAdmin");

const upload = require("./middlewares/multerConfig");

const limiter = require("./middlewares/authLimiter");

// //9 funciones
// function verificarSesion(req, res, next) {
//     if (req.session.loggedin) {
//         return next();
//     }
//     res.redirect('/login');
// }

// function verificarAdmin(req, res, next) {
//     //operador de encadenamiento opcional ?. Si no existe no da error
//     if (req.session?.loggedin && req.session?.rol === 'admin') {
//         return next();
//     }
//     res.status(403).json({ error: 'Acceso denegado' });
// }

//9 4 Definir las rutas
router.get("/", (req, res) => {
    // res.send("Pagina principal");
    if (req.cookies.token) { // ************
        const payload = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        req.user = payload;
        res.render("index", {
            user: req.user?.name || "Usuario", // ************
            login: true,
        });
    } else {
        res.render("index", {
            user: "Debe iniciar sesión",
            login: false,
        });
    }
});
router.get("/login", (req, res) => {
    res.render("login");
});
router.get("/registro", (req, res) => {
    res.render("register");
});

router.get("/admin", verifyToken, (req, res) => {
    // res.send("Pagina principal");
    db.query("SELECT * FROM productos", (error, results) => {
        if (error) {
            throw error;
        } else {
            console.log(req.user);
            res.render("admin", {
                productos: results,
                user: req.user,
                login: true,
                rol: req.user.rol,
            });
        }
    });
});

router.get("/pdfAdmin", verifyToken, (req, res) => {
    // res.send("Pagina principal");
    db.query("SELECT * FROM productos", (error, results) => {
        if (error) {
            throw error;
        } else {
            console.log(req.user);
            res.render("pdfTabla", {
                productos: results,
                user: req.user,
                login: true,
                rol: req.user.rol,
            });
        }
    });
});

router.get("/create", (req, res) => {
    res.render("create");
});

router.get("/edit/:id", (req, res) => {
    const ref = req.params.id; //capturamos el parámetro de la ruta
    db.query("SELECT * FROM productos WHERE ref = ?", [ref], (error, results) => {
        if (error) {
            throw error;
        } else {
            res.render("edit", { producto: results[0] });
        }
    }
    );
});

router.get("/delete/:id", (req, res) => {
    const ref = req.params.id; //capturamos el parámetro de la ruta
    db.query("DELETE FROM productos WHERE ref = ?", [ref], (error, results) => {
        if (error) {
            throw error;
        } else {
            res.redirect("/admin");
        }
    }
    );
});

// router.get("/logout", (req, res) => {
//     req.session = null;
//     res.redirect('/');
// });

router.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect('/');
});

router.get("/soporte", verifyToken, (req, res) => {
    res.render("soporte", {
        user: {
            username: req.user.user,
            role: req.user.rol
        }
    });
});

router.get("/api/mensajes", verifyAdmin, (req, res) => {
    const usuario = req.query.con; // Extrae el usuario desde la url (...?con=usuarioX)

    if (!usuario) { //si no hay usuario que devuelva el error
        return res.status(400).json({ error: "Falta el parámetro ?con=usuario" });
    }

    const sql = `
    SELECT de_usuario, para_usuario, mensaje, fecha
    FROM mensajes
    WHERE 
      (de_usuario = ? OR para_usuario = ?)
    ORDER BY fecha ASC
    `;

    db.query(sql, [usuario, usuario], (err, results) => {
        if (err) {
            console.error("❌ Error al consultar mensajes:", err);
            return res.status(500).json({ error: "Error al obtener mensajes" });
        }

        // Devuelve los mensajes en formato JSON
        res.json(results);
    });
});


router.get("/api/mensajes/mios", verifyToken, (req, res) => {
    const usuario = req.user.user;

    if (!usuario) { //verifica que el usuario este logueado y tenga un usuario
        return res.status(403).json({ error: "No autorizado" });
    }

    const sql = `
    SELECT de_usuario, para_usuario, mensaje, fecha
    FROM mensajes
    WHERE 
      (de_usuario = ? OR para_usuario = ?)
    ORDER BY fecha ASC
    `;

    db.query(sql, [usuario, usuario], (err, results) => {
        if (err) {
            console.error("❌ Error al obtener mensajes:", err);
            return res.status(500).json({ error: "Error interno" });
        }

        // Devuelve los mensajes en formato JSON
        res.json(results);
    });
});


router.get("/api/usuarios-conversaciones", verifyAdmin, (req, res) => {

    /*Busca mensajes donde participen administradores.
    usa UNION para combinar las dos consultas y elimina duplicados
    renombra las dos columnas como "usuario" para poder procesarlas
    filtra los que no son administradores y elimina los duplicados

    Devuelve un array de usuarios
    */
    const sql = `
    SELECT DISTINCT usuario
    FROM (
      SELECT de_usuario AS usuario FROM mensajes
      WHERE para_usuario IN (SELECT usuario FROM usuarios WHERE rol = 'admin')
      
      UNION
      
      SELECT para_usuario AS usuario FROM mensajes
      WHERE de_usuario IN (SELECT usuario FROM usuarios WHERE rol = 'admin')
    ) AS conversaciones
    WHERE usuario NOT IN (SELECT usuario FROM usuarios WHERE rol = 'admin')
  `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error al obtener lista de usuarios:", err);
            return res.status(500).json({ error: "Error interno" });
        }

        const usuarios = results.map(r => r.usuario); // Extrae los nombres de los usuarios
        res.json(usuarios); //los devuelve en formato JSON
    });
});

router.get("/pdf/descargar", verifyToken, async (req, res) => {
    db.query("SELECT * FROM productos", async (error, results) => {
        if (error) {
            return res.status(500).send("Error al obtener productos");
        }

        try {
            const html = await ejs.renderFile(path.join(__dirname, "../views/pdfTabla.ejs"), {
                productos: results
            }); //genera el html

            const browser = await puppeteer.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            }); // ejecuta un navegador virtual para generar el PDF

            const page = await browser.newPage(); //crea una nueva página
            await page.setContent(html, { waitUntil: "networkidle0" }); //carga el html

            const pdfBuffer = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: { top: "20px", bottom: "20px" },
            }); //genera el PDF a partir de la página y lo guarda en memoria

            await browser.close(); //cierra el navegador

            res.setHeader("Content-Type", "application/pdf"); //establece el tipo de contenido
            res.setHeader("Content-Disposition", 'attachment; filename="productos.pdf"'); //establece el nombre del archivo
            res.send(pdfBuffer); //envia el PDF

        } catch (err) {
            console.error("❌ Error al generar el PDF:", err);
            res.status(500).send("Error interno al generar el PDF");
        }
    });
});

router.get("/pdfkit/descargar", verifyToken, (req, res) => {
    db.query("SELECT * FROM productos", (error, results) => { //obtenemos los productos
        if (error) {
            return res.status(500).send("Error al obtener productos");
        }

        const doc = new PDFDocument({ margin: 40, size: 'A4' }); //creamos el PDF

        // Encabezados HTTP para descarga
        res.setHeader("Content-Disposition", 'attachment; filename="productos_desde_cero.pdf"'); //establece el nombre del archivo
        res.setHeader("Content-Type", "application/pdf"); //establece el tipo de contenido

        doc.pipe(res); // Envía el PDF al cliente

        // Título
        doc.fontSize(18).text("Listado de Productos", { align: "center" }).moveDown(); //escribe un título centrado y grande
        //moveDown() mueve el cursor hacia abajo

        // Encabezados de tabla
        doc.font("Helvetica-Bold").fontSize(12); // Establece la fuente y el tamaño
        let y = doc.y; // Obtiene la posición vertical actual
        doc.text("Referencia", 50, y); //escribe el encabezado en x, y
        doc.text("Nombre", 150, y);
        doc.text("Precio", 300, y);
        doc.text("Stock", 380, y);

        // Espacio entre encabezado y datos
        y += 20;

        doc.font("Helvetica").fontSize(11);// Establece la fuente y el tamaño

        results.forEach((p) => { //recorremos los productos
            doc.text(p.ref.toString(), 50, y);
            doc.text(p.nombre, 150, y);
            doc.text(Number(p.precio).toFixed(2), 300, y);
            doc.text(p.stock.toString(), 380, y);
            y += 20; // espacio entre filas
        });

        doc.end(); // Finaliza el documento
    });
});

router.get('/set-lang/:lang', (req, res) => {
    const lang = req.params.lang; //capturamos el parámetro de la ruta
    const returnTo = req.query.returnTo || '/'; //capturamos el parámetro de la redirección sino nos manda a la raiz

    if (['es', 'en'].includes(lang)) { //verifica que el idioma sea válido
        res.cookie('lang', lang, { maxAge: 900000, httpOnly: true }); //guarda el idioma en la cookie
    }

    res.redirect(returnTo); //redirecciona a la ruta indicada
});


//9 **************************************************
//9 8 Definir las rutas POST
//9 **************************************************

router.post("/register", upload.single("profileImage"), //name del input
    [
        body("user")
            .exists()
            .isLength({ min: 4 })
            .withMessage("El usuario debe tener al menos 4 caracteres"),
        body("name")
            .isLength({ min: 4 })
            .withMessage("El nombre debe tener al menos 4 caracteres"),
        body("pass")
            .isLength({ min: 4 })
            .withMessage("La contraseña debe tener al menos 4 caracteres"),
        body("email").isEmail().withMessage("El email no es valido"),
        body("edad").isNumeric().withMessage("La edad debe ser un número"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // res.status(400).json({ errors: errors.array() });
            // console.log(errors);

            console.log(req.body);
            const valores = req.body; //se guardan los valores introducidos en el formulario
            const validacionErrores = errors.array(); //se guarda en un array todos los errores producidos
            res.render("register", {
                validaciones: validacionErrores,
                valores: valores,
            });
        } else {
            console.log("🧾 Body:", req.body);
            console.log("📁 Archivo subido:", req.file);
            //Recoger los datos del formulario
            const user = req.body.user;
            const name = req.body.name;
            const rol = req.body.rol;
            const pass = req.body.pass;
            const profileImage = req.file ? req.file.filename : null;

            //Cifrar la contraseña
            const passwordHash = await bcrypt.hash(pass, 8);

            //Guardar el usuario en la base de datos
            db.query(
                "INSERT INTO usuarios SET ?",
                {
                    usuario: user,
                    nombre: name,
                    rol: rol,
                    pass: passwordHash,
                    imagen: profileImage,
                },
                (error, results) => {
                    if (error) {
                        console.log(error);
                    } else {
                        res.render("register", {
                            alert: true,
                            alertTitle: "Registro",
                            alertMessage:
                                "El usuario se ha registrado correctamente",
                            alertIcon: "success",
                            showConfirmButton: false,
                            timer: 2500,
                            ruta: "",
                        });
                    }
                }
            );
        }
    }
);

//Ruta de inicio de sesión
router.post("/auth", limiter, async (req, res) => {
    const user = req.body.user;
    const pass = req.body.pass;

    if (user && pass) {
        db.query(
            "SELECT * FROM usuarios WHERE usuario = ?",
            [user],
            async (error, results) => {
                if (
                    results.length == 0 ||
                    !(await bcrypt.compare(pass, results[0].pass))
                ) {
                    return res.render("login", {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage:
                            "El usuario o la contraseña son incorrectos",
                        alertIcon: "error",
                        showConfirmButton: true,
                        timer: false,
                        ruta: "login",
                        login: false,
                    });
                }

                // ✅ Generar token JWT
                const payload = {
                    user: results[0].usuario,
                    name: results[0].nombre,
                    rol: results[0].rol,
                    imagen: results[0].imagen,
                };

                // ✅ Crea un toquen firmado con los datos del usuario válido por un periodo de 1 hora
                const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h", });

                // ✅ Guardar en cookie
                res.cookie("token", token, {
                    httpOnly: true,
                    secure: false, // pon true si usas HTTPS
                    maxAge: 3600000, // 1 hora
                });

                // ✅ Enviar respuesta al frontend
                return res.render("login", {
                    alert: true,
                    alertTitle: "Login",
                    alertMessage: "Has iniciado sesión correctamente",
                    alertIcon: "success",
                    showConfirmButton: false,
                    timer: 2500,
                    ruta: "",
                    login: true,
                });
            }
        );
    } else {
        res.render("login", {
            alert: true,
            alertTitle: "Error",
            alertMessage: "Introduzca su usuario y contraseña",
            alertIcon: "error",
            showConfirmButton: true,
            timer: false,
            ruta: "login",
            login: false,
        });
    }
});

router.post("/save", crud.save);
router.post("/update", crud.update);


module.exports = router;
