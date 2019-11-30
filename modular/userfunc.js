var async = require('async')
var User = require('../models/user')
var Connect = require('../models/board')
var Post = require('../models/post')

// find user based on id
function waitUserFind(req, next, cb) {
    findUser(req.params.id, function(err, user) {
        cb(checkUsersSame(err, user, req, next))
    });
}

// check if users on page are same
function checkUsersSame (err, data, req, next) {
    if (err) {
      var err = new Error('User not found');
      err.status = 404;
      return next(err);
    } //return next(err); } // Error in API usage.

    let viewed = data[0]

    if (viewed == null) { // No results.
        var err = new Error('User not found');
        err.status = 404;
        return next(err);
    }

    let same = false
    
    if (req.user != undefined && req.user.id === viewed.id)
    {
        same = true
    }
    
    let obj = {viewed: viewed, same: same}
    return obj
}

// Connect the users, if a connection does not exist, show the pg's user's posts or else show their shared posts
function waitConnectUsers (req, next, viewed, same, cb) {
    let data = { two: null }
    findConnect(req.user, viewed, function (err, connect) {
        // if user is "getting" a page, create a connect between them"
        data.two = connect[0]
        if  (connect[0] == null && req.method == "GET") {
            let pgUser = Connect.findOne({ pal:viewed,palOther:viewed })
            pgUser.exec(function (err, sameUser) {
                if (err) cb(null, err)
                data.two = sameUser
                cb(createPost(err, data, req, next, same, viewed))
            });
        }
        else // if user posting, then the final callback gets null so that a connect is created later
        {
            cb(createPost(err, data, req, next, same, viewed))
        }
    });

    
};

// Create a post and return things needed for the display later
function createPost(err, data2, req, next, same, viewed) {
    let post = null
    if (req.query.soft != undefined && req.method == "POST")
    {
        let postDetail
        /// not profile pg user
        if (same)
        {
            postDetail = {owner: req.user, txt_cont:req.body.posttxt, comment_list:[], liked_list:[], is_public:true, created: new Date()}
        }
        else
        {
            postDetail = {owner: req.user, ref_user: viewed, txt_cont:req.body.posttxt, comment_list:[], liked_list:[], is_public:false, created: new Date()}
        }

        post = new Post(postDetail)
        post.save(err => {
            if (err) return next(err);
        })
    }
    var varList = {
        title: "<ONE-SG>",
        currUser: req.user,
        userName: viewed.name, 
        user: viewed, 
        requrl: req.originalUrl, 
        relation: data2,
        post: post
    }
    return varList
    /*let damn = null
    createConnect(post, data2, req, next, same, viewed, function(cbr) {
        damn = cbr
    });
    return damn*/
}

// Create a connection if such a connection doesn't exist
function createPushConnect(post, data2, req, next, same, viewed, cb) {
    let connect = null
    if (req.query.soft != undefined && req.method == "POST")
    {
        if (data2.two == null)
        {
            let connectDetail = {pal: req.user, palOther: viewed, shared: []}

            if (post != null)
            {
                connectDetail.created = post.created
                connectDetail.shared.push(post.id)
            }
            connect = new Connect(connectDetail)
            connect.save(err => {
            if (err) return next(err);
            })

            console.log("try " + connect)
            // duplicate
            if (post != null)
            {
                req.user.connections.push(connect)
                if (!same)
                {
                    viewed.connections.push(connect)
                }
            }
        }
        else {
            if (post != null)
                data2.two.shared.push(post.id)
            console.log("try " + data2.two)
            data2.two.save(err => {
                if (err) return next(err);
            })
        }
        
        req.user.save();
        if (!same)
        {
            viewed.save()
        }
    }
    if (req.query.soft != undefined && req.query.soft == "know_new")
    {
        console.log("dafudq")
        findConnect(req.user, viewed, function (err, found) {
            if (found[0] == null)
            {
                connect = createConnect(req.user, viewed, true)
                console.log("ok " + connect)
                req.user.connections.push(connect)
                viewed.connections.push(connect)
                req.user.save(); viewed.save()
            }
        });
    }

    return cb(connect)
}
              
