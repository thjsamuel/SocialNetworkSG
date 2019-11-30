var mongoose = require('mongoose');
//var moment = require('moment'); // For date handling.

var Schema = mongoose.Schema;

var UserSchema = new Schema(
    {
    email: { type: String, unique: true},
    first_name: {type: String, max: 100},
    family_name: {type: String, max: 100},
    username: {type: String, max: 100, required: true},
    password: {type: String, required: true},
    date_of_birth: { type: Date },
    date_of_death: { type: Date },
    posts: [{ type: Schema.ObjectId, ref: 'Post' }],
    created: { type: Date },
    pendingConn: [{ type:  mongoose.Schema.Types.ObjectId, ref: 'Post' }]
    }
  );

// Virtual for User "full" name.
UserSchema
.virtual('name')
.get(function () {
  if (this.family_name === '')
    return ''
  return this.family_name +', '+this.first_name;
});

// Virtual for this User instance URL.
UserSchema
.virtual('url')
.get(function () {
  return '/pages/user/'+this._id
});

// Virtual for user's lifespan
UserSchema
.virtual('lifespan')
.get(function () {
  if (this.date_of_death === undefined && this.date_of_birth === undefined)
    return "please update your particulars"
  else if (this.date_of_death === undefined)
    return this.date_of_birth.getYear().toString();
  return (this.date_of_death.getYear() - this.date_of_birth.getYear()).toString();
});

UserSchema
.virtual('bday_format')
.get(function () {
  if (this.date_of_birth != null && typeof this.date_of_birth !== 'undefined')
  {
    return this.date_of_birth.toISOString().slice(0,10).replace(/-/g," ");
  }
  else
    return 'unknown';
});

UserSchema
.virtual('dday_format')
.get(function () {
  if (this.date_of_death != null && typeof this.date_of_death !== 'undefined')
  {
    return this.date_of_death.toISOString().slice(0,10).replace(/-/g," ");
  }
  else if (typeof this.date_of_death !== 'undefined')
    return 'present';
  else
    return 'unknown';
});

UserSchema
.virtual('recentPosts')
.get(function () {
  let recent = [];
  if (this.posts!= null && typeof this.posts !== 'undefined')
  {
  	for(let post of this.posts)
  	{
  		if (post.sameMonthYear(new Date()))
  		{
  			// if post is from this year and month
  			recent.push(post);
  		}
  	}
    //return this.date_of_death.toISOString().slice(0,10).replace(/-/g," ");
      return recent;
  }
  return recent;
});

// Export model.
module.exports = mongoose.model('User', UserSchema);
