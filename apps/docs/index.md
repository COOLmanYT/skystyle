---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Sky Style Docs"
  text: "Weather-aware outfit intelligence"
  tagline: Get started, explore the app, and build with the public API
  image:
    src: /images/dashboard-2.png
    alt: Sky Style dashboard preview
  actions:
    - theme: brand
      text: Get Started
      link: /web-app/getting-started
    - theme: alt
      text: Open Sky Style
      link: https://skystyle.app

features:
  - title: Dress for your day
    details: Use local weather and your own closet to build an outfit, then refine it with follow-up questions.
  - title: AI Outfit API
    details: Access AI-powered outfit recommendations via REST. Authenticate with an API key and POST coordinates to get an instant outfit suggestion.
  - title: Weather Data API
    details: Fetch real-time weather for any coordinates — temperature, humidity, UV index, wind, rain chance, and active alerts.
  - title: Closet API
    details: Read the closet of the key owner to build personalised integrations on top of the user's saved wardrobe.
---

## Quick links

- [Authentication guide](/api/authentication)
- [POST /recommend](/api/recommend)
- [POST /recweather](/api/recweather)
- [GET /weather](/api/weather)
- [GET /closet](/api/closet)
- [Errors & Credits](/api/errors)
- [Web app guide](/web-app)

## Development

- [Contributor guide](/development/)
- [Testing](/development/testing)
- [Architecture](/development/architecture)
