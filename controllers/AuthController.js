var mongoose = require('mongoose')
var passport = require("passport")
var User = require("../models/User.js")
var bcrypt = require('bcrypt')
var userController = {};

// depending variables
var date = new Date()

// depending functions
const getUser = async (id) => {
  return User.find({id:id})
    .exec()
    .then(user => {
      if(user!=null)
        return user[0]
      return user })
    .catch(err => {return err.message})
}


//base routes
userController.home = async(req, res) => {
    const user = await getUser(req._passport.session.user)
    res.render('home.ejs', {name : user.name });
};

userController.register = async (req, res) => {
  res.render('register.ejs');
};

userController.doRegister = async (req, res) => {
      try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const user = new User({
          id: Date.now().toString(),
          name: req.body.name,
          email: req.body.email,
          password: hashedPassword,
          mobile: req.body.mobile,
          date: {
            date: date.getDate(),
            month: date.getMonth(),
            year: date.getFullYear(),
            day: date.getDay(),
            time: {
              hour : date.getHours(),
              minute: date.getMinutes(),
              second: date.getSeconds()
            }
          }
        })
        await user.save();
        res.redirect('/login')
      } catch(e) {
        console.log(e)
        res.redirect('/register')
      }    
};
  

userController.login = async (req, res) => {
  res.render('login.ejs');
};


userController.doLogin = passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  })


userController.logout = (req, res) => {
    req.logout();
    res.redirect('/login');
};


module.exports = userController;