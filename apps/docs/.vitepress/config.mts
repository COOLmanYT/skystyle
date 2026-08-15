import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Sky Style Docs",
  description: "Official docs for Sky Style weather-based outfit intelligence",
  sitemap: { hostname: process.env.DOCS_SITE_URL ?? "https://docs.skystyle.app" },
  ignoreDeadLinks: true,
  themeConfig: {
    logo: '/images/settings.png',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Web App Guide', link: '/web-app' },
      { text: 'Platform Guide', link: '/markdown-examples' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Quickstart', link: '/api/quickstart' },
      { text: 'Development', link: '/development' },
      { text: 'Sky Style ↗', link: 'https://skystyle.app' },
    ],

    sidebar: [
      {
        text: 'Sky Style Docs',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Web App Guide', link: '/web-app' },
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
      },
      {
        text: 'Development',
        items: [
          { text: 'Overview', link: '/development' },
          { text: 'Architecture', link: '/development/architecture' },
          { text: 'Testing', link: '/development/testing' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/COOLmanYT/skystyle' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Sky Style Docs — always in sync with skystyle.app/api/v1',
      copyright: 'Copyright 2026 Sky Style'
    }
  }
})

