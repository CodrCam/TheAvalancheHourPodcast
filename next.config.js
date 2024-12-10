module.exports = {
  webpack: (config) => {
    config.externals = {
      ...config.externals,
      nodemailer: 'commonjs nodemailer',
    };
    return config;
  },
};