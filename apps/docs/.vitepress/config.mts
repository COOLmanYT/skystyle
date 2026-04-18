import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Sky Style Docs",
  description: "Official docs for Sky Style weather-based outfit intelligence",
  themeConfig: {
    logo: '/images/settings.png',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Platform Guide', link: '/markdown-examples' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Quickstart', link: '/api/quickstart' },
    ],

    sidebar: [
      {
        text: 'Sky Style Docs',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Platform Guide', link: '/markdown-examples' },
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api/' },
          { text: 'Quickstart', link: '/api/quickstart' },
          { text: 'Authentication', link: '/api/authentication' },
          {
            text: 'Endpoints',
            items: [
              { text: 'POST /recommend', link: '/api/recommend' },
              { text: 'POST /recweather', link: '/api/recweather' },
              { text: 'GET /weather', link: '/api/weather' },
              { text: 'GET /closet', link: '/api/closet' },
            ]
          },
          { text: 'Errors & Credits', link: '/api/errors' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/COOLmanYT/what2wear' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Sky Style API docs — always in sync with skystyle.app/api/v1',
      copyright: 'Copyright 2026 Sky Style'
    }
  }
})

