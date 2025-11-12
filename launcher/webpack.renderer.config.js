const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = [
  // Renderer process
  {
    target: 'electron-renderer',
    entry: './src/renderer/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist/renderer'),
      filename: 'bundle.js'
    },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "buffer": false,
      "crypto": false,
      "stream": false,
      "util": false,
      "process": false
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html'
    }),
    new webpack.DefinePlugin({
      'global': 'window'
    })
  ],
    devServer: {
      port: 9000,
      hot: true
    }
  },
  // Preload script
  {
    target: 'electron-preload',
    entry: './src/main/preload.ts',
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'preload.js'
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    }
  }
];

