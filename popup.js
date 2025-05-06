document.addEventListener('DOMContentLoaded', async () => {
    const taskListSelect = document.getElementById('taskList');
    const taskTitleInput = document.getElementById('taskTitle');
    const taskNotesInput = document.getElementById('taskNotes');
    const addTaskButton = document.getElementById('addTaskButton');
    const statusDiv = document.getElementById('status');

    // Define a key for storing the last used list ID
    const LAST_USED_LIST_KEY = 'lastUsedTaskListId';

    // Function to update status message
    function updateStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.className = isError ? 'error' : '';
    }

    // Function to fetch current tab info and populate fields
    async function populateTaskDetails() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            if (currentTab) {
                let pageTitle = currentTab.title || '';
                const pageUrl = currentTab.url || '';

                // --- YouTube Title Cleaning Logic (moved to popup) ---
                if (pageUrl && pageUrl.includes('youtube.com/watch?v=')) {
                    pageTitle = pageTitle.replace(/^\(\d+\)\s*/, ''); // Remove "(number)" prefix
                    console.log(`Cleaned YouTube title for input: ${pageTitle}`);
                }
                // --- End YouTube Title Cleaning Logic ---

                taskTitleInput.value = pageTitle;
                taskNotesInput.value = pageUrl;
            } else {
                updateStatus('Could not get current tab info.', true);
            }
        } catch (error) {
            updateStatus('Error getting tab info. Check console.', true);
            console.error("Error getting tab info:", error);
        }
    }

    // Fetch task lists from the background script
    updateStatus('Loading task lists...');
    try {
        // Send a message to the background script requesting task lists
        const response = await chrome.runtime.sendMessage({ action: "fetchTaskLists" });

        if (response && response.success && response.taskLists) {
            // Sort task lists alphabetically by title
            response.taskLists.sort((a, b) => {
                const titleA = a.title.toLowerCase();
                const titleB = b.title.toLowerCase();
                if (titleA < titleB) {
                    return -1;
                }
                if (titleA > titleB) {
                    return 1;
                }
                return 0;
            });

            // Populate the dropdown with sorted task lists
            taskListSelect.innerHTML = ''; // Clear loading message
            response.taskLists.forEach(list => {
                const option = document.createElement('option');
                option.value = list.id;
                option.textContent = list.title;
                taskListSelect.appendChild(option);
            });

            // Retrieve the last used list ID from storage
            chrome.storage.local.get([LAST_USED_LIST_KEY], (result) => {
                const lastUsedListId = result[LAST_USED_LIST_KEY];
                if (lastUsedListId) {
                    // Check if the last used list still exists in the fetched lists
                    const lastUsedListExists = response.taskLists.some(list => list.id === lastUsedListId);
                    if (lastUsedListExists) {
                        taskListSelect.value = lastUsedListId; // Set the dropdown to the last used list
                    }
                }
            });

            updateStatus(''); // Clear status on success
            addTaskButton.disabled = false; // Enable button once lists are loaded
            await populateTaskDetails(); // Populate title/notes after lists load
        } else {
             updateStatus(`Failed to load task lists: ${response.error || 'Unknown error'}. Check console.`, true);
             console.error("Failed to fetch task lists response:", response);
             addTaskButton.disabled = true;
        }
    } catch (error) {
        updateStatus('Error loading task lists. Check console.', true);
        console.error("Error fetching task lists:", error);
        addTaskButton.disabled = true;
    }

    // Add task button click listener
    addTaskButton.addEventListener('click', async () => {
        const selectedListId = taskListSelect.value;
        const taskTitle = taskTitleInput.value.trim(); // Get title from input
        const taskNotes = taskNotesInput.value.trim(); // Get notes from input

        if (!selectedListId) {
            updateStatus('Please select a task list.', true);
            return;
        }
        if (!taskTitle) {
            updateStatus('Please enter a task title.', true);
            return;
        }

        updateStatus('Adding task...');
        addTaskButton.disabled = true; // Disable button while adding

        try {
            // Send a message to the background script to create the task
            // Pass the title and notes from the input fields
            const response = await chrome.runtime.sendMessage({
                action: "createTaskInList",
                taskListId: selectedListId,
                taskTitle: taskTitle, // Send edited title
                taskNotes: taskNotes  // Send edited notes
            });

            if (response && response.success) {
                updateStatus('Task added successfully!');

                // Save the selected list ID to local storage
                chrome.storage.local.set({ [LAST_USED_LIST_KEY]: selectedListId });

                // Optionally close the popup after a delay
                setTimeout(() => window.close(), 1500);
            } else {
                updateStatus(`Failed to add task: ${response.error || 'Unknown error'}`, true);
                console.error("Failed to create task response:", response);
                addTaskButton.disabled = false; // Re-enable button on failure
            }
        } catch (error) {
             updateStatus(`Error adding task: ${error.message || error}`, true);
             console.error("Error creating task:", error);
             addTaskButton.disabled = false; // Re-enable button on failure
        }
    });
});
