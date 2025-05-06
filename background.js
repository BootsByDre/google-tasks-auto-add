// Replace with your actual client ID from Google Cloud Console
const CLIENT_ID = "1083733577571-qd2plf7h0uvkkcpsct1o1sg60m00jjgc.apps.googleusercontent.com";
const SCOPES = ["https://www.googleapis.com/auth/tasks"];

// Function to get an OAuth2 access token
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error("OAuth Error:", chrome.runtime.lastError);
        // Check for specific errors like interactive sign-in required
        if (chrome.runtime.lastError.message.includes("user interaction required")) {
             reject(new Error("Authentication required. Please click the extension icon again to sign in."));
        } else {
             reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError)}`));
        }
      } else {
        resolve(token);
      }
    });
  });
}

// Function to fetch task lists from the Google Tasks API
async function fetchTaskLists(accessToken) {
    const apiUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists"; // Endpoint to list task lists

    try {
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Google Tasks API Fetch Lists Error:", response.status, response.statusText, errorBody);
            const errorMessage = errorBody.error ? (errorBody.error.message || JSON.stringify(errorBody.error)) : JSON.stringify(errorBody);
            throw new Error(`API fetch lists error ${response.status}: ${errorMessage}`);
        }

        const taskLists = await response.json();
        console.log("Successfully fetched task lists:", taskLists);
        return taskLists.items || []; // Return the array of task lists
    } catch (error) {
        console.error("Error fetching task lists:", error);
        throw error;
    }
}

// Function to create a task in a specific list using the Google Tasks API
// Renamed parameters for clarity
async function createTaskInList(accessToken, taskListId, title, notes) {
  // API endpoint to create a task in a specific list
  const apiUrl = `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`;

  const task = {
    title: title, // Use the title passed from the popup
    notes: notes // Use the notes passed from the popup
  };

  console.log(`Sending task data to API for list ${taskListId}:`, JSON.stringify(task));

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
      const errorBody = await response.json();
      console.error("Google Tasks API Create Task Error:", response.status, response.statusText, errorBody);
      const errorMessage = errorBody.error ? (errorBody.error.message || JSON.stringify(errorBody.error)) : JSON.stringify(errorBody);
      throw new Error(`API create task error ${response.status}: ${errorMessage}`);
    }

    const createdTask = await response.json();
    console.log("Task created successfully. API response:", createdTask);

    return createdTask;

  } catch (error) {
    console.error("Error creating task:", error);
    throw error;
  }
}

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received message from popup:", request);

    // Use an immediately invoked async function to handle the asynchronous logic
    (async () => {
        if (request.action === "fetchTaskLists") {
            try {
                const accessToken = await getAuthToken();
                const taskLists = await fetchTaskLists(accessToken);
                sendResponse({ success: true, taskLists: taskLists });
            } catch (error) {
                console.error("Error handling fetchTaskLists message:", error);
                sendResponse({ success: false, error: error.message });
            }
        }

        if (request.action === "createTaskInList") {
            try {
                // Get task details directly from the request message
                const taskListId = request.taskListId;
                const taskTitle = request.taskTitle; // Get title from message
                const taskNotes = request.taskNotes; // Get notes from message

                if (!taskListId || !taskTitle) {
                     sendResponse({ success: false, error: "Missing task list ID or title." });
                     return; // Exit the async function
                }

                const accessToken = await getAuthToken();
                // Pass the title and notes received from the popup
                await createTaskInList(accessToken, taskListId, taskTitle, taskNotes);

                // Show a success notification (use the title from the request)
                chrome.notifications.create({
                  type: "basic",
                  iconUrl: "icons/icon128.png", // Ensure this path is correct
                  title: "Task Added",
                  message: `Added "${taskTitle}" to Google Tasks.`, // Use the provided title
                  priority: 1
                });

                sendResponse({ success: true });

            } catch (error) {
                console.error("Error handling createTaskInList message:", error);
                 // Show an error notification
                let userErrorMessage = "An unknown error occurred.";
                if (error instanceof Error) {
                    userErrorMessage = error.message;
                } else if (typeof error === 'string') {
                    userErrorMessage = error;
                } else {
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

                sendResponse({ success: false, error: error.message || userErrorMessage });
            }
        }
    })(); // Immediately invoke the async function

    return true; // Important: Indicates that sendResponse will be called asynchronously
});

// Removed the chrome.action.onClicked listener as the popup handles the interaction
