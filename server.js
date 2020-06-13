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

const initializePassport = require('./passport-config')
initializePassport(passport)

const mongoURI = 'mongodb://localhost:27017/newApp';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('db connection succesful'))
  .catch((err) => console.error(err));
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
    console.log(req)
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
  gfs.files.find({metadata: req._passport.session.user}).toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      res.render('home.ejs', { files: false });
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
      res.render('home.ejs', { files: files });
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

app.get('/register', (req, res) => {
  res.render('register.ejs');
})
app.post('/register', async (req, res) => {
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


app.get('/login', (req, res) => {
  res.render('login.ejs');
})



app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
})

app.post('/upload', upload.single('file'), (req, res) => {
  res.redirect('/');
});

app.get('/files/:filename', (req, res) => {
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



app.get('/image/:filename', (req, res) => {
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

app.delete('/files/:id', (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }
    res.redirect('/');
  });
});

app.post('/download/:id', (req, res) => {
  gfs.findOne({ _id: req.params.id, root: 'uploads' }, (err, file) => {
    if(err) {
      return res.status(404).json({
        err: 'issue in downloading'
      })
    } else if (!file) {
      return res.status(404).send('Error on the database looking for the file.');
  }

  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

  var readstream = gfs.createReadStream({
    _id: req.params.id,
    root: 'resume'
  });

  readstream.on("error", function(err) { 
      res.end();
  });
  readstream.pipe(res);
});
})



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


