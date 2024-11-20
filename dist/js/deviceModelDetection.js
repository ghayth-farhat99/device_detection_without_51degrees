async function detectDevice() {
    const deviceInfo = {};

    // Use Client Hints if supported
    if (navigator.userAgentData) {
        try {
            const data = await navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion', 'architecture', 'uaFullVersion']);
            deviceInfo.isMobile = navigator.userAgentData.mobile;
            deviceInfo.hardwareModel = data.model || "Unknown";
            deviceInfo.platform = data.platform || "Unknown";
            deviceInfo.platformVersion = data.platformVersion || "Unknown";
        } catch (error) {
            console.error("Client Hints detection failed:", error);
        }
    }

    // Fallback to User-Agent parsing
    const userAgent = navigator.userAgent;
    deviceInfo.userAgent = userAgent;

    // Example regex for extracting info from User-Agent
    const uaMatch = userAgent.match(/\((.*?)\)/);
    if (uaMatch) {
        deviceInfo.rawInfo = uaMatch[1];
    }

    console.log("Detected Device Info:", deviceInfo);

    // Send device info to server
    fetch('/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(deviceInfo)
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            return response.json();
        }
    })
    .then(data => {
        console.log("Success:", data);
    })
    .catch(error => {
        console.error("Error:", error);
    });
}

// Trigger detection on page load
window.addEventListener("load", detectDevice);