module.exports = {
  globDirectory: 'build/',
  globPatterns: [
    '**/*.{html,js,css,png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,ico,webp,json}'
  ],
  swDest: 'build/service-worker.js',
  swSrc: 'public/service-worker.js',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
  
  // Runtime caching
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/rpc-amoy\.polygon\.technology\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'polygon-rpc',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 300 // 5 minutos
        }
      }
    },
    {
      urlPattern: /^https:\/\/api\.blocktrust\.com\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 3600 // 1 hora
        }
      }
    },
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 dias
        }
      }
    },
    {
      urlPattern: /\.(woff|woff2|ttf|eot)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 ano
        }
      }
    },
    {
      urlPattern: /^https:\/\/gasstation\.polygon\.technology\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'gas-prices',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 120 // 2 minutos
        }
      }
    }
  ]
};
