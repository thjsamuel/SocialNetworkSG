var async = require('async')
const bcrypt = require('bcryptjs');
var User = require('../models/user')
var userFunc = require('../modular/UtilityUserFunc.js')
var boardFunc = require('../modular/UtilityBoardFunc.js')
var postFunc = require('../modular/UtilityPostFunc.js')

const { body, check, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator/filter');

/**
 * Get lists of posts from a board and send it through. * @routed
 * @property {function} userFunc.getPgUser - page owner's id.
 * @property {function} boardFunc.findBoardByUser - get board using above owner's id.
 * @property {function} postFunc.getPostsInBoard
*/

exports.get_postsList = async function (req, res, next) {
    userFunc.getPgUser(req.body.id, function(pguser) {
        boardFunc.findBoardByUser(pguser, async function(err, board) {
            if (board != null)
            {
                let post_list = postFunc.getPostsInBoard(board)
                post_list.then(function (posts) {
                    res.send(posts)
                });
            }
        });
    });
}

/**
 * Sign up page validation and create user, redirects to main page. * @routed
 * @summary redirect to page with flash msg if err or redirect to main page
 * @property {express-validator/filter} check
 * @property {express-validator} validationResult - get result of validators.
 * @property {function} postFunc.getPostsInBoard
 * @summary encrypts password and creates user/board
 * @property {bcrypt} bcrypt
 * @property {function} user.save() - saves a user into mongodb
 * @property {function} boardFunc.createBoard() - create board after user is created
*/

exports.sign_up = [
  // validate results
  check('email').isEmail().withMessage('Please provide a valid email.'),
  check('password').not().isEmpty().trim().escape().isLength({ min: 6 }).withMessage('Password must be more than 6 characters.'),
  check('username').not().isEmpty().trim().escape().isLength({ min: 2 }).withMessage('Username must be more than 2 characters.'),
  function(req, res, next) {
  var {username, password, passwordcfm, email} = req.body
  let error = []
  if (!username || !password || !passwordcfm || !email)
  {
    error.push({msg: 'please fill in fields'});
    req.flash('input_err').pop()
    req.flash('input_err', 'Please fill in the fields');
    if (!username)
      req.flash('input_err', 'Please enter the username.');
    if (!password)
      req.flash('input_err', 'Please enter the password.');
    if (!passwordcfm)
      req.flash('input_err', 'Please confirm your password.');
    if (!email)
      req.flash('input_err', 'Please enter your email.');
    return res.redirect("/pages/sign-up");
  }

  if (password !== passwordcfm)
  {
    //if (req.flash('input_err')[0] == '')
    req.flash('input_err').pop()
    req.flash('input_err', 'Passwords do not match, make sure they are the same');
    return res.redirect("/pages/sign-up");
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('input_err').pop()
    // item replaces errors.array()[i], convert the bottom to template strings
    let printItems = function(item) {return req.flash('input_err', item["msg"] + ' ' + '\"' + item["value"] + '\" ' + 'is not a valid ' + item["param"]); }
    errors.array().map(printItems)
    //errors.array().map(item => req.flash('input_err', item["msg"] + ' ' + '\"' + item["value"] + '\" ' + 'is not a valid ' + item["param"])); // i replaces errors.array()[i]
    /*for (let i = 0; i < errors.array().length; i++) {
      req.flash('input_err', errors.array()[i]["msg"] + ' ' + '\"' + errors.array()[i]["value"] + '\" ' + 'is not a valid ' + errors.array()[i]["param"]);
    }*/
    return res.redirect("/pages/sign-up");
    //return res.status(422).json({ errors: errors.array() });
  }

  userDetail = {first_name: req.body.firstname, family_name: req.body.lastname, username: username, email: email}
  if (req.body.dateofbirth != false)
    userDetail.date_of_birth = req.body.dateofbirth
  userDetail.date_of_death = undefined
  userDetail.created = new Date()
  userDetail.posts = []
  userDetail.connections = []

  // Hash password
  // can also .hash("somePassword", 10,...
  let salt = bcrypt.genSalt(10, (err, salt) => {
    let hash = bcrypt.hash(password, salt, (err,hash) => {
     if (err) { throw err; }
     password = hash
     userDetail.password = password
     let user = new User(userDetail)
     // no errors in validation, store user in database
     user.save(err => {
       if (err) return next(err);
     })
     req.flash('success_msg').pop()
     req.flash('success_msg', 'Successfully registered! Log in to see contents!');

     boardFunc.createBoard(user)

     return res.redirect("/pages");
   })
 })
} ]

/**
 * Sends user own page/board, contains async/await. * @routed
 * @summary create post and stores post in board
 * @property {function} userFunc.checkUsersRSame - get cb containing page owner's id and whether user same boolean.
 * @property {function} boardFunc.findBoardByUser - get board using above owner's id.
 * @property {boardFunc.e_access} access_lvl - what access level does the person viewing page have
 * @property {function} postFunc.createPost - create post based on request query obj
 * @property {function} boardFunc.storePostInBoard - await post created and store in board (board created in sign up)
 * @property {locals} wwwConn.sockio - socket IO obj initialized in app locals from ./bin/www
 * @property {req} body.soft - soft requests modify the db (e.g. compose_new)
 * @property {req} query.hard - hard request delete from db (e.g. del_one_post)
 * @summary removes post from board and deletes post, eventually deletes board
 * @property {function} boardFunc.removePostInBoard
 * @property {function} postFunc.deletePostById
 * @property {function} wwwConn.emitClientRefresh - tells specific client to refresh post
 * @summary befriends users so they can view each other's posts and comment on them
 * @property {function} boardFunc.findUserInPals - checks whether viewing user is in pg owner's friend's list using access_lvl
 * @property {function} boardFunc.findUserInPending - checks whether viewing user is in pg owner's pending list using access_lvl
 * @summary display replies/comments (e.g. reply_display)
 * @property {variable} sockid - emit to all users except the one that send comment
 * @property {variable} id - tells view to update only post that's commented on through socket emit
 * @summary create reply/comment and then update page to reflect comment on post (e.g. reply_post)
 * @property {function} postFunc.createComment
 * @property {function} postFunc.addCommentToPost - add comment to post mongo model instance
 * @summary Waits for above to be *resolved*, post list to be loaded before displaying appropriate pg based on whether user viewing and page owner are, same/friends/not related
 * @property {function} res.render - renders a pug page based with template variables passed in, template variables are not persistent in view when modified
*/ 
// Display detail page for a specific user.
exports.user_detail = async function (req, res, next) {

    userFunc.checkUsersRSame(req, function(pg) { // get viewing pg id as well as tell whether is same as req user
        if (pg == null)
        {
            var err = new Error('Not Found');
            err.status = 404;
            res.status(err.status || 500);
            res.render('error', {error: err});
            res.end()
        }
        boardFunc.findBoardByUser(pg.user, async function(err, board) { // get user's board based on user id, awaits user action promise
        let access_lvl = boardFunc.e_access.FAIL
            let prom = new Promise(async function (resolve, reject) { // promise for button clicks, and awaits asset creation
                if (req.method == "POST" && req.body.soft == "compose_new") // url query string is present and POST
                {
                    post = await postFunc.createPost(req, pg.user, pg.same) // create a post, waits for green light to continue scope execution
                    await boardFunc.storePostInBoard(post, board, req.user)
                    req.app.locals.wwwConn.sockio.emit('chat update', null)
                    resolve(true) // tell view to display, true as we modified db
                }
                else if (req.query.hard != undefined && req.method == "POST" && req.body.hard == "del_one_post") // HARD query to delete and POST
                {
                    if (req.query.hard == "del_one_post") // user posting on his own board
                    {
                        let id = req.body.marked_post//.substring(0, req.body.marked_post.length - 1);
                        boardFunc.removePostInBoard(id, board)
                        await postFunc.deletePostById(id)
                        req.app.locals.wwwConn.emitClientRefresh(req.user.id, 'chat update')
                        resolve(true)
                    }
                }
                else // req body or GET requests
                {
                    if (Array.isArray(req.body.soft))
                        req.body.soft = req.body.soft[0]

                    if (req.query.soft == "know_new") // check if two users are known
                    {
                        let access_flag = boardFunc.findUserInPals(req.user.id, board) // get access level of current user
                        access_lvl = boardFunc.findUserInPending(req.user.id, board) // get access level of current user
                        if (access_lvl == boardFunc.e_access.PUBLIC && access_flag == boardFunc.e_access.PUBLIC) { // if user only can view public setting
                            board.pendingPals.push(req.user.id)
                            board.save(err => {
                                if (err) return next(err);
                            });
                            req.user.pendingConn.push(pg.user.id)
                            req.user.save(err => {
                                if (err) return next(err);
                            });
                        }
                        resolve(true) // tell view to display, we modified the board
                    }
                    else if (req.query.soft == "reply_display") // check if two users are known
                    {
                        let id = req.query.postid
                        let sockid = req.query.sockid
                        //resolve({postId: id}); // without ajax/socket.io, if refreshing page, then need this line
                        req.app.locals.wwwConn.sockio.sockets.connected[sockid].emit('chat update', id);
                    }
                    else if (req.body.soft == "reply_post")
                    {
                        comment = await postFunc.createComment(req);
                        let id = req.body.postid;
                        await postFunc.addCommentToPost(id, comment)
                        req.app.locals.wwwConn.sockio.emit('chat update', null)
                        resolve(true)
                    }
                    resolve(false) // tell view to display
                }
            });
            let wait = await prom // waits for confirmation to execute view related functions
            if (board != null) // debug why is board null sometimes?
            {
                let post_list = postFunc.getPostsInBoard(board)
                if (pg.same) //  if they are the same user, give admin rights
                    access_lvl = boardFunc.e_access.ADMIN
                else if (req.user != undefined) {
                    access_lvl = boardFunc.findUserInPals(req.user.id, board) // check user access rights to the board again
                }
                else {
                    access_lvl = boardFunc.e_access.PUBLIC
                }

                post_list.then(function (postsShowcase) {
                    let user_id = null
                    if (req.user != undefined)
                    {
                        user_id = req.user.id
                    }
                    res.render('user_detail', { title: "<ONE-SG>", currUser: req.user, currUserId: user_id, userName: pg.user.username, user: pg.user, requrl: req.originalUrl, relation: access_lvl, access: boardFunc.e_access, display: postsShowcase, res: res, pass2View: wait });
                })
            }
        });
    });
};

/**
 * Delete a whole user along with its affliated models such as posts/boards/files/comments, contains async/await. * @routed
 * @property {function} boardFunc.removeAllPosts - remove all posts references and saves on board
 * @property {function} postFunc.deletePostById - delete post by id, note that the for of loop () reads array values in sequence and is crucial, and using foreach or map will result in parallel requests for board to save and crash
 * @property {function} userFunc.delete_userById - delete a user
 * @property {function} boardFunc.deleteBoardById - delete a board
*/

// Delete a specific user.
exports.user_delete = function (req, res, next) {
    userFunc.getPgUser(req.user.id, function(user) {
        boardFunc.findBoardByUser(user, async function(err, board) {
            let postlist = await postFunc.getPostsInBoard(board)
            if (postlist != undefined)
            {
                for (const post of postlist) {
                    await boardFunc.removeAllPosts(post.id, board)
                    await postFunc.deletePostById(post.id)
                }
                await userFunc.delete_userById(req.user.id)
                await boardFunc.deleteBoardById(board.id)
            }
            return res.redirect("/pages");
        });
    });
}