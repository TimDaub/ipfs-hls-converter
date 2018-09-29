// @format
require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());

const isDeveloping = process.env.NODE_ENV !== 'production';

if (isDeveloping) {
  let webpack = require('webpack');
  let webpackMiddleware = require('webpack-dev-middleware');
  let config = require('./webpack.config.js');
  let compiler = webpack(config);
  // serve the content using webpack
  app.use(webpackMiddleware(compiler, {
    publicPath: '/', 
  }));
} else {
  // serve the content using static directory
  app.use(express.static(staticPath));
}

app.get('/', (req, res) => {
  res.send('Hello world\n');
});
app.use('/hashes/:ipfsHash', indexRouter.ipfsHashes);
module.exports = app;
