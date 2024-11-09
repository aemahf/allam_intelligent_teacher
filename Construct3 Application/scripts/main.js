import * as myWatson from "./watson.js";
import * as myLabs from "./11labs.js";
import * as myGoogleSTT from "./googlespeechtotext.js";

let config = null;
let runtime = null;
let sprite = null;


// Load JSON configuration file
async function loadConfig() {
    try {
        const projUrl = await c3_runtimeInterface._GetLocalRuntime()._assetManager.LoadProjectFileUrl('config.json');
        const configData = await c3_runtimeInterface._GetLocalRuntime()._assetManager.FetchJson(projUrl);
        console.log("Config Data Loaded:", configData);
        return configData;
    } catch (error) {
        console.error("Error loading config:", error);
        return null;
    }
}

// Main startup function to initialize runtime and load configuration
runOnStartup(async (runtimeInstance) => {
    runtime = runtimeInstance;
    runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));
});

// Initialize configuration
async function OnBeforeProjectStart(runtime) {
    console.log("Initializing...");
    config = await loadConfig();
    if (!config) {
        console.error("Failed to load configuration.");
    }
	sprite = runtime.objects.Aleph.getFirstInstance();

}

// Button click handler to start recording
async function startRecording() {
    console.log("Starting recording...");
    await myGoogleSTT.startRecording();
}

// Stop recording, transcribe, and process response
async function stopRecordingAndProcess() {
    try {
        console.log("Stopping recording and processing transcription...");
        const transcribedText = await myGoogleSTT.stopRecordingAndTranscribe();

        if (transcribedText) {
            console.log("Transcription:", transcribedText);

            // Send transcription to IBM Watson for a response
            const watsonResponse = await myWatson.generateResponse(transcribedText, config);

            if (watsonResponse) {
                console.log("Watson Response:", watsonResponse);

                // Send Watson's response to Google Text-to-Speech for playback
                myLabs.generateAndPlayAudio(watsonResponse,sprite);
            } else {
                console.error("No response from IBM Watson.");
            }
        } else {
            console.error("No transcription received.");
        }
    } catch (error) {
        console.error("Error in stopRecordingAndProcess:", error);
    }
}

// Attach functions to the window object for global access
window.startRecording = startRecording;
window.stopRecordingAndProcess = stopRecordingAndProcess;