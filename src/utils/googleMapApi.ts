import axios from "axios";

export async function geocodeAddress(fullAddress: string) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      fullAddress
    )}&limit=1`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "EZCenter/1.0", // Required by Nominatim usage policy
      },
    });

    const data = response.data;

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    } else {
      // Return null coordinates if no results found
      return {
        lat: null,
        lng: null,
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    // Return null coordinates on error
    return {
      lat: null,
      lng: null,
    };
  }
}
