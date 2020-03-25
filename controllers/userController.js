var async = require('async')
const bcrypt = require('bcryptjs');
var User = require('../models/user')
var userFunc = require('../modular/UtilityUserFunc.js')
var boardFunc = require('../modular/UtilityBoardFunc.js')
var postFunc = require('../modular/UtilityPostFunc.js')

const { body, check, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator/filter');

exports.get_postsList = async function (req, res, next) {
    userFunc.getPgUser(req.body.id, function(pguser) { // get viewing pg id as well as tell whether is same as req user
        boardFunc.findBoardByUser(pguser, async function(err, board) { // get user's board based on user id, awaits user action promise
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

exports.index = function(req, res) {
    async.parallel({
        user_count: function(callback) {
            User.count(callback);
        },
    }, function(err, results) {
        res.render('index', { title: 'Local Library Home', error: err, data: results });
    });
};

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

// Display list of all Users.
exports.user_list = function (req, res, next) {
    User.find()
        .sort([['family_name', 'ascending']])
        .exec(function (err, list_authors) {
            if (err) { return next(err); }
            // Successful, so render.
            res.render('author_list', { title: 'Author List', author_list: list_authors });
        })
};

// Display detail page for a specific user.
exports.user_detail = async function (req, res, next) {
    if (req.app.locals.isPressed == undefined)
    {
        console.log("Created")
        req.app.locals.isPressed = { up: false }
    }
    
    if (req.query.soft != undefined && req.query.soft === "compose_new")
    {
        req.app.locals.isPressed.up = true

        req.session.save(function(err) {
        // session updated
        })
        req.session.reload(function(err) {
        // session updated
        })
    }

    userFunc.checkUsersRSame(req, function(pg) { // get viewing pg id as well as tell whether is same as req user
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
                    res.render('user_detail', { title: "<ONE-SG>", currUser: req.user, currUserId: user_id, userName: pg.user.username, user: pg.user, requrl: req.originalUrl, relation: access_lvl, access: boardFunc.e_access, display: postsShowcase, res: res, pass2View: wait, moderatorId: '5e68eb4324d56a31049cee2f', });
                })
            }
        });
    });
};

// Display User create form on GET.
exports.user_posts_get = function (req, res, next) {
    res.render('user_detail', { isCompose: true });
};

// Display User create form on GET.
exports.user_create_get = function (req, res, next) {
    res.render('user_form', { title: 'Create User' });
};

// Handle User create on POST.
exports.user_create_post = [

    // Validate fields.
    body('first_name').isLength({ min: 1 }).trim().withMessage('First name must be specified.')
        .isAlphanumeric().withMessage('First name has non-alphanumeric characters.'),
    body('family_name').isLength({ min: 1 }).trim().withMessage('Family name must be specified.')
        .isAlphanumeric().withMessage('Family name has non-alphanumeric characters.'),
    body('password').isLength({ min: 1 }).trim().withMessage('password must be specified.'),
    body('date_of_birth', 'Invalid date of birth').optional({ checkFalsy: true }).isISO8601(),
    body('date_of_death', 'Invalid date of death').optional({ checkFalsy: true }).isISO8601(),

    // Sanitize fields.
    sanitizeBody('first_name').escape(),
    sanitizeBody('family_name').escape(),
    sanitizeBody('password').escape(),
    sanitizeBody('date_of_birth').toDate(),
    sanitizeBody('date_of_death').toDate(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create Author object with escaped and trimmed data
        var user = new User(
            {
                first_name: req.body.first_name,
                family_name: req.body.family_name,
                password: req.body.password,
                date_of_birth: req.body.date_of_birth,
                date_of_death: req.body.date_of_death,
            }
        );

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/errors messages.
            res.render('user_form', { title: 'Create User', user: user, errors: errors.array() });
            return;
        }
        else {
            // Data from form is valid.

            // Save author.
            author.save(function (err) {
                if (err) { return next(err); }
                // Successful - redirect to new author record.
                res.redirect(user.url);
            });
        }
    }
];

// Display Author delete form on GET.
exports.user_delete_get = function (req, res, next) {

    async.parallel({
        author: function (callback) {
            Author.findById(req.params.id).exec(callback)
        },
        authors_books: function (callback) {
            Book.find({ 'author': req.params.id }).exec(callback)
        },
    }, function (err, results) {
        if (err) { return next(err); }
        if (results.author == null) { // No results.
            res.redirect('/catalog/authors');
        }
        // Successful, so render.
        res.render('author_delete', { title: 'Delete Author', author: results.author, author_books: results.authors_books });
    });

};

// Handle Author delete on POST.
exports.author_delete_post = function (req, res, next) {

    async.parallel({
        author: function (callback) {
            Author.findById(req.body.authorid).exec(callback)
        },
        authors_books: function (callback) {
            Book.find({ 'author': req.body.authorid }).exec(callback)
        },
    }, function (err, results) {
        if (err) { return next(err); }
        // Success.
        if (results.authors_books.length > 0) {
            // Author has books. Render in same way as for GET route.
            res.render('author_delete', { title: 'Delete Author', author: results.author, author_books: results.authors_books });
            return;
        }
        else {
            // Author has no books. Delete object and redirect to the list of authors.
            Author.findByIdAndRemove(req.body.authorid, function deleteAuthor(err) {
                if (err) { return next(err); }
                // Success - go to author list.
                res.redirect('/catalog/authors')
            })

        }
    });

};

// Display Author update form on GET.
exports.author_update_get = function (req, res, next) {

    Author.findById(req.params.id, function (err, author) {
        if (err) { return next(err); }
        if (author == null) { // No results.
            var err = new Error('Author not found');
            err.status = 404;
            return next(err);
        }
        // Success.
        res.render('author_form', { title: 'Update Author', author: author });

    });
};

// Handle Author update on POST.
exports.author_update_post = [

    // Validate fields.
    body('first_name').isLength({ min: 1 }).trim().withMessage('First name must be specified.')
        .isAlphanumeric().withMessage('First name has non-alphanumeric characters.'),
    body('family_name').isLength({ min: 1 }).trim().withMessage('Family name must be specified.')
        .isAlphanumeric().withMessage('Family name has non-alphanumeric characters.'),
    body('date_of_birth', 'Invalid date of birth').optional({ checkFalsy: true }).isISO8601(),
    body('date_of_death', 'Invalid date of death').optional({ checkFalsy: true }).isISO8601(),

    // Sanitize fields.
    sanitizeBody('first_name').escape(),
    sanitizeBody('family_name').escape(),
    sanitizeBody('date_of_birth').toDate(),
    sanitizeBody('date_of_death').toDate(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create Author object with escaped and trimmed data (and the old id!)
        var author = new Author(
            {
                first_name: req.body.first_name,
                family_name: req.body.family_name,
                date_of_birth: req.body.date_of_birth,
                date_of_death: req.body.date_of_death,
                _id: req.params.id
            }
        );

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values and error messages.
            res.render('author_form', { title: 'Update Author', author: author, errors: errors.array() });
            return;
        }
        else {
            // Data from form is valid. Update the record.
            Author.findByIdAndUpdate(req.params.id, author, {}, function (err, theauthor) {
                if (err) { return next(err); }
                // Successful - redirect to genre detail page.
                res.redirect(theauthor.url);
            });
        }
    }
];
    
