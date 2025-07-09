const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const db = require("../database/db");

const crud = require("./controllers");

const jwt = require("jsonwebtoken");
const verifyToken = require("./middlewares/verifyToken");
const verifyAdmin = require("./middlewares/verifyAdmin");

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
            res.render("admin", {
                productos: results,
                user: req.user.name,
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

//9 8 Definir las rutas POST

router.post(
    "/register",
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
            //Recoger los datos del formulario
            const user = req.body.user;
            const name = req.body.name;
            const rol = req.body.rol;
            const pass = req.body.pass;

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
router.post("/auth", async (req, res) => {
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
                    res.render("login", {
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
