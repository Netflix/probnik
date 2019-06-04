const path = require('path');

module.exports = [{
    entry: './probnik/probnik.ts',
    output: { filename: './probnik.js' },
    resolve: {
      extensions: [".ts", ".js"]
    },
    module: {
      rules: [
        { test: /\.tsx?$/, loader: "ts-loader" }
      ]
    },
    devtool: 'source-map',
    mode: 'development'
  },
  {
    entry: './demo/main.js',
    output: { 
        filename: 'main.js',
        path: path.resolve(__dirname, 'demo/dist')
    },
    resolve: {
      extensions: [".ts", ".js"]
    },
    module: {
      rules: [
        { test: /\.tsx?$/, loader: "ts-loader" }
      ]
    },
    devtool: 'source-map',
    mode: 'development'
  }]