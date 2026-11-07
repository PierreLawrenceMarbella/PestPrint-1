const { withAndroidManifest } = require('expo/config-plugins');

/** Local preview builds can use the team's LAN API. Other builds require HTTPS. */
module.exports = function withPreviewNetwork(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = process.env.PESTPRINT_ALLOW_HTTP_API === '1' ? 'true' : 'false';
    }
    return mod;
  });
};
