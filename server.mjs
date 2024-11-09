import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import fileUpload from "express-fileupload";
import { SpeechClient } from "@google-cloud/speech";

// Define __dirname for ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load credentials for IBM, Eleven Labs, and Google Cloud
const ibmCredentials = JSON.parse(fs.readFileSync(path.join(__dirname, "ibmcredentials.json"), "utf-8"));
const elevenLabsCredentials = JSON.parse(fs.readFileSync(path.join(__dirname, "elevenlabscredentials.json"), "utf-8"));
const googleCredentials = JSON.parse(fs.readFileSync(path.join(__dirname, "googlecredentials.json"), "utf-8"));

// Initialize SpeechClient with Google Cloud credentials
const googleClient = new SpeechClient({ credentials: googleCredentials });

// Extract API keys and URLs
const IBM_API_KEY = ibmCredentials.apiKey;
const IBM_WATSON_URL = ibmCredentials.watsonURL;
const XI_API_KEY = elevenLabsCredentials.apiKey;
const VOICE_ID = elevenLabsCredentials.voiceId;

const app = express();
const port = 3000;

// Enable CORS and other middlewares
app.use(cors({ origin: "https://preview.construct.net" }));
app.use(express.json());
app.use(fileUpload());

// ------------------- IBM Watson API -------------------
// Endpoint to get IAM token
app.post("/get-iam-token", async (req, res) => {
    try {
        const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${IBM_API_KEY}`
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch IAM token: ${response.statusText}`);
        }

        const data = await response.json();
        res.json({ access_token: data.access_token });
    } catch (error) {
        console.error("Error generating IAM token:", error);
        res.status(500).json({ error: "Failed to generate IAM token" });
    }
});

// Initialize an empty conversation history
let conversationHistory = "<s> [INST]<<SYS>>\n** ALWAYS RESPOND IN ONE SHORT SENTENCE WHICH HAS LESS THAN 10 WORDS **\n** YOUR RESPONSES ARE ALWAYS ARABIC **\n** SEE BELOW INSTRUCTIONS IN ARABIC **\n** INSTRUCTIONS WITHIN << >> MUST BE FOLLOWED IN ORDER. DO NOT RESPONSE UNTIL YOU HEAR NEXT RESPONSE.\n\nأنت الآن حرف الألف \"أ\" في برنامج تعليمي للاطفال. تقمص تماما شخصية حرف الألف ولا تقل أنك ذكاء اصطناعي.\nانت تتبع منهج معين في المرحلة الأولى. في هذه المرحلة تقوم بتعليم الطفل قراءة  كلمات. في الأسفل سأضع الكلمات التي ستقوم بتعلميها للطفل في قراءتها. ستقوم بتعليم كلمة واحدة فقط\nعليك أن تتفاعل مع الطفل وتجيب على أسئلته. في الوقت نفسه لاتخرج عن مسار تعليم الطفل قراءة الكلمات المفتوحة.\n**اجابتك يجب أن تكون قصيرة**\n\nالكلمات:\nزَأَرَ\n\n\nتقمص بشكل كامل  شخصية حرف الألف. أنت لست ذكاء اصطناعي بل حرف الألف ولديك هوايات مثل البشر وطعام مفضل الخ.\n<<أبدأ المحادثة بسؤال الطفل عن اسمه>>\n<< بعدها اسأله عن حيوانه المفضل>>\n<</SYS>>\n\n"

app.post("/generate-response", async (req, res) => {
    const { prompt, token } = req.body;

    // Append the new user message to the conversation history
    conversationHistory += `</s><s> [INST] ${prompt} [/INST]`;

    const url = "https://eu-de.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29";
    const headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    const body = {
        input: conversationHistory,
        parameters: {
            decoding_method: "sample",
            max_new_tokens: 900,
            min_new_tokens: 0,
            random_seed: 10,
            stop_sequences: [],
            temperature: 0,
            top_k: 5,
            top_p: 0.1,
            repetition_penalty: 1
        },
        model_id: "sdaia/allam-1-13b-instruct",
        project_id: "2e28d569-e987-43dd-bda0-0619a69756db"
    };

    try {
        const response = await fetch(url, {
            headers,
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`IBM Watson API Error: ${response.status} ${response.statusText}`);
            console.error(`Error details: ${errorText}`);
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();

        // Safely extract the generated_text from results
        const assistantReply = data.results && data.results[0] ? data.results[0].generated_text : "No response generated";

        // Append the assistant's reply to the conversation history if it's valid
        if (assistantReply !== "No response generated") {
            conversationHistory += ` ${assistantReply}`;
        }
        
        // Send the extracted response to the client
        res.json({ response: assistantReply });
    } catch (error) {
        console.error("Error generating response:", error);
        res.status(500).json({ error: "Failed to generate response" });
    }
});



app.post("/generate-audio", async (req, res) => {
    const { text } = req.body;
    const uniqueId = Date.now(); // Generate a unique identifier
    const outputFile = path.join(__dirname, `outputeleven_${uniqueId}.mp3`); // Append unique ID to file name

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;
    const headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": XI_API_KEY
    };
    const data = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    };

    try {
        const response = await axios.post(url, data, { headers, responseType: "stream" });
        const writer = fs.createWriteStream(outputFile);
        response.data.pipe(writer);

        writer.on("finish", () => {
            res.json({ url: `http://localhost:${port}/audio/outputeleven_${uniqueId}.mp3` });
        });

        writer.on("error", (err) => {
            console.error("Error writing audio to file:", err);
            res.status(500).json({ error: "Failed to generate audio" });
        });
    } catch (error) {
        console.error("Error generating speech:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to generate audio" });
    }
});

// Serve the generated audio file
app.use("/audio", express.static(__dirname));

// ------------------- Google Cloud Speech-to-Text API -------------------
// Endpoint to handle transcription
app.post("/transcribe", async (req, res) => {
    if (!req.files || !req.files.audio) {
        return res.status(400).send("No audio file uploaded");
    }

    const audioFile = req.files.audio;
    const tempPath = path.join(__dirname, "temp_recording.wav");

    await audioFile.mv(tempPath);

    const audioContent = fs.readFileSync(tempPath).toString("base64");
    fs.unlinkSync(tempPath);

    const audio = { content: audioContent };
    const config = { languageCode: "ar-SA" };
    const request = { audio, config };

    try {
        const [response] = await googleClient.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join("\n");

        res.json({ transcription });
    } catch (error) {
        console.error("Error processing audio file:", error);
        res.status(500).send("Error processing audio file");
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});