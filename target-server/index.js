const express = require('express');
const session = require('express-session');
const flash = require('connect-flash-plus');
const handlebars = require('express-handlebars');
const {
    v4: uuid
} = require('uuid');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;

/* Variables globales */
var usuario;
var correo;

// Middlwares

// app.use(cors({
//   origin: 'http://localhost:5000',
//   credentials: true,
// }));
app.use(express.urlencoded({
    extended: true
}));
app.use(session({
    secret: 'test',
    resave: false,
    saveUninitialized: false,
}));
app.use(flash());
app.set("views", __dirname);
app.engine("hbs", handlebars({
    defaultLayout: 'main',
    layoutsDir: __dirname,
    extname: '.hbs',
}));
app.set("view engine", "hbs");

/* Login */

const login = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        next();
    }
}

/* CSRF */

const tokens = new Map();

const csrfToken = (sessionId) => {
    const token = uuid();
    const userTokens = tokens.get(sessionId);
    userTokens.add(token);
    setTimeout(() => userTokens.delete(token), 30000);

    return token;
}

const csrf = (req, res, next) => {
    const token = req.body.csrf;
    if (!token || !tokens.get(req.sessionID).has(token)) {
        res.status(422).send('El CSRF Token no está o ha expirado');
    } else {
        next();
    }
}

/* DB */

const users = JSON.parse(fs.readFileSync('db.json'));

/* Rutas */
app.get('/', login, (req, res) => {
    res.redirect('/home')
});

app.get('/home', login, (req, res) => {
    const user = users.find(user => user.id === req.session.userId);

    res.render('edit', {
        // Proteccion por CSRF Token
        token: csrfToken(req.sessionID),
        correo: req.session.userEmail,
        nombre: req.session.userName
    });
});

app.get('/login', (req, res) => {
    console.log(req.session);
    res.render('login', {
        message: req.flash('message')
    });
});

app.post('/login', (req, res) => {
    if (!req.body.email || !req.body.password) {
        req.flash('message', 'Por favor, complete todos los campos');
        return res.redirect('/login');
    }
    const user = users.find(user => user.email === req.body.email);
    if (!user || user.password !== req.body.password) {
        req.flash('message', 'Credenciales inválidas');
        return res.redirect('/login');
    }

    // Envia la informacion de usuario
    req.flash('correo', user.email);
    req.flash('nombre', user.name);

    // Crea la sesion y redirige al home
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    tokens.set(req.sessionID, new Set());
    console.log(req.session);
    res.redirect('/home');
});

app.get('/logout', login, (req, res) => {
    req.session.destroy();
    res.send('Logged out');
})

// app.post('/edit', login, (req, res) => {
// Protección por CSRF Token
app.post('/edit', login, csrf, (req, res) => {
    const user = users.find(user => user.id === req.session.userId);

    // Se actuaiza el correo
    user.email = req.body.email;

    // Se actualiza el correo y nombre en la sesion cookie
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    console.log(`Usuario ${user.id} cambio su correo a ${user.email}`);
    res.send(`Tu correo se ha cambiado a ${user.email}`);
});

/* Server */
app.listen(PORT, () => console.log('Listening on port', PORT));