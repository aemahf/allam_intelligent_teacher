let currentAudio = null;

export function generateAndPlayAudio(text,sprite) {
    const endpoint = 'http://localhost:3000/generate-audio';

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    })
    .then(response => response.json())
    .then(data => {
        if (data.url) {
            // Stop and clear previous audio if it's still playing
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = "";
                currentAudio.load();
            }
            // Create a new audio element for the fresh URL
            currentAudio = new Audio(data.url);
			sprite.setAnimation("Animation 2");
            currentAudio.play();
			// When audio finishes, set the animation back to "Animation 1"
            currentAudio.addEventListener("ended", () => {
                sprite.setAnimation("Animation 1");
            });



            // Optionally add playback within Construct 3's sound system if needed
            if (window.runtime) {
                window.runtime.objects.Audio.playSound(data.url);
            }
        } else {
            console.error("Failed to generate audio:", data.error);
        }
    })
    .catch(error => console.error("Error:", error));
}