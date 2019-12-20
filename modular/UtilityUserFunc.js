var async = require('async')
var User = require('../models/user')
var Mongoose = require('mongoose');

// find user based on id
function checkPgUser(req, cb) {
    findUser(req.params.id, function(err, user) {
        cb(checkUsersSame(err, user[0], req.user))
    });
}

// find user based on id
function checkPgUserByid(id, cb) {
    findUser(id, function(err, user) {
        cb(user)
    });
}

function findUser(userid, cb) {
    async.parallel([
        function (callback) {
            let id = Mongoose.Types.ObjectId(userid)
            var user = User.findById(id) // find pg user by id
            user.exec(function (err, found) {
                if (err) { 
                    var err = new Error('User Not Found');
                    err.status = 404;
                    return callback(err);
                }
                return callback(null, found);     
            });
        },
    ],  function retUser(err, found) { 
        if (err)
            return cb(err, null)
        return cb(err, found) 
    });
};

function findUserQuery(userid, cb) {
    async.parallel([
        function (callback) {
            var user = User.findById(userid) // find pg user by id
            callback(null, user);     
        },
    ],  function retUser(err, que) { 
        if (err)
            return cb(err, null)
        return cb(err, que[0]) 
    });
};

// check if users on page are same
function checkUsersSame (err, u1, u2) {
    if (err) {
      var err = new Error('User not found');
      err.status = 404;
      return err;
    }

    if (u1 == null) { // No results.
        var err = new Error('User not found');
        err.status = 404;
        return err;
    }

    let same = false
    
    if (u2 != undefined && u2.id === u1.id)
    {
        same = true
    }
    
    let obj = {user: u1, same: same}
    return obj
}

// remove user from pending Connection
function removeUserFromPending (ownerId, removeId) {
    findUser(ownerId, function(err, user) {
        user = user[0]
        for (let i = 0; i < user.pendingConn.length; ++i) {
            if (user.pendingConn[i] == removeId)
            {
                user.pendingConn.splice(i, 1)
                user.save(err => {
                    if (err) return next(err);
                });
            }
            break
        }
    });
}

// return the pending connections populated
function p_getPendingConnections (u1id) {
    return new Promise(async function (resolve, reject) {
        findUserQuery(u1id, function (err, userQuery) {
            userQuery.populate({path: 'pendingConn', model: 'User'}).exec(function (err, user) {
                resolve (user.pendingConn)
            });
        });
    });
}

module.exports.checkUsersRSame = checkPgUser;
module.exports.getPgUser = checkPgUserByid;
module.exports.removeUserFromPending = removeUserFromPending;
module.exports.getPendingConnections = p_getPendingConnections;