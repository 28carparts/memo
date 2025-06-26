// This script should be loaded after the Firebase and Flatpickr libraries have been loaded.

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBOfrCOivIkOA0BzMQ8teMhMtglhhsj6aI",
    authDomain: "perrymemonotes.firebaseapp.com",
    databaseURL: "https://perrymemonotes-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "perrymemonotes",
    storageBucket: "perrymemonotes.appspot.com",
    messagingSenderId: "169391391927",
    appId: "1:169391391927:web:f045f75d77afcaa959b932"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
let dbRef = null; // Will hold reference to user's data in DB

// --- AUTHENTICATION ---

// DOM Element References for Auth
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showLoginButton = document.getElementById('showLoginButton');
const showRegisterButton = document.getElementById('showRegisterButton');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const userInfoContainer = document.getElementById('userInfoContainer');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const logoutButton = document.getElementById('logoutButton');

// Toggle between login and register forms
showLoginButton.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    showLoginButton.classList.add('active');
    showRegisterButton.classList.remove('active');
});

showRegisterButton.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    showLoginButton.classList.remove('active');
    showRegisterButton.classList.add('active');
});

// Handle Registration
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    registerError.textContent = '';

    if (password !== confirmPassword) {
        registerError.textContent = "Passwords do not match.";
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .catch(error => {
            registerError.textContent = error.message;
        });
});

// Handle Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    loginError.textContent = '';

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            loginError.textContent = error.message;
        });
});

// Handle Logout
logoutButton.addEventListener('click', () => {
    auth.signOut();
});


// Auth State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in.
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userInfoContainer.classList.remove('hidden');
        userEmailDisplay.textContent = user.email;

        // Set up database reference for the logged-in user
        dbRef = db.ref(`users/${user.uid}/appData`);

        // Listen for data changes
        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                loadDataFromFirebase(data);
            } else {
                // New user, set up default data
                initializeDefaultData();
            }
            updateUI();
        });
        
        // Initialize the app state after login
        updateDateAndWeekInputs();

    } else {
        // User is signed out.
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        userInfoContainer.classList.add('hidden');

        // Detach the database listener
        if (dbRef) {
            dbRef.off();
        }
        // Clear local state
        resetLocalState();
        updateUI();
    }
});


// --- APPLICATION LOGIC ---

// DOM Element References
const messageInput = document.getElementById('messageInput');
const memoNameInput = document.getElementById('memoNameInput');
const memoDateInput = document.getElementById('memoDateInput'); 
const memoDateIcon = document.getElementById('memoDateIcon');
const memoWeekInput = document.getElementById('memoWeekInput'); 
const importanceButtonsContainer = document.getElementById('importanceButtonsContainer');
const saveButton = document.getElementById('saveButton');
const charCount = document.getElementById('charCount');
const messageCount = document.getElementById('messageCount');
const debugMessage = document.getElementById('debugMessage');
const pagesContainer = document.getElementById('pagesContainer');
const newPageNameInput = document.getElementById('newPageNameInput');
const addPageButton = document.getElementById('addPageButton');
const currentMemoPageTitle = document.getElementById('currentMemoPageTitle');
const globalSearchButton = document.getElementById('globalSearchButton');
const exportButton = document.getElementById('exportButton'); 
const memoDisplayArea = document.getElementById('memoDisplayArea'); 
const importanceFilterContainer = document.getElementById('importanceFilterContainer');
const filterNotificationArea = document.getElementById('filterNotificationArea'); 
const openLargeMessageInputModalButton = document.getElementById('openLargeMessageInputModal');
const largeMessageInputModal = document.getElementById('largeMessageInputModal');
const largeMessageInputTextArea = document.getElementById('largeMessageInputTextArea');
const closeLargeMessageInputModalButton = document.getElementById('closeLargeMessageInputModalButton');
const saveLargeMessageButton = document.getElementById('saveLargeMessageButton'); // Still needed for internal logic
const cancelLargeMessageButton = document.getElementById('cancelLargeMessageButton'); // Still needed for internal logic


// Global State Variables
let pages = {}; 
let pageOrder = []; 
let currentPage = 'default'; 
const maxMemos = 53; 
const memoBgColors = [ 
    'memo-bg-0', 'memo-bg-1', 'memo-bg-2', 'memo-bg-3', 'memo-bg-4',
    'memo-bg-5', 'memo-bg-6', 'memo-bg-7', 'memo-bg-8', 'memo-bg-9',
    'memo-bg-10', 'memo-bg-11', 'memo-bg-12', 'memo-bg-13', 'memo-bg-14', 'memo-bg-15'
];
const MAX_MEMO_LINES = 6; 
let draggedMemoIndex = null; 
let draggedMemoElement = null; 
let draggedOverTargetElement = null; 
let draggedPageName = null; 
let draggedOverPageTargetElement = null; 
let flatpickrInstance = null;

const importanceLevels = {
    onTrack: { label: 'On track', lightClass: 'light-on-track', borderColorClass: 'importance-level-1' },
    caution: { label: 'Caution', lightClass: 'light-caution', borderColorClass: 'importance-level-5' },
    urgent: { label: 'Urgent', lightClass: 'light-urgent', borderColorClass: 'importance-level-9' },
    complete: { label: 'Complete', lightClass: 'light-complete', borderColorClass: 'importance-level-complete' }
};
let selectedImportance = null; 
let currentFilter = 'all'; 

// --- Font Size Adjustment ---
const initialFontSize = 16; // Base font size in px for adjustable textareas/divs like modals
const minFontSize = 10;
const maxFontSize = 30;
const fontSizeStep = 2; // Step for adjusting font size

function adjustFontSize(element, change) {
    let currentSize = parseFloat(getComputedStyle(element).fontSize);
    let newLineHeight = parseFloat(getComputedStyle(element).lineHeight); // Get current line height

    // If line-height is 'normal', calculate based on current font size or a default ratio
    if (getComputedStyle(element).lineHeight === 'normal' || newLineHeight === 0) {
        newLineHeight = currentSize * 1.5; // Default ratio 1.5 for proportional adjustment
    }

    let newSize = currentSize + change;
    
    newSize = Math.max(minFontSize, Math.min(maxFontSize, newSize));

    // Adjust line height proportionally
    let lineHeightRatio = newLineHeight / currentSize; // Calculate current ratio
    newLineHeight = newSize * lineHeightRatio; // Apply ratio to new font size

    element.style.fontSize = `${newSize}px`;
    element.style.lineHeight = `${newLineHeight}px`;
}

// Event listener for font size buttons
document.addEventListener('click', (e) => {
    const button = e.target.closest('.font-size-button');
    if (button) {
        const targetId = button.dataset.target;
        const action = button.dataset.action;
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            if (action === 'increase') {
                adjustFontSize(targetElement, fontSizeStep);
            } else if (action === 'decrease') {
                adjustFontSize(targetElement, -fontSizeStep);
            }
        }
    }
});

// Event listener for mouse scroll wheel + Ctrl key
document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        const targetElements = [
            document.getElementById('largeMessageInputTextArea'),
            document.getElementById('memoDetailsContent'), // The div that holds content in details modal
            document.getElementById('editMemoContentInput') // The textarea in edit modal
        ];

        let target = null;
        // Check if the event target or its parent is one of the desired text areas
        for (const el of targetElements) {
            if (el && (el.contains(e.target) || el === e.target)) {
                target = el;
                break;
            }
        }

        if (target) {
            e.preventDefault(); // Prevent page zooming
            if (e.deltaY < 0) { // Scroll up (zoom in)
                adjustFontSize(target, fontSizeStep);
            } else { // Scroll down (zoom out)
                adjustFontSize(target, -fontSizeStep);
            }
        }
    }
}, { passive: false }); // Use passive: false to allow preventDefault


