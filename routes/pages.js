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

/**
 * Recieves form and saves images from posts. 
 * @route
 * @property {formidable.IncomingForm} form - auto detect form routed from view and contain in "form"
 * @property {variable} form.multiples - allows multiple form upload in single request
 * @property {variable} form.uploadDir - connects __dirname with ../public/images to get path to store images
 * @event form.on#error
 * @event form.on#end - if successful, respond with success to client
 * @property {function} form.parse
 * @param {req} - get req obj
 * @param {callback} 
 * @param {object} fields - contains data sent by user such as post file is posted on
 * @param {object} files - contains actual image data such as path, type and name
 * @summary validates image data such as size, sends emit to user if does not meet criteria (e.g. < 300kb binary)
 * @summary creates folder recursively based on sha1 hash of image name and extension, using sha1 npm module
 * @summary creates filedetail object and stored in mongodb
 * @param {string} fileid
 * @param {string} file_name
 * @param {Date} date - date created
 * @param {string} extension
 * @param {Int} size - filesize not in binary
 * @param {string} hash - sha1 str hash of image name and extension
 * @property {postfunc} p_addImgToPost
 * @property {string} relativepath - path of image in public folder, passed to view to render image
 * @property {Int} fields.ind - index of posts position in view, passed to view to render image
*/
router.post('/install_img', function (req, res) {
  // create an incoming form object
  var form = new formidable.IncomingForm();
  //res.sendFile(path.join(__dirname, '..', '/views/postload.js'));

  // specify whether allow user to upload multiple files in a single request
  form.multiples = false;

  // store all uploads in the /uploads directory
  form.uploadDir = path.join(__dirname, '..', '/public/images/useruploads');

  // every time a file has been uploaded successfully,
  // rename it to it's orignal name
  /*form.on('file', function(field, file) {
    fs.rename(file.path, path.join(form.uploadDir, file.name));
  });*/

  // log any errors that occur
  form.on('error', function(err) {
    //debug('An error has occured: \n' + err);
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
    console.log(form.uploadDir)
    let hashpath = `${form.uploadDir}\\${shaStr.substring(0, 2)}\\${shaStr.substring(2, 4)}`
    console.log(hashpath)
    let relativepath = `images/useruploads/${shaStr.substring(0, 2)}/${shaStr.substring(2, 4)}/${shaStr}.${type}`
    let binarySize = files.uploads.size / 1024 // size in kb binary of file
    if (binarySize > 300 && binarySize < 600)
    {
      req.app.locals.wwwConn.sockio.emit('page refresh', {msg: 'Image file is bigger than expected (300 < kb), try reducing it, current size: ' + parseInt(binarySize), id: fields.ind})
      fs.unlink(files.uploads.path, function(err) {
      });
    }
    else if (binarySize >= 600) {
      req.app.locals.wwwConn.sockio.emit('page refresh', {msg: 'Image file is too large, try reducing it < 300kb, current size: ' + parseInt(binarySize), id: fields.ind})
      fs.unlink(files.uploads.path, function(err) {
      });
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
        else { return err }; // something else went wrong
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

/**
 * Retrieves images from post and tells view which to render on which posts, called everytime page is loaded with imgs
 * @route
 * @summary same events and variables as above
 * @property {form} form.parse
 * @property {postFunc} listImgsFrPosts - gets file list of a post using postid
 * @property {postFunc} findFileById - get specific file from static_file model using img id
 * @summary passes to view the path and respective post position of image to render
*/

router.post('/request_img', function (req, res) {
  var form = new formidable.IncomingForm();
  form.on('error', function(err) {
    //console.log('An error has occured: \n' + err);
  });

  // once all the files have been uploaded, send a response to the client
  form.on('end', function() {
    res.end('success');
  });
  form.parse(req, async function (err, fields, files) {
    let image_list = await postFunc.listImgsFrPosts(fields.data)
    image_list.forEach(async function(images) {
      let img = await postFunc.findFileById(images.id)
      let relativepath = `images/useruploads/${img.hash.substring(0, 2)}/${img.hash.substring(2, 4)}/${img.hash}.${img.extension}`
      //debug(relativepath + ' ' + fields.ind)
      req.app.locals.wwwConn.sockio.sockets.connected[fields.sockid].emit('img fill', { path: relativepath, ind: fields.ind })
    });
  });
});

/**
 * Refer to user controller.get_postsList for more info
 * @route
*/
router.post('/list_posts', user_controller.get_postsList)

/**
 * Handles GET requests to /, render's homepage with logic for various UI components such as connect requests
 * @route
 * @property {boardFunc} findBoardByUser - find board of current user
 * @property {array} getPending - array of users pending permission to edit board
 * @summary Both user and board models contain references to "connections", board has reference so that it know who to show which template to 
*/ 

// GET home page.
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
    res.render('index', { title: '<ONE SG>', user: req.user, metho: temp == 'POST' ? true : false, pending: pending, waiting: waiting, moderatorId: req.app.locals.modID, relation: access_lvl, access: boardFunc.e_access });
  }
  else
    res.render('index', { title: '<ONE SG>', user: req.user, metho: temp == 'POST' ? true : false, pending: [], moderatorId: req.app.locals.modID, relation: boardFunc.e_access.PUBLIC, access: boardFunc.e_access });

  // routed to get reply form displayed
  if (req.query.soft == "reply_display") // check if two users are known
  {
    let id = req.query.postid
    let sockid = req.query.sockid
    req.app.locals.wwwConn.sockio.sockets.connected[sockid].emit('chat update', id);
  }

});

/**
 * Handler for POST request to / route, allows user to accept/refuse connection request
 * @route
 * @property {boardFunc} findUserInPals - find out if user submitted request is already in pg owner's pal list
 * @property {boardFunc} removeUserInPending - update board of pending users that user is removed
 * @summary Removes user connection requests from pending list in board and user models once accepted/rejected connection request
*/ 

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
    comment = await postFunc.createComment(req);
    let id = req.body.postid;
    await postFunc.addCommentToPost(id, comment)
    req.app.locals.wwwConn.sockio.emit('chat update', null)
  }
  return res.redirect('/pages')
});

