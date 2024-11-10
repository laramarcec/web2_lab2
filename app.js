const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true })); 
app.use(express.json());
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views')); 
app.use(express.static(path.join(__dirname, 'public')));

const sessions = {};

app.get('/login', (req, res) => {
    try
    {
        res.render('loginpage');
    }
    catch(error) 
    {
        console.error(error)
    }
});

app.post('/login', (req, res) => {
    const username = req.body.username;
    const token = uuidv4();

    sessions[token] = { 
        username, 
        expires: Date.now() + 60 * 60 * 1000
    };

    res.cookie('sessionToken', token, { httpOnly: true });
    res.redirect('/protected');
});


app.get('/protected', (req, res) => {
    const token = req.cookies.sessionToken;
    if (sessions[token] && sessions[token].expires > Date.now()) {
        res.render('protectedpage', { username: sessions[token].username });
    } else {
        res.status(401).render('unauthorizedpage');
    }
});



app.post('/logout-switch', (req, res) => {
    const sigurnaOdjava = req.body.sigurnaOdjava === 'on';
    const token = req.cookies.sessionToken;

    if (sigurnaOdjava) {
        delete sessions[token];
        res.clearCookie('sessionToken');
        res.redirect('/');
    } else {
        res.redirect('/');
    }
});

app.get('/', async (req, res) =>  {

    try{
        const loginButton = 
        `
            <a href="/login"><button type="button">prijavi se!</button></a>
        `;
        res.render('mainpage', {loginButton});
    }
    catch(error){
        console.error(error);
    }
    
});

app.listen(PORT, () => {
    console.log(`server radi`);
})