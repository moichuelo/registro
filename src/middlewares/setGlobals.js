module.exports = (req, res, next) => {
    // Idioma actual (usado por i18n)
    res.locals.lang = req.getLocale();

    // Aquí puedes agregar más variables globales si quieres
    // res.locals.user = req.user || null;

    next();
};