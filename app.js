const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const https = require('https');
const fs = require('fs');

require('dotenv').config();

const app = express();
const externalUrl = process.env.RENDER_EXTERNAL_URL;
const port = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 4080; 


app.use(express.urlencoded({ extended: true })); 
app.use(express.json());
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views')); 
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool(
{
    connectionString: process.env.DATABASE_URL,
    ssl : 
    { 
    rejectUnauthorized: false 
    }
});

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);


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

app.get('/mailTracking', (req, res) => {
    try
    {
        res.render('mailTrackingPage');
    }
    catch(error) 
    {
        console.error(error)
    }
});

app.post('/trackMail', async(req, res) => {

    const trackingId = req.body.trackingId;

    const enableInjection = req.body.enableInjection === 'on';

    let data;

    if (enableInjection) 
    {
        //ranjivost
        data = await pool.query(`SELECT * FROM "mailTracking" WHERE "trackingId" = '${trackingId}'`);
    }
    else 
    {
        //bez ranjivosti
        if (typeof trackingId != "string" )
        {
            res.send("invalid parameters");
            res.end(); return;
        }
        else 
        {
            data = await pool.query(`SELECT * FROM "mailTracking" WHERE "trackingId" = $1`, [trackingId]);
        }
    }

    res.render('mailTrackingDetails', { mails: data.rows });

});

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('users')
        .insert([{ id: token, username: username, password:password, expires: expires 

        }]);

    if (error) 
    {
        console.error("error creating session:", error);
    }
    res.cookie('sessionToken', token, { httpOnly: true });
    res.redirect('/protected');
});


app.get('/protected', checkSession, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    res.render('protectedpage', { username: req.username });
});



app.post('/logout-switch', async (req, res) => {
    const sigurnaOdjava = req.body.sigurnaOdjava === 'on';
    const token = req.cookies.sessionToken;

    if (sigurnaOdjava && token ) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', token);

        if (error) {
            console.error("error deleting session:", error);
        }
        res.clearCookie('sessionToken');
    }

    res.redirect('/');
});

app.get('/', async (req, res) =>  {

    try{
        const mailTrackingButton =
        `
            <a href="/mailTracking"><button type="button">pretraži pošiljku</button></a>
        `;
        const loginButton = 
        `
            <a href="/login"><button type="button">prijavi se</button></a>
        `;
        res.render('mainpage', {loginButton, mailTrackingButton});
    }
    catch(error){
        console.error(error);
    }
    
});

if (externalUrl) {   
    const hostname = '0.0.0.0'; 
    app.listen(port, hostname, () => {     
        console.log(`Server locally running at http://${hostname}:${port}/ and from outside on ${externalUrl}`);   
});
} 
else {  
   https.createServer({ 
        key: fs.readFileSync('server.key'), 
        cert: fs.readFileSync('server.cert') 
    }, app) 
    .listen(port, function () {
        console.log(`Server running at https://localhost:${port}/`);
}); 
}


async function checkSession(req, res, next) {
    const token = req.cookies.sessionToken;

    if (!token) {
        return res.status(401).render('unauthorizedpage');
    }

    const { data: session, error } = await supabase
        .from('users')
        .select('username, expires')
        .eq('id', token)
        .single();

    if (error || !session || new Date(session.expires) < new Date()) {
        res.clearCookie('sessionToken');
        return res.status(401).render('unauthorizedpage');
    }

    req.username = session.username;
    next();
}
