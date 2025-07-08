# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## reCAPTCHA Setup (for Sign Up Page Security)

This project uses Google reCAPTCHA v3 to protect the sign-up page from bots. To enable this, you need to generate a "Site Key" and a "Secret Key" and add them to your environment variables.

1.  **Go to the Google Cloud Console:**
    *   Navigate to [reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha).
    *   Make sure you have selected the correct Google Cloud project.

2.  **Create a reCAPTCHA Key:**
    *   Click **"+ Create Key"**.
    *   **Display Name:** Give it a memorable name (e.g., "MyRydz App").
    *   **Choose a platform:** Select **"Website"**.

3.  **Domain Settings:**
    *   **Integration type:** Select **"Score-based (no challenge)"**. This is for reCAPTCHA v3.
    *   **Domains:** Add all the domains where your app will run.
        *   For local development on Project IDX, you need to add your preview URL's domain. It will look something like `*.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev`.
        *   Also add `localhost` for local development outside of IDX.
        *   When you deploy to production, add your production domain here (e.g., `your-app-name.web.app`).

4.  **Get Your Keys:**
    *   After creation, you will see your **Site Key** and **Secret Key**.
    *   Copy these values.

5.  **Update Your Environment Variables:**
    *   Open the `.env` file in the root of your project.
    *   Find the following lines and paste your keys:
        ```
        NEXT_PUBLIC_RECAPTCHA_SITE_KEY="YOUR_SITE_KEY_HERE"
        RECAPTCHA_SECRET_KEY="YOUR_SECRET_KEY_HERE"
        ```

After adding the keys, restart your development server for the changes to take effect.

## Troubleshooting

### Google Maps "InvalidKeyMapError", Map Not Loading, or Markers Not Appearing

If the interactive map components are not loading, you see an `InvalidKeyMapError`, or markers for addresses fail to appear, it usually means there's an issue with your Google Maps API Key configuration.

1.  **Check your Environment Variable**:
    *   Ensure you have a file named `.env` in the root of your project.
    *   Inside `.env`, make sure you have `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_ACTUAL_KEY` set, where `YOUR_ACTUAL_KEY` is your valid Google Maps API key.

2.  **Google Cloud Console Configuration**:
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Select the project linked to your API key.
    *   Navigate to **APIs & Services > Credentials**.
        *   Verify your API key is listed and correct.
    *   Navigate to **APIs & Services > Library**.
        *   Search for "Maps JavaScript API" and ensure it is **ENABLED** for your project.
        *   Search for "Geocoding API" and ensure it is **ENABLED**. This is required to convert addresses into map coordinates for markers.
    *   Back in **APIs & Services > Credentials**, click on your API key to edit its settings:
        *   **API restrictions**: Ensure "Maps JavaScript API" and "Geocoding API" are in the list of allowed APIs. If you restrict by API, you must explicitly allow both.
        *   **Application restrictions**:
            *   For development, if you use "HTTP referrers", make sure to add `http://localhost:*/*` (or your specific development port) to the list of allowed websites.
            *   For production, add your deployed application's URL(s).
            *   If you're seeing `InvalidKeyMapError` it's very likely an issue here.

3.  **Billing**: Ensure that billing is enabled for your Google Cloud project, as both the Maps JavaScript API and the Geocoding API require it.

After making changes in the Google Cloud Console, it might take a few minutes for them to propagate. You may also need to restart your Next.js development server.
