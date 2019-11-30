var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var CommentSchema = new Schema({
    owner: { type: Schema.ObjectId, ref: 'User', required: true },
    txt_cont: {type: String, max: 50},
    comment_list: [{ type: Schema.ObjectId, ref: 'Comment' }],
    liked_list: [{type: String, max: 25}], // max url length
    created: {type: Date, required: true},
});


CommentSchema
.virtual('createdStr')
.get(function () {
  if (this.created != null && typeof this.created !== 'undefined')
  {
    return this.created.toISOString().slice(0,10).replace(/-/g," ");
  }
  else
    return 'unknown';
});

// Export model.
module.exports = mongoose.model('Comment', CommentSchema);