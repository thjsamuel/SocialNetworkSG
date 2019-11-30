var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
//Import the mongoose module
var mongoose = require('mongoose');

var index = require('./routes/index');
var users = require('./routes/users');
var routeHandle = require('./routes/pages');
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
var flash = require('connect-flash-plus');
var User = require('./models/user')
const bcrypt = require('bcryptjs');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

//Set up default mongoose connection
//mongodb://127.0.0.1/my_database
var mongoDB = 'mongodb://localhost:27017/store_loc';
mongoose.connect(mongoDB, { useNewUrlParser: true });
//Get the default connection
var db = mongoose.connection;
//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

/*passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
      if (err) return done(err);
      if (!user) {
        return done(null, false, { msg: "Incorrect username" });
      }
      bcrypt.compare(password, user.password, (err, res) => {
  	if (res) {
    	// passwords match! log user in
    	return done(null, user)
  	} else {
    	// passwords do not match!
    	return done(null, false, {msg: "Incorrect password"})
  	}
	})
    });
  })
);*/

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser('keyboard cat'));
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({ secret: 'P@ssw0rd', resave: true, saveUninitialized: true, cookie: { secure: false } }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
//app.use(express.urlencoded({ extended: false })); connect middleware not supported in express 4.x

app.use(function(req, res, next) {
  req.app.locals.isPressed = { up: false } // this is horrible code that is ccalled too many times
  req.flash('success').pop()
  res.locals.msg = req.flash('success', 'Logged in successfully!')
  res.locals.input_err = req.flash('input_err')
  res.locals.success_msg = req.flash('success_msg')
  next();
});

passport.serializeUser(function(user, done) {
  return done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    return done(err, user);
  });
});

passport.use(
  new LocalStrategy({
  passReqToCallback : true
}, (req, username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
      if (err) return done(err);
      if (!user) {
        req.flash('error').pop()
        req.app.locals.message = req.flash()
        //req.flash('success').length = 0
        return done(null, false, { message: 'Incorrect username.' });
      }
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) throw err;
        if (isMatch)
        {
          return done(null, user);
        }
        else
        {
          req.flash('error').pop()
          req.app.locals.message = req.flash()
          return done(null, false, { message: 'Incorrect password.' });
        }
      });
    });
  })
);

app.use('/', index);
app.use('/users', users);
app.use('/pages', routeHandle); // Add routes to middleware chain

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.locals.error_msg = req.flash('error_msg')
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
