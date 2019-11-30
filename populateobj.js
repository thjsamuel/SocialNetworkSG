#! /usr/bin/env node

console.log('This script populates some test books, authors, genres and bookinstances to your database. Specified database as argument - e.g.: populatedb mongodb+srv://cooluser:coolpassword@cluster0-mbdj7.mongodb.net/local_library?retryWrites=true');

// Get arguments passed on command line
var userArgs = process.argv.slice(2); // node(0) populatedb.js(1) 'db url here'(3)

var async = require('async')
var User = require('./models/user')
var Post = require('./models/post')

var mongoose = require('mongoose');
var mongoDB = userArgs[0];
mongoose.connect(mongoDB, { useNewUrlParser: true });
mongoose.Promise = global.Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var users = []

function userCreate(first_name, family_name, username, password, d_birth, d_death, email, posts, created, cb)
{
  userDetail = {first_name: first_name, family_name: family_name, email: email, username: username, password: password}
  if (d_birth != false) userDetail.date_of_birth = d_birth
  if (d_death != false) userDetail.date_of_death = d_death
  if (created != false) userDetail.created = created
  if (posts != undefined) userDetail.posts = posts

  var newUser = new User(userDetail);

  newUser.save(function (err) {
      if (err) {
        cb (err, null)
        return;
      }
      console.log('new user: ' + newUser)
      users.push(newUser)
      cb(null, newUser)
  });
}

function createUsers(cb) {
  async.series([
    function(callback) {
      userCreate('Mark', 'Dinkleberg', 'marky', '999999', '1974-06-07', false, 'sparky@gmail.com', [], '2017-04-06', cb);
    },
  ], cb);
}

async.series([
  createUsers,
],
//optional callback
function(err, results) {
    if (err) {
      console.log('final err: ' + err)
    }
    mongoose.connection.close();
});