// --- Utility Functions ---

function getRandomMemoBgClass() { return memoBgColors[Math.floor(Math.random() * memoBgColors.length)]; }

function getImportanceBorderClass(importance) { 
    return importanceLevels[importance] ? importanceLevels[importance].borderColorClass : '';
}
function getImportanceLightClass(importance) {
    return importanceLevels[importance] ? importanceLevels[importance].lightClass : '';
}
function getImportanceLabel(importance) {
    return importanceLevels[importance] ? importanceLevels[importance].label : '';
}

function showNotification(messageText, type = 'success') { // Added type for different notification styles
    const notification = document.createElement('div'); 
    notification.className = 'floating-notification'; 
    if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'; // Red gradient for error
        notification.style.boxShadow = '0 10px 25px rgba(239, 68, 68, 0.4)';
    } else if (type === 'info') {
        notification.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'; // Blue gradient for info
        notification.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.4)';
    }
    notification.textContent = messageText; 
    document.body.appendChild(notification); 
    setTimeout(() => { 
        notification.classList.add('hide'); 
        setTimeout(() => notification.remove(), 400); 
    }, 2000); 
}

function showInputModal(title, placeholder, initialValue, maxLength, onSave, onCancel) { 
    const overlay = document.createElement('div'); 
    overlay.className = 'modal-overlay fixed inset-0 flex items-center justify-center z-50'; 
    const modal = document.createElement('div'); 
    modal.className = 'modal-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-3xl p-8 max-w-md w-full mx-4'; 
    modal.innerHTML = `<div class="text-center mb-6"><div class="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center"><span class="text-2xl">📝</span></div><h3 class="text-xl font-semibold text-gray-800 mb-2">${title}</h3><p class="text-gray-600 text-sm mb-4">Enter a name for your item</p><input type="text" id="modalInput" class="input-field w-full p-3 rounded-xl focus:outline-none" placeholder="${placeholder}" maxlength="${maxLength}"/><p class="text-xs text-gray-500 mt-2">Max ${maxLength} characters</p></div><div class="flex space-x-3"><button class="cancel-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Cancel</button><button class="primary-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Save</button></div>`; 
    overlay.appendChild(modal); 
    document.body.appendChild(overlay); 
    const inputField = modal.querySelector('#modalInput'); 
    const saveBtn = modal.querySelector('.primary-button'); 
    const cancelBtn = modal.querySelector('.cancel-button'); 
    inputField.value = initialValue; 
    inputField.focus(); 
    inputField.select(); 
    saveBtn.addEventListener('click', () => { 
        const value = inputField.value.trim(); 
        if (value) { 
            onSave(value); 
            overlay.remove(); 
        } else { 
            inputField.focus(); 
            inputField.style.borderColor = '#ef4444'; 
            setTimeout(() => inputField.style.borderColor = '', 2000); 
        } 
    }); 
    cancelBtn.addEventListener('click', () => { onCancel(); overlay.remove(); }); 
    inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveBtn.click(); }); 
}

function showEditMemoModal(memoData, onSave, onCancel) { 
    const overlay = document.createElement('div'); 
    overlay.className = 'modal-overlay fixed inset-0 flex items-center justify-center z-[100]'; 
    const modal = document.createElement('div'); 
    modal.className = 'modal-content edit-memo-modal-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 sm:p-8 shadow-2xl'; 
    
    let selectedBgColorClass = memoData.bgColorClass; 
    let currentEditImportance = memoData.importance; 

    const colorSwatchesHtml = memoBgColors.map(colorClass => `
        <div class="color-swatch ${colorClass} ${selectedBgColorClass === colorClass ? 'selected' : ''}" data-color-class="${colorClass}"></div>
    `).join('');

    const importanceButtonsHtml = Object.keys(importanceLevels).map(key => `
        <button class="importance-button ${currentEditImportance === key ? 'selected' : ''}" data-importance="${key}">
            <span class="importance-light ${importanceLevels[key].lightClass}"></span>
            ${importanceLevels[key].label}
        </button>
    `).join('');

    modal.innerHTML = `
        <div>
            <h3 class="text-3xl font-semibold text-gray-800 mb-6 text-center">Edit Memo</h3>
            <div class="mb-4">
                <label for="editMemoNameInput" class="block text-sm font-medium text-gray-700 mb-1">Name:</label>
                <input type="text" id="editMemoNameInput" class="input-field w-full p-3 rounded-xl focus:outline-none text-base" value="${memoData.name}" maxlength="50">
            </div>
            <div class="mb-4 relative">
                <label for="editMemoContentInput" class="block text-sm font-medium text-gray-700 mb-1">Content:</label>
                <textarea id="editMemoContentInput" class="input-field w-full p-3 rounded-xl focus:outline-none resize-y text-base" rows="8">${memoData.content}</textarea>
                <div class="font-size-controls">
                    <button class="font-size-button" data-target="editMemoContentInput" data-action="decrease">-</button>
                    <button class="font-size-button" data-target="editMemoContentInput" data-action="increase">+</button>
                </div>
            </div>
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Importance Level:</label>
                <div id="editImportanceButtonsContainer" class="flex flex-wrap gap-2 justify-center">
                    ${importanceButtonsHtml}
                </div>
            </div>
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Memo Color:</label>
                <div id="colorSwatchesContainer" class="flex flex-wrap gap-3 justify-center">
                    ${colorSwatchesHtml}
                </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
                <button id="editModalCancelButton" class="cancel-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Cancel</button>
                <button id="editModalSaveButton" class="save-edit-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Save Changes</button>
            </div>
        </div>
    `; 
    overlay.appendChild(modal); 
    document.body.appendChild(overlay); 
    document.body.style.overflow = 'hidden'; 
    
    const nameInput = modal.querySelector('#editMemoNameInput'); 
    const contentInput = modal.querySelector('#editMemoContentInput'); 
    const editImportanceButtonsContainer = modal.querySelector('#editImportanceButtonsContainer');
    const colorSwatchesContainer = modal.querySelector('#colorSwatchesContainer');
    const saveBtn = modal.querySelector('#editModalSaveButton'); 
    const cancelBtn = modal.querySelector('#editModalCancelButton'); 
    
    editImportanceButtonsContainer.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.importance-button');
        if (clickedButton) {
            editImportanceButtonsContainer.querySelectorAll('.importance-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            clickedButton.classList.add('selected');
            currentEditImportance = clickedButton.dataset.importance;
        }
    });

    colorSwatchesContainer.addEventListener('click', (e) => {
        const clickedSwatch = e.target.closest('.color-swatch');
        if (clickedSwatch) {
            colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(swatch => {
                swatch.classList.remove('selected');
            });
            clickedSwatch.classList.add('selected');
            selectedBgColorClass = clickedSwatch.dataset.colorClass; 
        }
    });

    saveBtn.addEventListener('click', () => { 
        const newName = nameInput.value.trim(); 
        const newContent = contentInput.value; 
        const newBgColorClass = selectedBgColorClass; 
        const newImportance = currentEditImportance;

        if (newName && newContent.trim() && newImportance) { 
            onSave({ name: newName, content: newContent, importance: newImportance, bgColorClass: newBgColorClass }); 
            document.body.style.overflow = ''; 
            overlay.remove(); 
        } else { 
            showNotification('Name, content, and importance cannot be empty.', 'error'); 
        } 
    }); 
    const closeModal = () => { document.body.style.overflow = ''; overlay.remove(); onCancel(); }; 
    cancelBtn.addEventListener('click', closeModal); 
    nameInput.focus(); 
}
function showDeleteConfirmationModal(itemType, itemName, onDeleteConfirm) { 
    const overlay = document.createElement('div'); 
    overlay.className = 'modal-overlay fixed inset-0 flex items-center justify-center z-50'; 
    const modal = document.createElement('div'); 
    modal.className = 'modal-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-3xl p-8 max-w-sm w-full mx-4 text-center'; 
    modal.innerHTML = `<div class="mb-6"><div class="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center"><span class="text-2xl">🗑️</span></div><h3 class="text-xl font-semibold text-gray-800 mb-2">Delete ${itemType}</h3><p class="text-gray-600">Are you sure you want to delete "${itemName}"? This action cannot be undone.</p></div><div class="flex space-x-3"><button class="cancel-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Cancel</button><button class="delete-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Delete</button></div>`; 
    overlay.appendChild(modal); 
    document.body.appendChild(overlay); 
    const deleteButton = modal.querySelector('.delete-button'); 
    const cancelButton = modal.querySelector('.cancel-button'); 
    deleteButton.addEventListener('click', () => { onDeleteConfirm(); overlay.remove(); showNotification(`${itemType} deleted successfully!`); }); 
    cancelButton.addEventListener('click', () => overlay.remove()); 
}
async function copyToClipboard(text, sourceElement) { 
    if (sourceElement.dataset.isEditing === 'true') { 
        showNotification('Cannot copy while editing.', 'info');
        return;
    }

    try {
        if (navigator.clipboard && window.isSecureContext) { 
            await navigator.clipboard.writeText(text);
            showNotification('Memo content copied! 📋');
        } else { 
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showNotification('Memo content copied! 📋');
            } finally {
                document.body.removeChild(textarea);
            }
        }
    } catch (err) {
        console.error('Failed to copy:', err);
        debugMessage.textContent = 'Copy failed. Ensure page is HTTPS or try another browser.';
        debugMessage.classList.remove('hidden');
        setTimeout(() => { debugMessage.classList.add('hidden'); }, 3000);
    }
}

