const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({ //donde se guardan los archivos
    destination: function (req, file, cb) { //req es el request, file es el archivo y cb es el callback
        cb(null, 'public/uploads');
    },

    filename: function (req, file, cb) { //genera un nombre único para el archivo
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9); //coge la fecha actual y un numero aleatorio
        cb(null, uniqueName + path.extname(file.originalname)); //concatena el nombre unico con la extension
    }
});

//configuración de multer
const upload = multer({
    storage, //almacenamiento de archivos
    fileFilter: function (req, file, cb) { //filtra los archivos que se pueden subir
        const allowedTypes = /jpeg|jpg|png|gif/; //tipo de archivos permitidos
        const isMime = allowedTypes.test(file.mimetype); //comprueba si el tipo de archivo es permitido
        const isExt = allowedTypes.test(path.extname(file.originalname).toLowerCase()); //comprueba si la extension del archivo es permitida
        if (isMime && isExt) { //si el tipo de archivo y la extension son permitidos
            cb(null, true);
        } else {
            cb(new Error("Solo se permiten imágenes .jpg, .jpeg, .png o .gif"));
        }
    }
});

module.exports = upload;
