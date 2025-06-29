# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Troubleshooting

### Google Maps "InvalidKeyMapError", Map Not Loading, or Markers Not Appearing

If the interactive map components are not loading, you see an `InvalidKeyMapError`, or markers for addresses fail to appear, it usually means there's an issue with your Google Maps API Key configuration.

1.  **Check your Environment Variable**:
    *   Ensure you have a file named `.env.local` in the root of your project.
    *   Inside `.env.local`, make sure you have `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_ACTUAL_KEY` set, where `YOUR_ACTUAL_KEY` is your valid Google Maps API key.

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
