const MomentLocalesPlugin = require('moment-locales-webpack-plugin');

module.exports = {
  plugins: [
    new MomentLocalesPlugin({
      localesToKeep: ['en-gb']
    })
  ],
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]',
            },
          },
        ],
      },
    ],
  },
};
