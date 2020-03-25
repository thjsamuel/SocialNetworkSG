var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var PostSchema = new Schema({
    owner: { type: Schema.ObjectId, ref: 'User', required: true },
    ref_user: { type: Schema.ObjectId, ref: 'User' },
    title: {type: String, max: 70},
    txt_cont: {type: String, max: 100},
    file_list: [{ type: Schema.ObjectId, ref: 'StaticFile', max: 3 }],
    comment_list: [{ type: Schema.ObjectId, ref: 'Comment', max: 10 }],
    liked_list: [{type: String, max: 25}], // max url length
    is_public: {type: Boolean, default: true},
    created: {type: Date, required: true},
}, {
  toJSON: { virtuals: true }
});

PostSchema
.virtual('sameMonthYear')
.get(function () {
  let today = new Date()
  return ((this.created.getFullYear() === today.getFullYear()) && (today.getMonth() - this.created.getMonth() === 0));
});

PostSchema
.virtual('createdStr')
.get(function () {
  if (this.created != null && typeof this.created !== 'undefined')
  {
    let dateStr = this.created.toUTCString()
    let dayStr = dateStr.split(' ')[1]
    let monthStr = dateStr.split(' ')[2]
    let yearStr = dateStr.split(' ')[3]
    //return this.created.toISOString().slice(0,10).replace(/-/g," ");
    //console.log(year + ' ' + month + ' ' + day)
    return dayStr + ' ' + monthStr + ' ' + yearStr
  }
  else
    return 'unknown';
});

// Export model.
module.exports = mongoose.model('Post', PostSchema);