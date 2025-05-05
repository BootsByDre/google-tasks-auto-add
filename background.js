// Replace with your actual client ID from Google Cloud Console
const CLIENT_ID = "1083733577571-qd2plf7h0uvkkcpsct1o1sg60m00jjgc.apps.googleusercontent.com";
const SCOPES = ["https://www.googleapis.com/auth/tasks"];

// Function to get an OAuth2 access token
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        // Log the full error object for debugging
        console.error("OAuth Error:", chrome.runtime.lastError);
        reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError)}`));
      } else {
        resolve(token);
      }
    });
  });
}

// Function to create a task using the Google Tasks API
async function createTask(accessToken, taskTitle, taskUrl) {
  const apiUrl = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks"; // @default refers to the user's default task list

  const task = {
    title: taskTitle,
    notes: taskUrl // Putting the URL back in the notes/description
  };

  // Log the task object being sent
  console.log("Sending task data to API:", JSON.stringify(task));

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(task)
    });

    if (!response.ok) {
      // Handle API errors
      const errorBody = await response.json();
      console.error("Google Tasks API Error:", response.status, response.statusText, errorBody);
      // Provide more detail in the error message
      const errorMessage = errorBody.error ? (errorBody.error.message || JSON.stringify(errorBody.error)) : JSON.stringify(errorBody);
      throw new Error(`API error ${response.status}: ${errorMessage}`);
    }

    const createdTask = await response.json();
    console.log("Task created successfully. API response:", createdTask); // Log the full response

    return createdTask;

  } catch (error) {
    console.error("Error creating task:", error);
    throw error; // Re-throw the error so the main catch block can handle the notification
  }
}

// Listen for the browser action (extension icon) click
chrome.action.onClicked.addListener(async (tab) => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const currentTab = tabs[0];

    if (currentTab) {
      const pageTitle = currentTab.title;
      const pageUrl = currentTab.url;

      try {
        // Get the OAuth2 access token
        const accessToken = await getAuthToken();

        // Create the task using the API
        await createTask(accessToken, pageTitle, pageUrl);

        // Show a success notification
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png", // Ensure this path is correct
          title: "Task Added",
          message: `Added "${pageTitle}" to Google Tasks.`,
          priority: 1
        });

      } catch (error) {
        console.error("Failed to add task:", error);
        // Show an error notification with a more detailed message
        let userErrorMessage = "An unknown error occurred.";
        if (error instanceof Error) {
            userErrorMessage = error.message;
        } else if (typeof error === 'string') {
            userErrorMessage = error;
        } else {
            // Attempt to stringify other types of errors
            try {
                userErrorMessage = JSON.stringify(error);
            } catch (e) {
                userErrorMessage = "Could not stringify error object.";
            }
        }

        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png", // Ensure this path is correct
          title: "Error Adding Task",
          message: `Could not add task: ${userErrorMessage}`,
          priority: 1
        });
      }

    } else {
      console.error("Could not get active tab information.");
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png", // Ensure this path is correct
        title: "Error",
        message: "Could not retrieve current tab information.",
        priority: 1
      });
    }
  });
});

// You will also need extension icons (e.g., icon16.png, icon48.png, icon128.png)
// Add these to an 'icons' directory in the same location as your manifest.json and background.js
