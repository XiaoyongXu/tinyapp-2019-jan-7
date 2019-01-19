'use strict';

// setting up the modules and middleware
const express = require('express');

const app = express();
const PORT = 8080;

const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));

const cookieSession = require('cookie-session');

app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2'],
}));

app.set('view engine', 'ejs');

const bcrypt = require('bcrypt');

const user1PW = bcrypt.hashSync('cow', 10);


// universal variables
const urlDatabase = [
  { tinyURL: 'b2xVn2', fullURL: 'http://www.lighthouselabs.ca', owner: 'userRandomID' },
  { tinyURL: '9sm5xK', fullURL: 'http://www.google.com', owner: 'user2RandomID' },
  { tinyURL: 'C2xVn2', fullURL: 'http://www.blighthouselabs.ca', owner: 'userRandomID' },
];

const users = {
  userRandomID: {
    id: 'userRandomID',
    email: 'user@example.com',
    password: user1PW,
  },
  user2RandomID: {
    id: 'user2RandomID',
    email: 'user2@example.com',
    password: 'sow',
  },
};

// GET routes (from most to least specific)
app.get('/urls/new', (req, res) => {
  const templateVars = {
    user: getUserObj(req.session.user_id),
  };
  if (req.session.user_id) {
    res.render('urls_new', templateVars);
  } else {
    res.redirect('/login');
  }
});

app.get('/urls/:id', (req, res) => {
  const user = getUserObj(req.session.user_id);
  const templateVars = {
    user: user, // object
    shortURL: req.params.id,
    yourURLs: urlsForUser(req.session.user_id), // array
  };
  if (urlDatabaseChecker(req.params.id)) {
    if (!req.session.user_id) {
      res.send('Try <a href="/login">logging in</a> first.');
    } else if (!isThisYours(req.params.id, req.session.user_id)) {
      res.send('That URL does not belong to you. 😾');
    } else if (req.session.user_id) {
      res.render('urls_show', templateVars);
    }
  } else {
    res.send('That URL is not in the database. 😞 Would you like to <a href="/register">make a new one</a>?');
  }
});

app.get('/urls', (req, res) => {
  if (req.session.user_id) {
    const templateVars = {
      user: getUserObj(req.session.user_id),
      urls: urlsForUser(req.session.user_id),
    };
    res.render('urls_index', templateVars);
  } else {
    res.send('You need to <a href="/login">log in</a> to see your shortened URLs.');
  }
});

app.get('/u/:id', (req, res) => {
  const idString = req.params.id;
  const goHere = [];
  for (const item of urlDatabase) {
    if (item.tinyURL === idString) {
      goHere.push(item.fullURL);
    }
  }
  if (goHere.length > 0) {
    return res.redirect(302, goHere.join(''));
  } else {
    return res.status(404).send('Sorry. That URL is not in our database. 😞 Would you like to <a href="/urls/new">make one</a>?');
  }
});

app.get('/', (req, res) => {
  if (req.session.user_id) {
    res.redirect('/urls');
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  if (!req.session.user_id) {
    const templateVars = { user: getUserObj(req.session.user_id) };
    res.render('urls_login', templateVars);
  } else {
    res.redirect('/urls');
  }
});

app.get('/register', (req, res) => {
  if (!req.session.user_id) {
    const templateVars = {
      user: getUserObj(req.session.user_id),
    };
    res.render('urls_register', templateVars);
  } else {
    res.redirect('/urls');
  }
});

// POST requests (most to least specific)
app.post('/urls/:id/delete', (req, res) => {
  const toBeDel = req.params.id;
  for (const index in urlDatabase) {
    if (urlDatabase[index].tinyURL === toBeDel) {
      urlDatabase.splice(index, 1);
    }
  }
  res.redirect('/urls');
});

app.post('/urls/:id', (req, res) => {
  const idString = req.params.id;
  if (req.session.user_id && isThisYours(idString, req.session.user_id)){
    const newFull = req.body.newFull;
    for (const index in urlDatabase) {
      if (urlDatabase[index].tinyURL === idString) {
        urlDatabase[index].fullURL = newFull;
      }
    }
    res.redirect(`/urls/${idString}`);
  } else {
    res.send('Sorry, pal. You can\'t do that. Are you <a href="/login">logged in</a> to the right account?')
  }
});

app.post('/urls', (req, res) => {
  const idString = generateRandomString();
  const inputURL = req.body.longURL;
  urlDatabase.push({ tinyURL: idString, fullURL: inputURL, owner: req.session.user_id });
  res.redirect(`/urls/${idString}`);
});

app.post('/login', (req, res) => {
  // does email match a user in the database?
  const submittedEmail = req.body.email;
  const emailMatchCheck = emailMatchChecker(submittedEmail); // boolean

  // does hashed input password match hashed stored password?
  const storedPassword = findPassword(submittedEmail);
  const passwordMatchCheck = bcrypt.compareSync(req.body.password, storedPassword); // boolean

  const userID = findUserID(submittedEmail);

  if (emailMatchCheck && passwordMatchCheck) {
    req.session.user_id = users[userID].id;
    res.redirect('/urls');
  } else if (!emailMatchCheck || !passwordMatchCheck) {
    res.send('Sorry, pal. Your email or password do not match. Try <a href="/login">logging in</a> again or <a href="/register">register an account</a>. 🚶');
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.redirect('/urls');
});

app.post('/register', (req, res) => {
  for (const user in users) {
    if (users[user].email === req.body.email) {
      res.status(400).send('Email is already in the system. Try <a href="/login">logging in</a>.');
    }
  }
  if (req.body.email && req.body.password) {
    req.session.user_id = generateRandomString();
    users[req.session.user_id] = {
      id: req.session.user_id,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 10),
    };
    res.redirect('/urls');
  } else {
    res.status(400).send('Yeah, we can\'t exactly register you with empty fields... <a href="/register">Try again</a>.');
  }
});

app.listen(PORT, () => {
  console.log(`Shmoo's tiny app listening on port ${PORT}!`);
});

// HELPER functions
function generateRandomString() {
  const everyAlphaNum = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  const output = [];
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * Math.floor(61));
    output.push(everyAlphaNum[randomIndex]);
  }
  return output.join('');
}

function getUserObj(theCookie) {
  const userObj = users[theCookie];
  return userObj;
}

function findUserID(email) {
  let output;
  for (const user in users) {
    if (users[user].email === email) {
      output = users[user].id;
      return output;
    }
  }
}

function urlsForUser(id) {
  const ownedURLs = [];
  urlDatabase.forEach((url) => {
    if (url.owner === id) {
      ownedURLs.push(url);
    }
  });
  return ownedURLs;
}

function emailMatchChecker(email) {
  for (const user in users) {
    if (users[user].email === email) {
      return true;
    }
  }
}

function findPassword(email) {
  for (const user in users) {
    if (users[user].email === email) {
      return users[user].password;
    }
  }
}

function urlDatabaseChecker(shortURL) {
  for (const url of urlDatabase) {
    if (url.tinyURL === shortURL) {
      return true;
    }
  }
}

function isThisYours(shortURL, userID) {
  for (const url of urlDatabase) {
    if (url.tinyURL === shortURL) {
      if (url.owner === userID) {
        return true;
      }
    }
  }
}
