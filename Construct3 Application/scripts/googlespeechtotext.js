let audioStream;
let recorder;
let audioChunks = [];

// Start recording audio
export async function startRecording() {
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(audioStream);

        recorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        recorder.start();
        console.log("Recording started");
    } catch (error) {
        console.error("Error starting recording:", error);
    }
}

// Stop recording and send audio to Google Speech-to-Text API
export async function stopRecordingAndTranscribe() {
    return new Promise((resolve, reject) => {
        recorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = [];

            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.wav");

            try {
                const response = await fetch("http://localhost:3000/transcribe", {
                    method: "POST",
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Transcription failed: ${response.statusText}`);
                }

                const data = await response.json();
                console.log("Transcription:", data.transcription);
                resolve(data.transcription);

            } catch (error) {
                console.error("Error transcribing audio:", error);
                reject(error);
            }
        };

        recorder.stop();
        audioStream.getTracks().forEach(track => track.stop());
        console.log("Recording stopped");
    });
}