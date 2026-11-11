// Config dinámica: agrega google-services.json (necesario para push en Android)
// sólo si existe el archivo o la variable de entorno de EAS "GOOGLE_SERVICES_JSON".
const fs = require('fs');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
