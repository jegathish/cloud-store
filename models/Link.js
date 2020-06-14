var mongoose = require('mongoose')
var Schema = mongoose.Schema

var linkSchema= new Schema({
    id: String,
    key: String
})

module.exports = mongoose.model('Link', linkSchema);