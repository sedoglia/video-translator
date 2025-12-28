const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const mainConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/main.ts',
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@backend': path.resolve(__dirname, 'src/backend')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  node: {
    __dirname: false,
    __filename: false
  }
};

const preloadConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/preload.ts',
  target: 'electron-preload',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'preload.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  node: {
    __dirname: false,
    __filename: false
  }
};

const backendConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/backend/server.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist/backend'),
    filename: 'server.js'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@backend': path.resolve(__dirname, 'src/backend')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  externals: {
    // Don't bundle node_modules for backend
    'express': 'commonjs express',
    'socket.io': 'commonjs socket.io',
    'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
    'youtube-dl-exec': 'commonjs youtube-dl-exec',
    'axios': 'commonjs axios',
    'cors': 'commonjs cors',
    'dotenv': 'commonjs dotenv',
    'uuid': 'commonjs uuid',
    'winston': 'commonjs winston',
    'say': 'commonjs say',
    '@vitalets/google-translate-api': 'commonjs @vitalets/google-translate-api'
  },
  node: {
    __dirname: false,
    __filename: false
  }
};

const rendererConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer')
    }
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
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ]
};

module.exports = [mainConfig, preloadConfig, backendConfig, rendererConfig];
