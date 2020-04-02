var async = require('async')
var Board = require('../models/board')
var Mongoose = require('mongoose');

function findBoardByUser(u1, cb, popu=false) {
    async.parallel([
        function (callback) {
            var boardQuery = Board.findOne({pal:u1})
            if (popu == false)
            {
                boardQuery.exec(function (err, found) {
                    if (err) {
                        var err = new Error('Board Not Found');
                        err.status = 404;
                        return callback(err);
                    }
                    if (found != null)
                        return callback(null, found)
                    else
                        return callback(null, null)
                }); 
            }
            else {
                boardQuery.populate('pendingPals').exec(function (err, found) {
                    if (err) {
                        var err = new Error('Board Not Found');
                        err.status = 404;
                        return callback(err);
                    }
                    if (found != null)
                        return callback(null, found)
                    else
                        return callback(null, null)
                }); 
            }
        },
    ], function foundBoard (err, board) {
        if (err)
            return cb(err, null)
        if (board)
            return cb(err, board[0])
    });
}

// create a board with a owner/pal
function createBoard(u1) {
    let boardDetail = {pal: u1, postList: []}

    boardDetail.created = new Date()
    let board = new Board(boardDetail)

    board.save(err => {
    if (err) return next(err);
    });

    return board
}

// Create a board *if such a board doesn't exist* and *stores post ids in post list*
function p_storePostInBoard(post, board, reqUser, cb=null) {
    return new Promise((resolve, reject) => {
        if (board == null)
        {
            board = createBoard(reqUser)

            if (post != null)
            {
                board.postList.push(post.id)

                board.save(err => {
                if (err) return next(err);
                resolve()
                })
            }
        }
        else {
            if (post != null)
                board.postList.push(post.id)

            board.save(err => {
                if (err) return next(err);
                resolve()
            })
        }

        if (cb == null)
            return null
        return cb(board) // if cb is not provided, return null else return board
    });
}

// *removes* a post ref from a board and *returns* post by callback
function removePostInBoard(postid, board, cb=null) {
    if (board != null)
    {
        if (postid != null)
        {
            for (let i = 0; i < board.postList.length; ++i) {
                if (board.postList[i] == postid)
                {
                    board.postList.splice(i, 1)
                    break
                }
            }
        }

        board.save(err => {
            if (err) {
                return next(err);
            }
        })
    }

    if (cb == null)
        return null
    return cb(postid)
}

function p_removePosts(postid, board){
    return new Promise(async (resolve, reject) => { 
        if (board != null)
        {
            if (postid != null)
            {
                for (let i = 0; i < board.postList.length; ++i) {
                    if (board.postList[i] == postid)
                    {
                        board.postList.splice(i, 1)
                        break
                    }
                }
            }
    
            board.save(err => {
                if (err) {
                    return next(err);
                }
            })
            resolve()
        }
    });
}

function findUserInPals(user_id, board) {
    let access_lvl = e_access.FAIL
    for (let i = 0; i < board.pals.length; ++i) {
        if (board.pals[i] == user_id)
        {
            access_lvl = e_access.PRIVATE
            break
        }
    }
    if (access_lvl == e_access.FAIL)
        access_lvl = e_access.PUBLIC
    return access_lvl
}

function findUserInPending(user_id, board) {
    let access_lvl = e_access.FAIL
    for (let i = 0; i < board.pendingPals.length; ++i) {
        if (board.pendingPals[i] == user_id)
        {
            access_lvl = e_access.PRIVATE
            break
        }
    }
    if (access_lvl == e_access.FAIL)
        access_lvl = e_access.PUBLIC
    return access_lvl
}

function removeUserInPending(user_id, board) {
    for (let i = 0; i < board.pendingPals.length; ++i) {
        if (board.pendingPals[i] == user_id)
        {
            board.pendingPals.splice(i, 1)
            access_lvl = e_access.PRIVATE
            return
        }
    }
}

const e_access = {
    PUBLIC: 2,
    PRIVATE: 1,
    ADMIN: 0,
    FAIL: -1,
}

// Delete board, warning, does not delete posts or references to user automatically!
function p_deleteBoardById(boardId) {
    return new Promise(async (resolve, reject) => {
        await Board.deleteOne({ "_id": Mongoose.Types.ObjectId( boardId ) }, err => {
            if (err) return next(err);
        });
        resolve();
    });
}

module.exports.findBoardByUser = findBoardByUser;
module.exports.createBoard = createBoard;
module.exports.storePostInBoard = p_storePostInBoard;
module.exports.findUserInPals = findUserInPals
module.exports.findUserInPending = findUserInPending
module.exports.removeUserInPending = removeUserInPending
module.exports.removePostInBoard = removePostInBoard
module.exports.e_access = e_access
module.exports.removeAllPosts = p_removePosts
module.exports.deleteBoardById = p_deleteBoardById