function waitPopulatePosts(data2, cb)
{
    async.parallel([
        function (callbackLast) {
            if (data2.two != null && data2.two.shared.length > 0)
            {
                let tempArr = []
                let arrlen = data2.two.shared.length
                let ind = {v: 0};
                walao(data2.two.shared, tempArr, ind, callbackLast, function(gate) {
                    return callbackLast(null, tempArr)
                })
            }
            else // needed or callback duplicates
            {
                return callbackLast(null, [])
            }
        },
    ], function checkUserConnectPopulatePostForView (err, postArr) {
        // Successful, so render.
        var varList = { 
            relation: data2.two, 
            display: postArr[0]
        }
        cb(varList)
        //res.render('user_detail', { title: "<ONE-SG>", currUser: req.user, userName: viewed.name, user: viewed, requrl: req.originalUrl, relation: data2.two, display: postArr[0] });
    });
}

async function walao(indArr, arr, ind, func, cb) {
    shared = indArr[ind.v]
    prom = new Promise((resolve, reject) => {
        console.log(" share " + shared)
        let condition = findingPost(shared)
        if (condition != undefined)
        {
            resolve(condition)
        }
    });
    prom.then((post) => {
        arr.push(post)
        ind.v++
        if (ind.v == indArr.length)
        {
            cb(true)
            if (ind.v == 0)
                func(null, arr)
        }
        else
        {
            walao(indArr, arr, ind, func, function(c) {
                func(func, arr)
            })
        }
    });
}

async function findingPost(postId) {
    var foundPost = await findPost(postId)
    //arr.push(foundPost[0])
    console.log(foundPost)
    return foundPost
}

function findPost(postId)
{
    return new Promise((resolve, reject) => {
        console.log(" id " + postId)
        var post = Post.findById(postId).populate('owner')
        post.exec(function (err, foundPost) {
            if (err) return handleError(err);
            console.log("wow" + foundPost)
            if (foundPost != null)
            {
                resolve(foundPost)
            }
        });
    });
}

function findConnect(requser, viewed, cb) {
    async.parallel([
        function (callback) {
            var re = Connect.findOne({$or:[{ pal:requser,palOther:viewed }, { pal:viewed,palOther:requser }]})
            re.exec(function (err, found) {
                if (err) {
                    var err = new Error('Connect Not Found');
                    err.status = 404;
                    return callback(err);
                }
                if (found != null)
                    return callback(null, found)
                else
                    return callback(null, null)
            }); 
        },
    ], function foundConnect (err, connect) {
        if (err)
            return cb(err, null)
        if (connect)
            return cb(err, connect)
    });
}

function findUser(userid, cb) {
    async.parallel([
        function (callback) {
            var user = User.findById(userid) // find pg user by id
            user.exec(function (err, found) {
                if (err) { 
                    var err = new Error('User Not Found');
                    err.status = 404;
                    return callback(err);
                }
                return callback(null, found);     
            });
        },
    ],  function foundUser(err, found) { 
        if (err)
            return cb(err, null)
        return cb(err, found) 
    });
};

function createConnect(requser, viewed, known) {
    let connectDetail = {pal: requser, palOther: viewed, shared: [], known: known}

    connectDetail.created = new Date()
    let connect = new Connect(connectDetail)

    connect.save(err => {
    if (err) return next(err);
    });

    return connect
}

module.exports.waitForResponse = waitUserFind;
module.exports.waitForResponse2 = waitConnectUsers;
module.exports.makeConnect = createPushConnect;
module.exports.waitPost = waitPopulatePosts;
module.exports.findConnect = findConnect;
module.exports.findUser = findUser;