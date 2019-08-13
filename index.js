const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const app = express();
const PORT = 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err) {
    return next({ message: 'Bad request', status: 400 });
  }
  next();
});

app.use('/', routes);

app.use((req, res, next) => {
  return next({ message: 'Not found', status: 404 });
});

app.use((err, req, res, next) => {
  if (err) {
    let status = 400;
    if (err.status) {
      status = err.status;
    }
    return res.status(status).json({ message: err.message });
  }
  res.status(500).json({ message: 'Internal error' });
});

app.listen(PORT, () => console.log('Listening on port ' + PORT));