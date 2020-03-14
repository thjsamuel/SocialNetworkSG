var Post = require('../models/post')
var Comment = require('../models/comment')
var StaticFile = require('../models/staticfile')
var Mongoose = require('mongoose');

// Create a post and waits for it to save before giving resolved status
function p_createPost(req, pgUser, same) {
    let post = null
    let postDetail
    /// not profile pg user
    if (same)
    {
        postDetail = {owner: req.user, txt_cont:req.body.posttxt, comment_list:[], liked_list:[], is_public:true, created: new Date()}
    }
    else
    {
        postDetail = {owner: req.user, ref_user: pgUser, txt_cont:req.body.posttxt, comment_list:[], liked_list:[], is_public:true, created: new Date()}
    }

    post = new Post(postDetail)
    return new Promise((resolve, reject) => { 
        post.save(err => {
            if (err) return next(err);
            resolve(post)
        });
    });
}

// Create a post and waits for it to save before giving resolved status
function p_createComment(req) {
    let comment = null
    let commentDetail = null
    commentDetail = { owner: req.user, txt_cont:req.body.commentTxt, comment_list:[], liked_list:[], created: new Date()}

    comment = new Comment(commentDetail)
    return new Promise((resolve, reject) => { 
        console.log(comment)
        comment.save(err => {
            if (err) return next(err);
            resolve(comment)
        });
    });
}

// returns promise after finding post based on an ID
function p_findPostByID(postId)
{
    return new Promise((resolve, reject) => {
        let post = Post.findById(postId).populate('owner').populate('comment_list') // find post based on its ID and give the doc obj its owner
        post.populate({
            path: 'comment_list', populate: { path: 'owner' }
        });
        post.exec(function (err, foundPost) { // same as .then on the above statement
            if (err && err == null)
                reject(err)
            if (foundPost != null) // check if returned obj is null
            {
                resolve(foundPost) // return the object
            }
        });
    });
}

function p_findStaticByID(fileId)
{
    return new Promise((resolve, reject) => {
        let file = StaticFile.findById(fileId.toString())
        file.exec(function (err, foundFile) {
            if (err && err == null)
            {
                reject(err)
            }
            if (foundFile != null) // check if returned obj is null
            {
                resolve(foundFile) // return the object
            }
        });
    });
}

// returns promise after finding post based on an ID
function p_findCommentByID(commentId)
{
    return new Promise((resolve, reject) => {
        let comment = Comment.findById(commentId).populate('owner').populate('comment_list') // find comment based on its ID and give the doc obj its owner
        comment.exec(function (err, foundComment) { // same as .then on the above statement
            if (err && err == null)
                reject(err)
            if (foundComment != null) // check if returned obj is null
            {
                resolve(foundComment) // return the object
            }
        });
    });
}

async function getPostsInBoard(board) {
    let box = []
    let n = board.postList.length - 1;
    for (n; n > -1;)
    {
        let post = await p_findPostByID(board.postList[n]) // delay execution until post is found
        box.push(post) // push post into box
        --n // move on to next post id
    }

    return box
}

// this function is a promise as we are giving the controller the option to await the save
async function p_addCommentToPost(postid, comment) {
    let post = await p_findPostByID(postid)
    return new Promise((resolve, reject) => { 
        post.comment_list.unshift(comment)
        post.save(err => {
            if (err) return next(err);
            resolve()
        });
    });
}

// Delete a post by id and wait for model before giving resolved status
function p_deletePostById(postId) {
    return new Promise((resolve, reject) => { 
        deleteCommentsById(postId)
        deleteFilesById(postId)
        Post.deleteOne({ "_id": Mongoose.Types.ObjectId(postId) }, err => {
            if (err) return next(err);
        });
        resolve()
    });
}

// Delete comments in post, giving resolved status
async function deleteCommentsById(postId) {
    let post = await p_findPostByID(postId)
    for (let i = 0; i < post.comment_list.length; ++i)
    {
        // await delete will make sure each comment does not get left out if post deleted, by making event loopm return to it
        await Comment.deleteOne({ "_id": Mongoose.Types.ObjectId( post.comment_list[i].id ) }, err => {
            if (err) return next(err);
        });
    }
}

// Delete image in post, giving resolved status
async function deleteFilesById(postId) {
    let post = await p_findPostByID(postId)
    for (let i = 0; i < post.file_list.length; ++i)
    {
        // await delete will make sure each image does not get left out if post deleted, by making event loop return to it
        await StaticFile.deleteOne({ "_id": Mongoose.Types.ObjectId( post.file_list[i].id ) }, err => {
            if (err) return next(err);
        });
    }
}

// this function is a promise as we are giving the controller the option to await the saving of image to db
async function p_addImgToPost(postid, file) {
    let post = await p_findPostByID(postid)
    return new Promise((resolve, reject) => { 
        let statFile = new StaticFile(file)
        console.log(statFile)
        statFile.save(err => {
            if (err) return next(err);
            post.file_list.unshift(statFile)
            //console.log(post)
            post.save(err => {
                if (err) return next(err);
                resolve()
            });
        });
    });
}

// this function is a promise as we are giving the controller the option to await the saving of image to db
async function p_getImgFromPost(postid) {
    let post = await p_findPostByID(postid)
    //await post.populate('file_list')
    //await post.populate({
        //path: 'file_list', populate: { path: '' }
    //});
    return post.file_list
}

module.exports.createPost = p_createPost;
module.exports.getPostsInBoard = getPostsInBoard;
module.exports.deletePostById = p_deletePostById;
module.exports.createComment = p_createComment;
module.exports.addCommentToPost = p_addCommentToPost;
module.exports.deleteCommentsById = deleteCommentsById;
module.exports.p_addImgToPost = p_addImgToPost;
module.exports.listImgsFrPosts = p_getImgFromPost;
module.exports.findFileById = p_findStaticByID