/**
 * Sign up GET & POST requests handlers
 * @route
 * @property {res} render - render sign up page
 * @property {user_controller} sign_up - refer to user_controller sign_up function for more details
*/ 

/// SIGN UP ///
router.get("/sign-up", (req, res) => res.render("signup", { title: 'SIGN UP' }))

router.post("/sign-up", user_controller.sign_up);

router.get('/log-in', function (req, res, next) {
  res.redirect('/pages')
});

/**
 * Log in GET & POST requests handlers, POST handles logging user in using *Passport* module
 * @route
 * @classdesc Passport - handles log in requests, initialized and logic in app.js
 * @property {res} redirect - direct user to main page after sign in authenticates
 * @property {user_controller} sign_up - refer to user_controller sign_up function for more details
*/ 

router.post("/log-in", function(req, res, next) {
  req.session.method = req.method
  next()
});

router.post("/log-in",passport.authenticate('local', {
  //successRedirect: "/",
  failureRedirect: "/pages",
  failureFlash: true
}), function (req, res){
  req.flash('wrong', 'Failed to log in!')
  //req.app.locals.msg = req.flash()
  res.redirect('/pages')
  //res.render('index', { title: 'SG SOCIAL', user: req.user/*, error: req.flash('wrong')*/ });
});

/**
 * Log out GET requests handlers
 * @route
 * @property {res} logout
 * @property {res} redirect - direct user to public main page after signed out of account
*/ 

router.get("/log-out", (req, res) => {
  req.logout();
  res.redirect("/");
});

/// USER ROUTES ///

// GET request for one User.
router.get('/user/:id', user_controller.user_detail);

// POST request for create post.
router.post('/user/:id', user_controller.user_detail); //?soft=compose_new

module.exports = router;