function showMemoDetailsModal(memoData, pageName, memoIndex) { // MODIFIED
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay fixed inset-0 flex items-center justify-center z-[100]';
    const modal = document.createElement('div');
    modal.className = 'modal-content memo-details-modal-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 sm:p-8 shadow-2xl';
    
    const date = new Date(memoData.timestamp);
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const displayTimestamp = `${formattedDate} ${formattedTime}`;

    const originalContent = memoData.content; 

    const nameParts = memoData.name.split(' - ', 2);
    const baseName = nameParts[0] || memoData.name;
    const dateAndWeekPart = nameParts[1] ? `<br>${nameParts[1]}` : '';

    modal.innerHTML = `
        <div>
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-3xl font-semibold text-gray-800">${baseName}${dateAndWeekPart}</h3>
                <button id="closeDetailsModalButton" class="text-gray-500 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div class="mb-4 flex items-center gap-4">
                <div class="modal-importance-display">
                    <div class="importance-light ${getImportanceLightClass(memoData.importance)}"></div>
                    <span>Importance: ${getImportanceLabel(memoData.importance)}</span>
                </div>
                <input type="text" id="detailsSearchInput" class="input-field flex-1 p-2 rounded-xl focus:outline-none text-sm" placeholder="Search within memo content...">
            </div>
            <div class="mb-6 relative">
                <label for="memoDetailsContent" class="block text-sm font-medium text-gray-700 mb-1">Content:</label>
                <div id="memoDetailsContent" class="memo-details-content-area text-base text-gray-700 p-3 rounded-xl bg-gray-50 border border-gray-200 ${getImportanceBorderClass(memoData.importance)}">
                    </div>
                <div class="font-size-controls">
                    <button class="font-size-button" data-target="memoDetailsContent" data-action="decrease">-</button>
                    <button class="font-size-button" data-target="memoDetailsContent" data-action="increase">+</button>
                </div>
            </div>
            <p class="text-xs text-gray-500 text-right">${displayTimestamp}</p>
            <div class="flex flex-col sm:flex-row gap-3 mt-6">
                <button id="detailsModalCopyButton" class="copy-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Copy</button>
                <button id="detailsModalEditButton" class="edit-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Edit</button>
                <button id="detailsModalDeleteButton" class="delete-button action-button flex-1 text-white px-4 py-3 rounded-xl font-medium">Delete</button>
            </div>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const detailsContentDiv = modal.querySelector('#memoDetailsContent');
    const detailsSearchInput = modal.querySelector('#detailsSearchInput');

    const renderContentWithHighlight = (content, searchTerm) => {
        if (!searchTerm) {
            detailsContentDiv.textContent = content;
            return;
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const regex = new RegExp(`(${lowerCaseSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        detailsContentDiv.innerHTML = content.replace(regex, '<mark class="bg-yellow-200 rounded">$1</mark>');

        const firstHighlight = detailsContentDiv.querySelector('mark');
        if (firstHighlight) {
            firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    renderContentWithHighlight(originalContent, '');

    detailsSearchInput.addEventListener('input', (e) => {
        renderContentWithHighlight(originalContent, e.target.value);
    });
    detailsSearchInput.focus(); 

    document.body.style.overflow = 'hidden'; 

    const closeBtn = modal.querySelector('#closeDetailsModalButton');
    const copyBtn = modal.querySelector('#detailsModalCopyButton');
    const editBtn = modal.querySelector('#detailsModalEditButton');
    const deleteBtn = modal.querySelector('#detailsModalDeleteButton');

    const closeModal = () => {
        document.body.style.overflow = ''; 
        overlay.remove();
    };

    closeBtn.addEventListener('click', closeModal);

    copyBtn.addEventListener('click', () => {
        copyToClipboard(memoData.content, modal); 
    });

    editBtn.addEventListener('click', () => {
        closeModal(); 
        const memoElement = document.querySelector(`.memo-note[data-memo-id="${pageName}-${memoIndex}"]`); // MODIFIED
        if (memoElement) {
            editMemo(pageName, memoIndex, memoElement); // MODIFIED
        } else {
             // If the element isn't in the DOM (e.g., due to filtering), create a dummy object
             // for the isEditing flag to prevent errors, and proceed with the edit logic.
            const dummyElement = { dataset: {} };
            editMemo(pageName, memoIndex, dummyElement);
            showNotification('Editing memo. The list may not update until the filter is cleared.', 'info');
        }
    });

    deleteBtn.addEventListener('click', () => {
        closeModal(); 
        showDeleteConfirmationModal('Memo', memoData.name, () => deleteMemo(pageName, memoIndex)); // MODIFIED
    });
}

// --- Data Persistence (Firebase Realtime Database) ---

function loadDataFromFirebase(data) {
    pages = data.pages || { 'default': [] };
    pageOrder = data.pageOrder || ['default'];
    currentPage = data.currentPage || 'default';

    // BUG FIX: Ensure every page in pageOrder has an entry in the pages object.
    // This prevents pages with no memos from disappearing on load from Firebase,
    // because Firebase doesn't store empty arrays/objects.
    if (pageOrder) {
        pageOrder.forEach(pName => {
            if (!pages[pName]) {
                pages[pName] = [];
            }
        });
    }
}

function resetLocalState() {
    pages = {};
    pageOrder = [];
    currentPage = 'default';
}

function initializeDefaultData() {
    pages = { 'default': [] };
    pageOrder = ['default'];
    currentPage = 'default';
    saveAllData();
}

function saveAllData() { 
    if (dbRef) {
        dbRef.set({
            pages: pages,
            pageOrder: pageOrder,
            currentPage: currentPage
        });
    }
}

// --- Page Management Functions ---

function addPage(pageName) { 
    if (pages[pageName]) { 
        showNotification(`Page "${pageName}" already exists!`, 'info'); 
        return; 
    } 
    pages[pageName] = []; 
    if(!pageOrder.includes(pageName)) pageOrder.push(pageName); 
    currentPage = pageName; 
    saveAllData(); 
    // updateUI(); // Not needed here, Firebase on() listener will trigger it
    showNotification(`Page "${pageName}" created! 🎉`); 
}
function switchPage(pageName) { 
    if (currentPage === pageName) return; 
    currentPage = pageName; 
    saveAllData(); 
    // updateUI(); // Not needed here, Firebase on() listener will trigger it
    showNotification(`Switched to page: "${pageName}"`, 'info'); 
}
function editPageName(oldPageName) { 
    showInputModal('Edit Page Name', 'Enter new page name...', oldPageName, 20, 
        (newPageName) => { 
            if (newPageName === oldPageName) { 
                showNotification('Page name not changed.', 'info'); 
                return; 
            } 
            if (Object.keys(pages).some(p => p.toLowerCase() === newPageName.toLowerCase())) { 
                showNotification(`Page "${newPageName}" already exists!`, 'error'); 
                return; 
            } 
            const pageMessages = pages[oldPageName]; 
            delete pages[oldPageName]; 
            pages[newPageName] = pageMessages; 
            const oldIndex = pageOrder.indexOf(oldPageName); 
            if(oldIndex > -1) pageOrder.splice(oldIndex, 1, newPageName); 
            else pageOrder.push(newPageName); 
            if (currentPage === oldPageName) currentPage = newPageName; 
            saveAllData(); 
            // updateUI(); // Not needed here, Firebase on() listener will trigger it
            showNotification(`Page "${oldPageName}" renamed to "${newPageName}"!`); 
        }, 
        () => {} 
    ); 
}
function deletePage(pageName) { 
    showDeleteConfirmationModal('Page', pageName, () => { 
        delete pages[pageName]; 
        pageOrder = pageOrder.filter(p => p !== pageName); 
        if (pageOrder.length === 0) { 
            pages['default'] = []; 
            pageOrder.push('default'); 
        } 
        if (currentPage === pageName) currentPage = pageOrder[0] || 'default'; 
        saveAllData(); 
        // updateUI(); // Not needed here, Firebase on() listener will trigger it
    }); 
}

function renderPages() { 
    pagesContainer.innerHTML = ''; 
    if (!pageOrder) return;
    pageOrder.forEach(pageName => { 
        // This check is now safe because loadDataFromFirebase ensures pages[pageName] exists.
        if (!pages[pageName]) return; 
        const pageButton = document.createElement('button'); 
        pageButton.className = `action-button px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${currentPage === pageName ? 'primary-button text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`; 
        pageButton.textContent = pageName; 
        pageButton.dataset.pageName = pageName; 
        pageButton.setAttribute('draggable', 'true'); 

        pageButton.addEventListener('click', () => switchPage(pageName)); 
        pageButton.addEventListener('contextmenu', (e) => { e.preventDefault(); showPageContextMenu(e.clientX, e.clientY, pageName); }); 
        
        pageButton.addEventListener('dragstart', handlePageDragStart);
        pageButton.addEventListener('dragover', handlePageDragOver);
        pageButton.addEventListener('dragleave', handlePageDragLeave);
        pageButton.addEventListener('drop', handlePageDrop);
        pageButton.addEventListener('dragend', handlePageDragEnd);

        pagesContainer.appendChild(pageButton); 
    }); 
}
function showPageContextMenu(x, y, pageName) { 
    const existingMenu = document.getElementById('pageContextMenu'); 
    if (existingMenu) existingMenu.remove(); 
    const menu = document.createElement('div'); 
    menu.id = 'pageContextMenu'; 
    menu.className = 'absolute bg-white rounded-lg shadow-lg py-2 z-50 text-sm'; 
    menu.style.left = `${x}px`; 
    menu.style.top = `${y}px`; 
    menu.style.minWidth = '120px'; 
    const editItem = document.createElement('button'); 
    editItem.className = 'block w-full text-left px-4 py-2 hover:bg-gray-100'; 
    editItem.textContent = 'Edit Name'; 
    editItem.addEventListener('click', () => { editPageName(pageName); menu.remove(); }); 
    const deleteItem = document.createElement('button'); 
    deleteItem.className = 'block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50'; 
    deleteItem.textContent = 'Delete Page'; 
    deleteItem.addEventListener('click', () => { deletePage(pageName); menu.remove(); }); 
    menu.appendChild(editItem); 
    if (pageOrder.length > 1) menu.appendChild(deleteItem); 
    document.body.appendChild(menu); 
    const closeMenu = (event) => { 
            menu.remove(); 
            document.removeEventListener('click', closeMenu); 
            document.removeEventListener('contextmenu', closeMenu); 
    }; 
    setTimeout(() => { 
        document.addEventListener('click', closeMenu); 
        document.removeEventListener('contextmenu', closeMenu); 
    }, 0); 
}

// --- Memo Drag and Drop Handlers ---
function handleDragStart(event) {
    if (currentFilter !== 'all') {
        event.preventDefault(); 
        showNotification('Drag and drop is disabled when a filter is active.', 'info');
        return;
    }

    draggedMemoElement = event.target;
    draggedMemoIndex = parseInt(draggedMemoElement.dataset.index);
    draggedMemoElement.classList.add('dragging'); 
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedMemoIndex); 
}

function handleDragOver(event) {
    if (currentFilter !== 'all') {
        return;
    }
    event.preventDefault(); 
    const targetMemo = event.target.closest('.memo-note');

    if (draggedOverTargetElement && draggedOverTargetElement !== targetMemo) {
        draggedOverTargetElement.classList.remove('drag-target-glow');
        draggedOverTargetElement = null;
    }

    if (targetMemo && targetMemo !== draggedMemoElement) {
        targetMemo.classList.add('drag-target-glow');
        draggedOverTargetElement = targetMemo;
    } else if (!targetMemo && (event.target.id === 'memoDisplayArea' || event.target.closest('#memoDisplayArea'))) {
        if (draggedOverTargetElement) {
            draggedOverTargetElement.classList.remove('drag-target-glow');
            draggedOverTargetElement = null;
        }
    }
}

function handleDragLeave(event) {
    if (currentFilter !== 'all') {
        return;
    }
    if (draggedOverTargetElement) {
        draggedOverTargetElement.classList.remove('drag-target-glow');
        draggedOverTargetElement = null;
    }
}

function handleDrop(event) {
    event.preventDefault();
    if (currentFilter !== 'all') {
        return;
    }
    
    if (draggedOverTargetElement) {
        draggedOverTargetElement.classList.remove('drag-target-glow');
        draggedOverTargetElement = null;
    }

    if (draggedMemoIndex === null) {
        if(draggedMemoElement) draggedMemoElement.classList.remove('dragging');
        draggedMemoIndex = null;
        draggedMemoElement = null;
        return;
    }

    const memosInPage = pages[currentPage];
    if (!memosInPage) return; // Safety check
    const memoToMove = memosInPage.splice(draggedMemoIndex, 1)[0]; 
    
    const targetMemo = event.target.closest('.memo-note');
    let newIndex;

    if (targetMemo && targetMemo !== draggedMemoElement) {
        const allMemos = Array.from(memoDisplayArea.querySelectorAll('.memo-note'));
        const targetIndexInDisplayed = allMemos.indexOf(targetMemo);
        
        // Convert displayed index back to original index in the source array
        const targetDatasetIndex = parseInt(targetMemo.dataset.index);

        const rect = targetMemo.getBoundingClientRect();
        const isAfter = event.clientX > rect.left + rect.width / 2;
        
        newIndex = targetDatasetIndex;
        if (isAfter) {
            newIndex = targetDatasetIndex + 1;
        }
        
        if (draggedMemoIndex < newIndex) {
            newIndex--; 
        }

    } else {
        newIndex = memosInPage.length; 
    }
    
    memosInPage.splice(newIndex, 0, memoToMove);
    
    saveAllData();
    // updateMemoList(); // Not needed, handled by Firebase listener
    
    if(draggedMemoElement) draggedMemoElement.classList.remove('dragging');
    draggedMemoIndex = null;
    draggedMemoElement = null;
}

function handleDragEnd(event) {
    if (currentFilter !== 'all') {
        if(draggedMemoElement) draggedMemoElement.classList.remove('dragging');
        if(draggedOverTargetElement) draggedOverTargetElement.classList.remove('drag-target-glow');
        draggedMemoIndex = null;
        draggedMemoElement = null;
        draggedOverTargetElement = null;
        return;
    }

    if(draggedMemoElement) draggedMemoElement.classList.remove('dragging');
    if(draggedOverTargetElement) draggedOverTargetElement.classList.remove('drag-target-glow');
    draggedMemoIndex = null;
    draggedMemoElement = null;
    draggedOverTargetElement = null;
}


// --- Memo List Management ---

function updateMemoList() {
    memoDisplayArea.innerHTML = ''; 
    let currentMemosSource = pages[currentPage] || [];
    // Firebase returns objects, not arrays for lists. Convert to array if needed.
    if (currentMemosSource && !Array.isArray(currentMemosSource)) {
        currentMemosSource = Object.values(currentMemosSource);
    }

    let displayedMemos = currentMemosSource;

    if (currentFilter !== 'all') {
        displayedMemos = currentMemosSource.filter(memo => memo && memo.importance === currentFilter);
    }

    const isDraggable = currentFilter === 'all';

    displayedMemos.forEach((memoObj) => { 
        if (!memoObj) return; // Skip if memo object is null/undefined

        const originalIndex = currentMemosSource.indexOf(memoObj); 

        const memoContainer = document.createElement('div');
        memoContainer.dataset.isEditing = 'false'; 
        memoContainer.dataset.index = originalIndex; 
        memoContainer.dataset.memoId = `${currentPage}-${originalIndex}`; 
        
        memoContainer.setAttribute('draggable', isDraggable);
        if (!isDraggable) {
            memoContainer.classList.add('cursor-not-allowed');
        } else {
            memoContainer.classList.remove('cursor-not-allowed');
        }

        memoContainer.className = `memo-note relative p-4 rounded-xl shadow-md ${memoObj.bgColorClass} ${getImportanceBorderClass(memoObj.importance)}`;
        
        if (isDraggable) { 
            memoContainer.addEventListener('dragstart', handleDragStart);
            memoContainer.addEventListener('dragover', handleDragOver); 
            memoContainer.addEventListener('dragleave', handleDragLeave); 
            memoContainer.addEventListener('drop', handleDrop);      
            memoContainer.addEventListener('dragend', handleDragEnd);
        }

        memoContainer.addEventListener('click', (e) => { 
            if (!e.target.closest('.memo-actions button') && memoContainer.dataset.isEditing === 'false' && !memoContainer.classList.contains('dragging')) { 
                showMemoDetailsModal(memoObj, currentPage, originalIndex); // MODIFIED
            } 
        });

        const nameParts = memoObj.name.split(' - ', 2);
        const baseName = nameParts[0] || memoObj.name;
        const dateAndWeekPart = nameParts[1] ? `<br>${nameParts[1]}` : '';

        const headerDiv = document.createElement('div'); 
        headerDiv.className = "flex justify-between items-start mb-1"; 
        headerDiv.innerHTML = `<div class="font-semibold text-gray-800 text-sm truncate pr-16 pointer-events-none">${baseName}${dateAndWeekPart}</div>`; 
        memoContainer.appendChild(headerDiv);

        const contentArea = document.createElement('div'); 
        contentArea.className = "flex-grow overflow-hidden mb-1 pointer-events-none"; 
        const contentText = document.createElement('div'); 
        contentText.className = 'memo-content-text text-sm text-gray-700 h-full'; 
        const lines = memoObj.content.split('\n');
        if (lines.length > MAX_MEMO_LINES) { 
            const lastVisibleLine = lines[MAX_MEMO_LINES -1]; 
            contentText.textContent = lines.slice(0, MAX_MEMO_LINES-1).join('\n') + '\n' + lastVisibleLine + ' ...'; 
        } else { 
            contentText.textContent = memoObj.content.trim(); 
        }
        contentArea.appendChild(contentText); 
        memoContainer.appendChild(contentArea);
        
        const timestampDiv = document.createElement('div'); 
        timestampDiv.className = 'memo-timestamp pointer-events-none'; 
        const date = new Date(memoObj.timestamp); 
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`; 
        const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); 
        timestampDiv.textContent = `${formattedDate} ${formattedTime}`; 
        memoContainer.appendChild(timestampDiv);
        
        const importanceDisplayDiv = document.createElement('div');
        importanceDisplayDiv.className = 'importance-display';
        importanceDisplayDiv.innerHTML = `
            <div class="importance-light ${getImportanceLightClass(memoObj.importance)}"></div>
            <span>${getImportanceLabel(memoObj.importance)}</span>
        `;
        memoContainer.appendChild(importanceDisplayDiv);

        const actionsDiv = document.createElement('div'); 
        actionsDiv.className = 'memo-actions'; 
        actionsDiv.innerHTML = `
            <button class="copy-button action-button text-white px-2 py-1 rounded-lg font-medium text-xs">Copy</button>
            <button class="edit-button action-button text-white px-2 py-1 rounded-lg font-medium text-xs">Edit</button>
            <button class="delete-button action-button text-white px-2 py-1 rounded-lg font-medium text-xs">Del</button>
        `; 
        memoContainer.appendChild(actionsDiv);

        actionsDiv.querySelector('.copy-button').addEventListener('click', (e) => { 
            e.stopPropagation(); 
            copyToClipboard(memoObj.content, memoContainer); 
        });
        actionsDiv.querySelector('.edit-button').addEventListener('click', (e) => { e.stopPropagation(); editMemo(currentPage, originalIndex, memoContainer); }); // MODIFIED
        actionsDiv.querySelector('.delete-button').addEventListener('click', (e) => { e.stopPropagation(); showDeleteConfirmationModal('Memo', memoObj.name, () => deleteMemo(currentPage, originalIndex)); }); // MODIFIED
        
        memoDisplayArea.appendChild(memoContainer);
    });
    
    if (isDraggable) { 
        memoDisplayArea.addEventListener('dragover', handleDragOver); 
        memoDisplayArea.addEventListener('dragleave', handleDragLeave); 
        memoDisplayArea.addEventListener('drop', handleDrop); 
    } else { 
        memoDisplayArea.removeEventListener('dragover', handleDragOver);
        memoDisplayArea.removeEventListener('dragleave', handleDragLeave);
        memoDisplayArea.removeEventListener('drop', handleDrop);
    }

    messageCount.textContent = `${displayedMemos.length}/${maxMemos} memos`; 
    updateSaveButtonState();
}

function editMemo(pageName, index, memoElement) { // MODIFIED
    memoElement.dataset.isEditing = 'true'; 
    const currentMemo = pages[pageName] && pages[pageName][index]; 

    if (!currentMemo) {
        showNotification('Could not find the memo to edit. It might have been moved or deleted.', 'error');
        memoElement.dataset.isEditing = 'false'; 
        return;
    }

    showEditMemoModal(currentMemo, 
        (updatedData) => { 
            // Re-check existence in case of race conditions
            if (pages[pageName] && pages[pageName][index]) {
                pages[pageName][index] = { 
                    ...currentMemo, 
                    name: updatedData.name, 
                    content: updatedData.content, 
                    importance: updatedData.importance, 
                    bgColorClass: updatedData.bgColorClass, 
                    timestamp: Date.now(), 
                }; 
                saveAllData(); 
                showNotification('Memo updated! ✨'); 
            } else {
                showNotification('Failed to save. The original memo could not be found.', 'error');
            }
            memoElement.dataset.isEditing = 'false'; 
        }, 
        () => { 
            memoElement.dataset.isEditing = 'false'; 
        }
    ); 
}
function deleteMemo(pageName, index) { // MODIFIED
    if (pages[pageName]) {
        pages[pageName].splice(index, 1); 
    }
    saveAllData(); 
    // updateMemoList() is not needed, handled by Firebase listener
}

// --- Date and Week Calculation Helpers ---

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function getWeekdayAbbreviation(date) {
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return weekdays[date.getDay()];
}

function parseDateString(dateString) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; 
        const year = parseInt(parts[2], 10);
        if (year > 0 && month >= 0 && month < 12 && day > 0 && day <= 31) {
            const date = new Date(year, month, day);
            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                return date;
            }
        }
    }
    return null; 
}

function getFinancialYearStartDate(year) {
    let may1 = new Date(year, 4, 1); 
    let dayOfWeek = may1.getDay(); 
    let daysToAdd = (7 - dayOfWeek) % 7; 
    may1.setDate(may1.getDate() + daysToAdd);
    may1.setHours(0, 0, 0, 0); 
    return may1;
}

function calculateFinancialWeek(date) {
    const currentCalYear = date.getFullYear();
    const fyStartCurrentCalYear = getFinancialYearStartDate(currentCalYear);
    const fyStartPrevCalYear = getFinancialYearStartDate(currentCalYear - 1);

    let actualFYStart; 
    let actualFYLabel; 
    let nextFYStartForActualFY; 
    if (date < fyStartCurrentCalYear) { 
        actualFYStart = fyStartPrevCalYear;
        actualFYLabel = currentCalYear - 1;
        nextFYStartForActualFY = fyStartCurrentCalYear;
    } else { 
        actualFYStart = fyStartCurrentCalYear;
        actualFYLabel = currentCalYear;
        nextFYStartForActualFY = getFinancialYearStartDate(currentCalYear + 1);
    }

    const daysInActualFY = Math.floor((nextFYStartForActualFY - actualFYStart) / (1000 * 60 * 60 * 24));
    const is53WeekYear = (daysInActualFY === 371); 

    const diffDaysFromActualFYStart = Math.floor((date - actualFYStart) / (1000 * 60 * 60 * 24));
    let weekNumber = Math.floor(diffDaysFromActualFYStart / 7) + 1;

    if (is53WeekYear && weekNumber > 53) {
        weekNumber = 53; 
    } else if (!is53WeekYear && weekNumber > 52) {
        weekNumber = 52; 
    }
    if (weekNumber <=0) weekNumber = 1; 

    const startYearShort = String(actualFYLabel).slice(-2);
    const endYearShort = String(actualFYLabel + 1).slice(-2);
    return `WK${weekNumber} (${startYearShort}-${endYearShort})`;
}

function updateDateAndWeekInputs() {
    const today = new Date();
    if (flatpickrInstance) {
        flatpickrInstance.setDate(today, true); 
    } else {
        memoDateInput.value = formatDate(today);
        updateMemoWeekBasedOnDateInput();
    }
}

function updateMemoWeekBasedOnDateInput() {
    const dateString = memoDateInput.value.trim();
    const parsedDate = parseDateString(dateString);
    if (parsedDate) {
        memoWeekInput.value = calculateFinancialWeek(parsedDate);
    } else {
        memoWeekInput.value = ''; 
    }
}

// --- Input Handling and Saving ---

function updateSaveButtonState() { 
    const messageLength = messageInput.value.trim().length; 
    const nameLength = memoNameInput.value.trim().length; 
    const dateLength = memoDateInput.value.trim().length; 
    const weekLength = memoWeekInput.value.trim().length; 
    const currentMemos = pages[currentPage] || [];
    const totalMemosOnPage = Array.isArray(currentMemos) ? currentMemos.length : 0;
    saveButton.disabled = messageLength === 0 || nameLength === 0 || dateLength === 0 || weekLength === 0 || totalMemosOnPage >= maxMemos || selectedImportance === null; 
}

importanceButtonsContainer.addEventListener('click', (e) => {
    const clickedButton = e.target.closest('.importance-button');
    if (clickedButton) {
        importanceButtonsContainer.querySelectorAll('.importance-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        clickedButton.classList.add('selected');
        selectedImportance = clickedButton.dataset.importance; 
        updateSaveButtonState(); 
    }
});

messageInput.addEventListener('input', () => { 
    charCount.textContent = `${messageInput.value.length} characters`; 
    updateSaveButtonState(); 
});
memoNameInput.addEventListener('input', updateSaveButtonState);

memoDateInput.addEventListener('input', () => {
    updateMemoWeekBasedOnDateInput(); 
    updateSaveButtonState();
}); 
memoWeekInput.addEventListener('input', updateSaveButtonState); 

saveButton.addEventListener('click', () => { 
    const message = messageInput.value.trim(); 
    const memoNameBase = memoNameInput.value.trim(); 
    const memoDateString = memoDateInput.value.trim(); 
    const memoWeekString = memoWeekInput.value.trim(); 
    const importance = selectedImportance; 
    let currentMemos = pages[currentPage] || []; 
    if (!Array.isArray(currentMemos)) currentMemos = [];


    const parsedDateForWeekday = parseDateString(memoDateString);
    const weekdayAbbr = parsedDateForWeekday ? getWeekdayAbbreviation(parsedDateForWeekday) : '';

    const fullMemoName = `${memoNameBase} - ${memoDateString} ${weekdayAbbr} | ${memoWeekString}`;

    if (memoNameBase && memoDateString && memoWeekString && message && importance && currentMemos.length < maxMemos) { 
        const memoObj = { 
            name: fullMemoName, 
            content: messageInput.value, 
            importance, 
            timestamp: Date.now(), 
            bgColorClass: getRandomMemoBgClass() 
        }; 
        if (!Array.isArray(pages[currentPage])) {
             pages[currentPage] = [];
        }
        pages[currentPage].unshift(memoObj); 
        saveAllData(); 
        
        messageInput.value = ''; 
        memoNameInput.value = ''; 
        charCount.textContent = `0 characters`; 
        selectedImportance = null;
        importanceButtonsContainer.querySelectorAll('.importance-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        updateDateAndWeekInputs(); 
        // updateUI will be called automatically by the firebase 'on' listener
        showNotification('Memo saved! ✨'); 
    } else if (currentMemos.length >= maxMemos) { 
        showNotification('Maximum memo limit reached for this page.', 'error'); 
    } else if (!memoNameBase) { 
        showNotification('Memo name cannot be empty.', 'error'); memoNameInput.focus(); 
    } else if (!memoDateString) { 
        showNotification('Memo date cannot be empty.', 'error'); memoDateInput.focus(); 
    } else if (!memoWeekString) { 
        showNotification('Memo week cannot be empty.', 'error'); memoWeekInput.focus(); 
    } else if (!message) { 
        showNotification('Message content cannot be empty.', 'error'); messageInput.focus(); 
    } else if (!importance) { 
        showNotification('Please select an importance level.', 'error'); 
    } 
});
addPageButton.addEventListener('click', () => { 
    const newPageName = newPageNameInput.value.trim(); 
    if (newPageName) { 
        addPage(newPageName); 
        newPageNameInput.value = ''; 
    } else { 
        showNotification('Page name cannot be empty.', 'error'); 
    } 
});
newPageNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPageButton.click(); });

// --- Page Drag and Drop Handlers ---
let pageDropIndicator = null; 
function handlePageDragStart(event) {
    draggedPageName = event.target.dataset.pageName;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedPageName);
}
function handlePageDragOver(event) {
    event.preventDefault();
    const targetPageButton = event.target.closest('#pagesContainer .action-button');

    if (draggedOverPageTargetElement && draggedOverPageTargetElement !== targetPageButton) {
        draggedOverPageTargetElement.classList.remove('drag-target-glow');
        draggedOverPageTargetElement = null;
    }

    if (targetPageButton && targetPageButton.dataset.pageName !== draggedPageName) {
        targetPageButton.classList.add('drag-target-glow');
        draggedOverPageTargetElement = targetPageButton;
    } else if (!targetPageButton && event.currentTarget === pagesContainer) { 
        if (draggedOverPageTargetElement) {
            draggedOverPageTargetElement.classList.remove('drag-target-glow');
            draggedOverPageTargetElement = null;
        }
    }
}
function handlePageDragLeave(event) {
    if (draggedOverPageTargetElement) {
        draggedOverPageTargetElement.classList.remove('drag-target-glow');
        draggedOverPageTargetElement = null;
    }
}
function handlePageDrop(event) {
    event.preventDefault();
    
    if (draggedOverPageTargetElement) {
        draggedOverPageTargetElement.classList.remove('drag-target-glow');
        draggedOverPageTargetElement = null;
    }

    if (!draggedPageName) { 
        const draggingElem = pagesContainer.querySelector(`.action-button[data-page-name="${draggedPageName}"]`);
        if(draggingElem) draggingElem.classList.remove('dragging');
        draggedPageName = null;
        return;
    }

    const oldIndex = pageOrder.indexOf(draggedPageName);
    pageOrder.splice(oldIndex, 1); 

    const allPageButtons = Array.from(pagesContainer.querySelectorAll('.action-button'));
    let newIndex = allPageButtons.length; 
    const targetPageButton = event.target.closest('.action-button');

    if (targetPageButton && targetPageButton.dataset.pageName !== draggedPageName) {
        const targetIndex = allPageButtons.indexOf(targetPageButton);
        const rect = targetPageButton.getBoundingClientRect();
        const isAfter = event.clientX > rect.left + rect.width / 2;
        newIndex = targetIndex;
        if (isAfter) {
            newIndex = targetIndex + 1;
        }
        if (oldIndex < newIndex) {
            newIndex--; 
        }
    }
    
    pageOrder.splice(newIndex, 0, draggedPageName); 

    saveAllData();
    // renderPages(); // Not needed, handled by Firebase listener

    const finalDraggingElem = pagesContainer.querySelector(`.action-button[data-page-name="${draggedPageName}"]`);
    if(finalDraggingElem) finalDraggingElem.classList.remove('dragging');
    draggedPageName = null;
}
function handlePageDragEnd(event) {
    const elem = event.target.closest('.action-button');
    if(elem) elem.classList.remove('dragging');
    if(draggedOverPageTargetElement) draggedOverPageTargetElement.classList.remove('drag-target-glow');
    draggedPageName = null;
    draggedOverPageTargetElement = null;
}

// --- Global Search Functions ---
function performGlobalSearch() { 
    const allMemos = [];
    pageOrder.forEach(pageName => {
        if (pages[pageName] && Array.isArray(pages[pageName])) {
            pages[pageName].forEach((memo, index) => {
                allMemos.push({ ...memo, pageName, originalIndex: index, memoId: `${pageName}-${index}` });
            });
        }
    });
    displaySearchResultsModal(allMemos, ''); 
}
function displaySearchResultsModal(allMemos, initialSearchTerm) {
    const existingModal = document.getElementById('searchResultsModal'); 
    if(existingModal) existingModal.remove(); 
    
    const overlay = document.createElement('div'); 
    overlay.id = 'searchResultsModal'; 
    overlay.className = 'modal-overlay fixed inset-0 flex items-center justify-center z-[100]';
    const modal = document.createElement('div'); 
    modal.className = 'modal-content search-results-modal-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 sm:p-8 shadow-2xl';
    
    modal.innerHTML = `
        <div>
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-2xl font-semibold text-gray-800">Search Memos</h3>
                <button id="closeSearchModalButton" class="text-gray-500 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div class="mb-4">
                <input type="text" id="modalSearchInput" class="input-field w-full p-3 rounded-xl focus:outline-none text-sm" placeholder="Search all memos..." value="${initialSearchTerm}">
            </div>
            <div class="search-modal-body scrollbar-custom pr-2">
                </div>
        </div>
    `;
    overlay.appendChild(modal); 
    document.body.appendChild(overlay); 
    document.body.style.overflow = 'hidden'; 

    const modalSearchInput = modal.querySelector('#modalSearchInput');
    const searchResultsContainer = modal.querySelector('.search-modal-body');

    const renderFilteredResults = (searchTerm) => {
        const lowerCaseSearchTerm = searchTerm.trim().toLowerCase();
        const keywords = lowerCaseSearchTerm.split(/\s+/).filter(word => word.length > 0); 

        const filteredResults = allMemos.filter(memo => {
            const importanceLabel = getImportanceLabel(memo.importance).toLowerCase();
            const searchableText = `${memo.name.toLowerCase()} ${memo.content.toLowerCase()} ${importanceLabel}`;
            
            return keywords.every(keyword => searchableText.includes(keyword));
        });

        let resultsHTML = '';
        if (filteredResults.length > 0) {
            filteredResults.forEach(memo => {
                const date = new Date(memo.timestamp); 
                const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`; 
                const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); 
                const displayTimestamp = `${formattedDate} ${formattedTime}`;
                
                let displayName = memo.name;
                let displayContent = memo.content;
                let displayImportanceLabel = getImportanceLabel(memo.importance);

                keywords.forEach(keyword => {
                    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    displayName = displayName.replace(regex, '<mark class="bg-yellow-200 rounded">$1</mark>');
                    displayContent = displayContent.replace(regex, '<mark class="bg-yellow-200 rounded">$1</mark>');
                    displayImportanceLabel = displayImportanceLabel.replace(regex, '<mark class="bg-yellow-200 rounded">$1</mark>');
                });
                
                resultsHTML += `
                    <div class="search-result-item ${getImportanceBorderClass(memo.importance)} border-l-4 pl-3" data-target-page="${memo.pageName}" data-memo-id="${memo.memoId}">
                        <h4 class="font-semibold text-lg text-gray-800 mb-1">${displayName}</h4>
                        <p class="text-xs text-gray-500 mb-1">On page: ${memo.pageName}</p>
                        <div class="flex items-center gap-1 text-sm text-gray-700 mb-2">
                            <div class="importance-light ${getImportanceLightClass(memo.importance)}"></div>
                            <span>${displayImportanceLabel}</span>
                        </div>
                        <div class="search-result-content text-sm text-gray-700 mb-2 whitespace-pre-wrap scrollbar-custom">${displayContent}</div>
                        <p class="text-xs text-gray-500 text-right">${displayTimestamp}</p>
                    </div>`;
            });
        } else { 
            resultsHTML = '<p class="text-gray-600 text-center py-4">No memos found matching your search.</p>'; 
        }
        searchResultsContainer.innerHTML = resultsHTML;

        searchResultsContainer.querySelectorAll('.search-result-content').forEach(contentDiv => {
            const firstHighlight = contentDiv.querySelector('mark');
            if (firstHighlight) {
                firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });


        searchResultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetPage = item.dataset.targetPage;
                const targetMemoId = item.dataset.memoId;
                switchPage(targetPage); 
                setTimeout(() => { 
                    const memoElement = document.querySelector(`.memo-note[data-memo-id="${targetMemoId}"]`);
                    if (memoElement) {
                        memoElement.classList.add('memo-shake-effect');
                        setTimeout(() => {
                            memoElement.classList.remove('memo-shake-effect');
                            memoElement.classList.add('memo-highlight-effect');
                            const firstHighlightInMemo = memoElement.querySelector('mark');
                            if (firstHighlightInMemo) {
                                firstHighlightInMemo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } else {
                                memoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                            setTimeout(() => { 
                                memoElement.classList.remove('memo-highlight-effect');
                            }, 5000); 
                        }, 500); 
                    }
                }, 100); 
                document.body.style.overflow = ''; 
                overlay.remove(); 
            });
        });
    };

    renderFilteredResults(initialSearchTerm);

    modalSearchInput.addEventListener('input', (e) => {
        renderFilteredResults(e.target.value);
    });
    modalSearchInput.focus(); 

    modal.querySelector('#closeSearchModalButton').addEventListener('click', () => { 
        document.body.style.overflow = ''; 
        overlay.remove(); 
    });
}

