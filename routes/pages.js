var express = require('express');
var router = express.Router();
var boardFunc = require('../modular/UtilityBoardFunc.js')
var userFunc = require('../modular/UtilityUserFunc.js')
var postFunc = require('../modular/UtilityPostFunc.js')
var path = require('path');
var formidable = require('formidable'); // parse the incoming form data (the uploaded files)
var fs = require('fs'); // rename uploaded files
var sha1 = require('sha1');

var user_controller = require('../controllers/userController');

const passport = require("passport");

router.get('/postlist_js', function (req, res) { 
  res.sendFile(path.join(__dirname, '..', '/views/postload.js'));
});

router.post('/install_img', function (req, res) {
  // create an incoming form object
  var form = new formidable.IncomingForm();
  //res.sendFile(path.join(__dirname, '..', '/views/postload.js'));

  // specify that we want to allow the user to upload multiple files in a single request
  form.multiples = true;

  // store all uploads in the /uploads directory
  form.uploadDir = path.join(__dirname, '..', '/public/images');

  // every time a file has been uploaded successfully,
  // rename it to it's orignal name
  /*form.on('file', function(field, file) {
    fs.rename(file.path, path.join(form.uploadDir, file.name));
  });*/

  // log any errors that occur
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });

  // once all the files have been uploaded, send a response to the client
  form.on('end', function() {
    res.end('success');
  });

  // parse the incoming request containing the form data
  form.parse(req, function (err, fields, files) {
    let type = files.uploads.type.substring(files.uploads.type.lastIndexOf('/') + 1)
    let fileid = files.uploads.path.substring(files.uploads.path.lastIndexOf('\\') + 1)
    let shaStr = sha1(fileid + '.' + type)
    let oldpath = files.uploads.path;
    let hashpath = `${form.uploadDir}\\${shaStr.substring(0, 2)}\\${shaStr.substring(2, 4)}`
    let relativepath = `images/${shaStr.substring(0, 2)}/${shaStr.substring(2, 4)}/${shaStr}.${type}`
    let binarySize = files.uploads.size / 1024 // size in kb binary of file
    if (binarySize > 300 && binarySize < 600)
    {
      req.app.locals.wwwConn.sockio.emit('page refresh', {msg: 'Image file is bigger than expected (300 < kb), try reducing it, current size: ' + parseInt(binarySize), id: fields.ind})
    }
    else if (binarySize >= 600) {
      req.app.locals.wwwConn.sockio.emit('page refresh', {msg: 'Image file is too large, try reducing it < 300kb, current size: ' + parseInt(binarySize), id: fields.ind})
    }
    else
    {
    fs.mkdir(hashpath, {recursive: true}, async function(err) {
      if (err) {
        if (err.code == 'EXIST') { 
          let newpath = path.join(hashpath, `${shaStr}.${type}`)
          fs.rename(oldpath, newpath, function (err) {
            if (err) throw err;
          });
      
          let fileDetail = {
            fileId: fileid,
            date: new Date(),
            file_name: files.uploads.name,
            extension: type,
            size: files.uploads.size,
            hash: shaStr,
          }
      
          postFunc.p_addImgToPost(fields.data, fileDetail)
          return null 
        } // ignore the error if the folder already exists
        else { console.log(err); return err }; // something else went wrong
      } else {
        let newpath = path.join(hashpath, `${shaStr}.${type}`)
        fs.rename(oldpath, newpath, function (err) {
          if (err) throw err;
        });
    
        let fileDetail = {
          fileId: fileid,
          fileName: files.uploads.name,
          extension: type,
          fileSize: files.uploads.size,
          hash: shaStr,
          created: new Date(),
        }
    
        await postFunc.p_addImgToPost(fields.data, fileDetail)
        req.app.locals.wwwConn.sockio.emit('img upload', {path: relativepath, ind: fields.ind})
        return null; // successfully created folder
      } 
    }); }
  });
});

router.post('/request_img', function (req, res) {
  var form = new formidable.IncomingForm();
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });

  // once all the files have been uploaded, send a response to the client
  form.on('end', function() {
    res.end('success');
  });
  form.parse(req, async function (err, fields, files) {
    let image_list = await postFunc.listImgsFrPosts(fields.data)
    //console.log(image_list)
    image_list.forEach(async function(images) {
      let img = await postFunc.findFileById(images.id)
      let relativepath = `images/${img.hash.substring(0, 2)}/${img.hash.substring(2, 4)}/${img.hash}.${img.extension}`
      console.log(relativepath + ' ' + fields.ind)
      req.app.locals.wwwConn.sockio.emit('img fill', { path: relativepath, ind: fields.ind })
    });
  });
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
    let access_lvl = boardFunc.e_access.PRIVATE
    res.render('index', { title: '<ONE SG>', user: req.user, metho: temp == 'POST' ? true : false, pending: pending, waiting: waiting, moderatorId: '5e68eb4324d56a31049cee2f', relation: access_lvl, access: boardFunc.e_access });
  }
  else
    res.render('index', { title: '<ONE SG>', user: req.user, metho: temp == 'POST' ? true : false, pending: [], moderatorId: '5e68eb4324d56a31049cee2f', relation: boardFunc.e_access.PUBLIC, access: boardFunc.e_access });

  // routed to get reply form displayed
  if (req.query.soft == "reply_display") // check if two users are known
  {
    let id = req.query.postid
    let sockid = req.query.sockid
    req.app.locals.wwwConn.sockio.sockets.connected[sockid].emit('chat update', id);
  }

});

router.post('/', async function (req, res, next) {
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

  // post user's comments into db and front-end
  if (req.body.soft == "reply_post")
  {
    console.log(req.body)
    comment = await postFunc.createComment(req);
    let id = req.body.postid;
    await postFunc.addCommentToPost(id, comment)
    req.app.locals.wwwConn.sockio.emit('chat update', null)
  }
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
