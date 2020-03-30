var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var StaticFileSchema = new Schema({
    fileId: { type: String, max: 50 },
    fileName: { type: String, max: 20 },
    extension: { type: String, min: 2, max: 6},
    fileSize: { type: Number },
    hash: { type: String, default: '0000' },
    created: { type: Date, required: true },
});

// Export model.
mongoose.set('useCreateIndex', true);
module.exports = mongoose.model('StaticFile', StaticFileSchema);