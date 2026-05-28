module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['@opendocsg/pdf2md', 'pdfjs-dist', '@hyzyla/pdfium', 'archiver', 'fs-extra'],
    esmExternals: 'loose'
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals.push({
        unpdf: 'window.unpdf',
        'pdfjs-dist': 'window.pdfjsLib'
      });
    } else {
      config.externals.push('pdfjs-dist');
      config.externals.push('@hyzyla/pdfium');
      config.externals.push('archiver');
      config.externals.push('fs-extra');
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ];
  }
};
