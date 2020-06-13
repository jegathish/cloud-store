var mongoose = require('mongoose')
var Schema = mongoose.Schema

var UserSchema = new Schema({
    id: String,
    name: String,
    email: String,
    password: String,
    mobile: String,
    date: {
        date: String,
        month: String,
        year: String,
        day: String,
        time: {
          hour : String,
          minute: String,
          second: String
        }
      }
})

module.exports = mongoose.model('User', UserSchema);