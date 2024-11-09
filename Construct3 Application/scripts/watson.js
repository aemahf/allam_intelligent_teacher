const proxyUrl = "http://localhost:3000";

// Get IAM token from the proxy server
async function getIAMToken() {
    try {
        const response = await fetch(`${proxyUrl}/get-iam-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch IAM token from proxy: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("IAM Token:", data.access_token);
        return data.access_token;
    } catch (error) {
        console.error("Error fetching IAM token from proxy:", error);
        throw error;
    }
}

// Generate a response using IBM Watson via the proxy server
export async function generateResponse(question, config) {
    try {
        const iamToken = await getIAMToken();

        const formattedQuestion = `[INST] <<SYS>>  <<</s>> <s> [INST]${question} [/INST]`;

        const response = await fetch(`${proxyUrl}/generate-response`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: formattedQuestion,
                token: iamToken
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to get response from proxy: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("AI Response:", data.response);
        return data.response;
    } catch (error) {
        console.error("Error generating response:", error);
        return null;
    }
}