globalSearchButton.addEventListener('click', () => {
    currentFilter = 'all';
    importanceFilterContainer.querySelectorAll('.filter-importance-button').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.filter === 'all');
    });
    updateMemoList(); 
    if (filterNotificationArea) {
        filterNotificationArea.classList.add('hidden');
    }
    performGlobalSearch(); 
});

// --- Export to Excel Functionality ---
function exportToExcel() {
    let currentMemos = pages[currentPage] || [];
    if (!Array.isArray(currentMemos)) currentMemos = Object.values(currentMemos);

    if (currentMemos.length === 0) {
        showNotification('No memos on this page to export.', 'info');
        return;
    }

    const headers = ["Name", "Content", "Importance", "Timestamp"];
    let csvContent = headers.map(header => `"${header.replace(/"/g, '""')}"`).join(',') + '\n';

    currentMemos.forEach(memo => {
        if (!memo) return;
        const name = `"${memo.name.replace(/"/g, '""')}"`;
        const content = `"${memo.content.replace(/"/g, '""')}"`; 
        const importance = `"${getImportanceLabel(memo.importance).replace(/"/g, '""')}"`;
        const date = new Date(memo.timestamp);
        const formattedTimestamp = `"${date.toLocaleString().replace(/"/g, '""')}"`; 

        csvContent += [name, content, importance, formattedTimestamp].join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${currentPage}_memos.csv`);
    link.style.visibility = 'hidden'; 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    URL.revokeObjectURL(url); 

    showNotification(`Exported ${currentMemos.length} memos from "${currentPage}"!`);
}
exportButton.addEventListener('click', exportToExcel);

// --- UI Update and Initialization ---

function updateUI() { 
    const user = auth.currentUser;
    if (!user) {
        memoDisplayArea.innerHTML = '';
        pagesContainer.innerHTML = '';
        currentMemoPageTitle.textContent = 'Memos';
        messageCount.textContent = `0/53 memos`;
        return;
    }

    if (!pages[currentPage] && pageOrder && pageOrder.length > 0) { 
        currentPage = pageOrder[0]; 
    } else if (!pages[currentPage]) { 
        currentPage = 'default'; 
        if(!pageOrder.includes('default')) pageOrder.push('default'); 
        if(!pages.default) pages.default = []; 
    } 
    
    renderPages(); 
    updateMemoList(); 
    const pageTitle = currentPage ? currentPage.charAt(0).toUpperCase() + currentPage.slice(1) : 'Memos'; 
    currentMemoPageTitle.textContent = `${pageTitle} Memos`; 
    updateSaveButtonState(); 
    
    selectedImportance = null;
    importanceButtonsContainer.querySelectorAll('.importance-button').forEach(btn => {
        btn.classList.remove('selected');
    });

    importanceFilterContainer.querySelectorAll('.filter-importance-button').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.filter === currentFilter);
    });

    if (filterNotificationArea) {
        if (currentFilter !== 'all') {
            filterNotificationArea.textContent = 'Drag-and-drop reordering is disabled while a filter is active.';
            filterNotificationArea.classList.remove('hidden');
        } else {
            filterNotificationArea.classList.add('hidden');
        }
    }
}

importanceFilterContainer.addEventListener('click', (e) => {
    const clickedButton = e.target.closest('.filter-importance-button');
    if (clickedButton) {
        importanceFilterContainer.querySelectorAll('.filter-importance-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        clickedButton.classList.add('selected');
        currentFilter = clickedButton.dataset.filter;
        updateMemoList(); 

        if (filterNotificationArea) {
            if (currentFilter !== 'all') {
                filterNotificationArea.textContent = 'Drag-and-drop reordering is disabled while a filter is active.';
                filterNotificationArea.classList.remove('hidden');
            } else {
                filterNotificationArea.classList.add('hidden');
            }
        }
    }
});

// Initialize Flatpickr only once
if(!flatpickrInstance) {
    flatpickrInstance = flatpickr(memoDateInput, {
        dateFormat: "d/m/Y",      
        altInput: true,          
        altFormat: "d/m/Y",      
        allowInput: true,        
        clickOpens: false,       
        defaultDate: "today",
        onChange: function(selectedDates, dateStr, instance) {
            const event = new Event('input', { bubbles: true });
            instance.input.dispatchEvent(event);
        }
    });

    if (flatpickrInstance && flatpickrInstance.altInput) {
        flatpickrInstance.altInput.addEventListener('change', () => {
            const event = new Event('input', { bubbles: true });
            memoDateInput.dispatchEvent(event); 
        });
    }

    memoDateIcon.addEventListener('click', () => {
        if (flatpickrInstance) {
            flatpickrInstance.open();
        }
    });
}

// --- Large Message Input Modal Logic ---
openLargeMessageInputModalButton.addEventListener('click', () => {
    largeMessageInputTextArea.value = messageInput.value; // Populate with current content
    largeMessageInputModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    largeMessageInputTextArea.focus();
});

closeLargeMessageInputModalButton.addEventListener('click', () => {
    // This button now triggers save functionality before closing
    messageInput.value = largeMessageInputTextArea.value; // Transfer content back
    charCount.textContent = `${messageInput.value.length} characters`; // Update character count
    updateSaveButtonState(); // Update save button state
    largeMessageInputModal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
});
