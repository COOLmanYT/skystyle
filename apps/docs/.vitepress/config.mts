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
      { text: 'API Guide', link: '/api-examples' },
      { text: 'Archive', link: '/reference/vitepress-starter/archive' }
    ],

    sidebar: [
      {
        text: 'Sky Style Docs',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Platform Guide', link: '/markdown-examples' },
          { text: 'API Guide', link: '/api-examples' },
          { text: 'VitePress Starter Archive', link: '/reference/vitepress-starter/archive' }
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
      message: 'Sky Style docs and API references are evolving with the product.',
      copyright: 'Copyright 2026 Sky Style. Current WIP deployment: what2wear-two.vercel.app'
    }
  }
})
