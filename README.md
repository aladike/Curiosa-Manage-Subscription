# Curiosa Manage Subscription

This folder is a frontend-only GitHub Pages MVP for Curiosa subscription management.

## What it does

- Reads the subscriber token from the page URL
- Loads current settings from the `manage-subscription` Supabase Edge Function
- Lets the subscriber manage:
  - daily on/off
  - weekly on/off
  - daily source selection by category
- Saves and resets preferences through the Edge Function only

The browser does not talk to Supabase tables directly.

## Configure before publishing

Edit the config block in [index.html](./index.html):

```html
<script>
    window.CURIOSA_MANAGE_CONFIG = {
        apiBaseUrl: "https://<your-project>.supabase.co/functions/v1/manage-subscription"
    };
</script>
```

## Publish to a separate GitHub Pages repo

1. Copy this folder into the root of the separate Pages repository.
2. Keep the files together:
   - `index.html`
   - `styles.css`
   - `app.js`
3. Publish that repository with GitHub Pages.
4. Set `MANAGE_SUBSCRIPTION_BASE_URL` in the Curiosa email runtime to the published page URL, for example:

```text
https://<user>.github.io/curiosa-manage-subscription/
```

Curiosa will append `?token=...` automatically when building Manage Subscription links.
