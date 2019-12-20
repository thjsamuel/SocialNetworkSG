var express = require('express');
var router = express.Router();
var boardFunc = require('../modular/UtilityBoardFunc.js')
var userFunc = require('../modular/UtilityUserFunc.js')
var path = require('path');

var user_controller = require('../controllers/userController');

const passport = require("passport");

router.get('/postlist_js', function (req, res) { 
  res.sendFile(path.join(__dirname, '..', '/views/postload.js'));
});

router.post('/list_posts', user_controller.get_postsList)

// GET catalog home page.
router.get('/', async function (req, res, next) {
  var temp = req.session.method
  if (req.session.method == 'POST')
    req.session.method = 'GET'
  if (req.user != null)
  {
    let getPending = new Promise(function (resolve, reject) {
      boardFunc.findBoardByUser(req.user, function(err, board) {
        resolve(board.pendingPals)
      }, true);
    });
    let pending = await getPending
    let waiting = await userFunc.getPendingConnections(req.user.id)
    console.log(waiting)
    res.render('index', { title: '<ONE SG>', user: req.user, metho: temp == 'POST' ? true : false, pending: pending, waiting: waiting });
  }
  else
    res.render('index', { title: '<ONE SG>', user: req.user, metho: temp == 'POST' ? true : false, pending: [] });
});

router.post('/', function (req, res, next) {
  boardFunc.findBoardByUser(req.user, function(err, board) {
    let access_lvl = boardFunc.e_access.FAIL
    if (req.body.soft == "accept_conn") // check if two users are known
    {
      access_lvl = boardFunc.findUserInPals(req.body.id, board)
      if (access_lvl == boardFunc.e_access.PUBLIC)
      {
          let id = req.body.id.substring(0, req.body.id.length - 1);
          boardFunc.removeUserInPending(id, board)
          board.pals.push(id)
          board.save(err => {
              if (err) return next(err);
          });
          userFunc.removeUserFromPending(id, req.user.id)
      }
    }
    else if (req.body.soft == "refuse_conn") // check if two users are known
    {
      let id = req.body.id.substring(0, req.body.id.length - 1);
      boardFunc.removeUserInPending(id, board)
      board.save(err => {
        if (err) return next(err);
      });
      userFunc.removeUserFromPending(id, req.user.id)
    }
  });
  return res.redirect('/pages')
});

/// SIGN UP ///
router.get("/sign-up", (req, res) => res.render("signup", { title: 'SIGN UP' }))

router.post("/sign-up", user_controller.sign_up);

router.get('/log-in', function (req, res, next) {
  res.redirect('/pages')
});

router.post("/log-in", function(req, res, next) {
  req.session.method = req.method
  next()
});

router.post("/log-in",passport.authenticate('local', {
  //successRedirect: "/",
  failureRedirect: "/pages",
  failureFlash: true
}), function (req, res){
  req.flash('wrong', 'You have failed!')
  //req.app.locals.msg = req.flash()
  res.redirect('/pages')
  //res.render('index', { title: 'SG SOCIAL', user: req.user/*, error: req.flash('wrong')*/ });
});

router.get("/log-out", (req, res) => {
  req.logout();
  res.redirect("/");
});

/// USER ROUTES ///

/*// GET request for creating Author. NOTE This must come before route for id (i.e. display author).
router.get('/user/create', author_controller.author_create_get);

// POST request for creating Author.
router.post('/user/create', author_controller.author_create_post);

// GET request to delete Author.
router.get('/user/:id/delete', author_controller.author_delete_get);

// POST request to delete Author
router.post('/user/:id/delete', author_controller.author_delete_post);

// GET request to update Author.
router.get('/user/:id/update', author_controller.author_update_get);

// POST request to update Author.
router.post('/user/:id/update', author_controller.author_update_post);
*/
// GET request for one User.
router.get('/user/:id', user_controller.user_detail);

// POST request for create post.
router.post('/user/:id', user_controller.user_detail); //?soft=compose_new

// GET request for list of all Authors.
//router.get('/user', user_controller.user_list);

module.exports = router;
