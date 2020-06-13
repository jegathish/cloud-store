var express = require('express');
var router = express.Router()
var auth = require("../controllers/AuthController.js");

router.get('/', checkAuthenticated, auth.home);

router.get('/register', checkNotAuthenticated, auth.register);

router.post('/register', checkNotAuthenticated, auth.doRegister);

router.get('/login', checkNotAuthenticated, auth.login);

router.post('/login', checkNotAuthenticated, auth.doLogin);

router.get('/logout', checkAuthenticated, auth.logout);


//authenticatication for route
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
  
    res.redirect('/login')
  }
  
  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/')
    }
    next()
  }
  
  
  module.exports = router;