export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();

    const video = formData.get("video");
    const prompt = formData.get("prompt") || "";

    if (!video) {
      return new Response(
        JSON.stringify({ error: "No video uploaded." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Convert uploaded video to a data URI that Runway can receive.
    const buffer = await video.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, i + chunkSize)
      );
    }

    const base64 = btoa(binary);

    const mimeType = video.type || "video/mp4";
    const videoUri = `data:${mimeType};base64,${base64}`;

    const runwayPrompt =
      `Keep the original bike, rider, movement, camera motion, and timing. ` +
      `Transform the surrounding environment realistically. ` +
      `${prompt}`;

    const response = await fetch(
      "https://api.dev.runwayml.com/v1/video_to_video",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${context.env.RUNWAY_API_KEY}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({
          model: "gemini_omni_flash",
          videoUri: videoUri,
          promptText: runwayPrompt
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}