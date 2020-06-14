if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const app = express()
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const mongoose = require('mongoose')
var bcrypt = require('bcrypt')
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const User = require('./models/User.js')
const Link = require('./models/Link.js')

const initializePassport = require('./passport-config')
const { link } = require('fs')
initializePassport(passport)

const mongoURI = 'mongodb://localhost:27017/newApp';
var db
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true },  function (err, dbs) {
  db=dbs
})
  
mongoose.set("useCreateIndex", true);


app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(express.static('public'))


const conn = mongoose.createConnection(mongoURI);
let gfs;

conn.once('open', () => {

  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
  
    return new Promise(async (resolve, reject) => {
      const filename = file.originalname;
      const fileInfo = {
        filename: filename,
        metadata: req._passport.session.user,
        bucketName: 'uploads'
      };
      resolve(fileInfo);
    });
  }
});
const upload = multer({ storage });

app.get('/', checkAuthenticated, (req, res) => {
  gfs.files.find({metadata: req._passport.session.user}).toArray( async (err, files) => {
    const user = await getUser(req._passport.session.user)
    // Check if files
    if (!files || files.length === 0) {
      res.render('home.ejs', { name:user.name, files: false });
    } else {
      files.map(file => {
        if (
          file.contentType === 'image/jpeg' ||
          file.contentType === 'image/png'
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.render('home.ejs', { name: user.name,files: files });
    }
  });
});
app.post('/login', checkNotAuthenticated,
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  })
)

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs');
})
app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    const user = new User({
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      mobile: req.body.mobile
    })
    await user.save();
    res.redirect('/login')
  } catch (e) {
    console.log(e)
    res.redirect('/register')
  }
})


app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs');
})



app.get('/logout', checkAuthenticated, (req, res) => {
  req.logout();
  res.redirect('/login');
})

app.post('/upload', checkAuthenticated, upload.single('file'), (req, res) => {
  res.redirect('/');
});

app.get('/files/:filename', checkAuthenticated, (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    // File exists
    const readstream = gfs.createReadStream(file.filename);
    return readstream.pipe(res);
  });
});



app.get('/image/:filename', checkAuthenticated, (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    // Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

app.delete('/files/:id', checkAuthenticated, (req, res) => {
  
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }
    res.redirect('/');
  });
});

app.post('/download/:id', checkAuthenticated, (req, res) => {
  const id = req.params.id
  var contentType
  var filename
  gfs.exist({_id: id, root: 'uploads'}, (err, file) => {
    if(err || !file) {
      res.status(404).send('File Not Found');
      return
    }
    else{
      gfs.files.find({}).toArray((err, files) => {
        for (var i in files) {
          if(files[i]._id == id) {
            contentType = files[i].contentType
            filename = files[i].filename
            res.set('Content-Type', contentType);
            res.set('Content-Disposition', 'attachment; filename="' + filename + '"');
          }
        }
      })
      var readstream = gfs.createReadStream({_id: req.params.id})
      readstream.pipe(res)
    }
  })
    
 
})

app.get('/generatelink/:id', async (req, res) => {
const id = req.params.id
const key = id + Date.now().toString()
try {
  const link = new Link({
    id: id,
    key: key
  })
  await link.save()
  const sharelink = "http://192.168.43.244:3000" + "/sharelink/" + key
  res.send(sharelink)
} catch (error) {
  res.redirect("/")
}
})

app.get('/sharelink/:key', (req,res) => {
  const key = req.params.key
  console.log(key)
  Link.findOne({key:key}, (err, data) => {
    if(!data || err){
      res.send("invalid link")
    } else {
      const id = data.id
      
      gfs.exist({_id: id, root:'uploads'}, (err, file) => {
        if(err || !file) {
          res.status(404).send('File Not Found');
          return
        }
        else{
          gfs.files.find({}).toArray((err, files) => {
            for (var i in files) {
              if(files[i]._id == id) {
                contentType = files[i].contentType
                filename = files[i].filename
                res.set('Content-Type', contentType);
                res.set('Content-Disposition', 'attachment; filename="' + filename + '"');
              }
            }
          })
          var readstream = gfs.createReadStream({_id: id})
          readstream.pipe(res)
        }
      })
      Link.deleteOne({key: key}, (err) => {
        if(err)
        console.log(err)
      })
    }
  })
})



const getUser = async (id) => {
  return User.find({id:id})
  .exec()
  .then(user => {
    if(user!=null)
      return user[0]
    return user })
  .catch(err => {return err.message})
}


//authenticatication for route
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}
app.listen(3000, (err) => {
  console.log("server listening at port 3000:")
})


