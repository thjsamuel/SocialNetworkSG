var mongoose = require('mongoose');
var async = require('async')
var Post = require('./post')

var Schema = mongoose.Schema;

var BoardSchema = new Schema({
    pal: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    pals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pendingPals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    created: {type: Date, required: true},
});

// Virtual for this page instance URL.
BoardSchema
.virtual('url')
.get(function () {
  return '/pages/board/' + this._id;
});

BoardSchema
.virtual('recentPosts')
.get(function () {
  let recent = [];
  if (this.shared != null && typeof this.shared !== 'undefined')
  {
    async.parallel([
      function (callback) {

        let f_id = Post.findById(this.shared[0])
        f_id.exec(function (err, post) {
          if (err) return handleError(err);
          //if (post.sameMonthYear)
          //{
              // if post is from this year and month
            recent.push(post);
            return callback(null, recent)
          //}
        });
      },
    ]), function (err, data) {
        console.log(data)
    }
  
    //return this.date_of_death.toISOString().slice(0,10).replace(/-/g," ");
    console.log(recent)
    return recent;
  }
  return recent;
});

// Export model.
module.exports = mongoose.model('Board', BoardSchema);
