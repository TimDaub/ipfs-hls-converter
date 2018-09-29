// @format
const path = require('path');

var HtmlWebpackPlugin = require('html-webpack-plugin');
var HTMLWebpackPluginConfig = new HtmlWebpackPlugin({
  template: __dirname + '/client/index.html',
  filename: 'index.html',
  inject: 'body',
});
module.exports = {
  mode: 'development',
  watch: true,
  watchOptions: {ignored: /node_modules/, aggregateTimeout: 300, poll: 500},
  entry: {
    javascript: './client/index.js',
  },
  devtool: 'eval-source-map',
  module: {
    rules: [
      {
        exclude: /(node_modules|bower_components)/,
        test: /\.(js|jsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/,
        use: [ 'style-loader', 'css-loader' ]
      }
    ],
  },
  plugins: [HTMLWebpackPluginConfig],
  output: {
    path: path.resolve(__dirname, './public'),
    filename: 'index.js',
  },
};
