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

    const buffer = await video.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let binary = "";

    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, i + 0x8000)
      );
    }

    const base64 = btoa(binary);
    const mimeType = video.type || "video/mp4";

    const videoUri = `data:${mimeType};base64,${base64}`;

    const runwayResponse = await fetch(
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
          promptText:
            `Keep the original bike, rider, movement, camera motion, and timing. ` +
            `Transform the environment realistically. ${prompt}`
        })
      }
    );

    const task = await runwayResponse.json();

    if (!runwayResponse.ok) {
      return new Response(JSON.stringify(task), {
        status: runwayResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const taskId = task.id;

    // Wait for Runway to finish.
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
        {
          headers: {
            "Authorization": `Bearer ${context.env.RUNWAY_API_KEY}`,
            "X-Runway-Version": "2024-11-06"
          }
        }
      );

      const status = await statusResponse.json();

      if (status.status === "SUCCEEDED") {
        return new Response(
          JSON.stringify({
            success: true,
            videoUrl: status.output?.[0] || null
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (
        status.status === "FAILED" ||
        status.status === "CANCELED"
      ) {
        return new Response(
          JSON.stringify({
            error: "Runway generation failed.",
            details: status
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: "Generation is taking too long. Try again later.",
        taskId: taskId
      }),
      {
        status: 504,
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