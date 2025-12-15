/**
 * OPM SYSTEM ACCESS PORTAL - AUTHENTICATION MODULE
 * Strict access control for authorized personnel only
 */

// Strict authorization list - Only these 6 people can access
const AUTHORIZED_USERS = {
    "kasangakidoryn@gmail.com": "Doreen Kasangaki",
    "aprossyeunice@gmail.com": "Eunice Prossy Akello",
    "joshuakalungi101@gmail.com": "Joshua Kalungi",
    "asikumahfuzu@gmail.com": "Asiku Mahfuz",
    "noelikwap@gmail.com": "Noel Ikwap",
    "anitahnakkazi@gmail.com": "Anita Nakazzi"
};

// Complete staff database from your list (for auto-population)
const STAFF_DATABASE = [
    // Your 170+ staff members from the list
    {
        id: "1",
        firstName: "Ceasar",
        middleName: "",
        lastName: "Atiku",
        email: "ceasaratiku@gmail.com",
        title: "Assistant Community Services Officer",
        settlement: "",
        department: "Community Services"
    },
    {
        id: "2",
        firstName: "Mariam",
        middleName: "",
        lastName: "Nakasango",
        email: "mariam.nakasango@opm.go.ug",
        title: "Assistant Community Services Officer",
        settlement: "",
        department: "Community Services"
    },
    {
        id: "3",
        firstName: "Doryn",
        middleName: "",
        lastName: "Kasangaki",
        email: "kasangakidoryn@gmail.com",
        title: "Assistant IT Officer",
        settlement: "",
        department: "IT"
    },
    // Add all 170+ staff members here...
    {
        id: "175",
        firstName: "Geoffrey",
        middleName: "",
        lastName: "Mugabe",
        email: "geoffrey.mugabe@opm.go.ug",
        title: "Senior Settlement Officer",
        settlement: "",
        department: "Settlement"
    }
];

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Load user from localStorage on page load
        this.loadUserFromStorage();
    }

    /**
     * Check if email is authorized
     * @param {string} email - User's email
     * @returns {Object|null} User info if authorized, null if not
     */
    checkAuthorization(email) {
        const normalizedEmail = email.toLowerCase().trim();
        
        if (AUTHORIZED_USERS[normalizedEmail]) {
            return {
                email: normalizedEmail,
                name: AUTHORIZED_USERS[normalizedEmail],
                authorized: true
            };
        }
        
        return null;
    }

    /**
     * Authenticate user (simplified version without Google OAuth)
     * @param {string} email - User's email
     * @returns {Object} Authentication result
     */
    authenticate(email) {
        const user = this.checkAuthorization(email);
        
        if (user) {
            // Save to localStorage
            localStorage.setItem('opm_user', JSON.stringify({
                ...user,
                timestamp: new Date().toISOString(),
                sessionId: this.generateSessionId()
            }));
            
            this.currentUser = user;
            
            return {
                success: true,
                user: user,
                message: 'Authentication successful'
            };
        }
        
        return {
            success: false,
            message: 'Access denied. Your email is not authorized.'
        };
    }

    /**
     * Get current logged-in user
     * @returns {Object|null} Current user or null
     */
    getCurrentUser() {
        if (!this.currentUser) {
            this.loadUserFromStorage();
        }
        return this.currentUser;
    }

    /**
     * Check if user is logged in and authorized
     * @returns {boolean} True if authorized
     */
    isAuthenticated() {
        const user = this.getCurrentUser();
        return user && user.authorized === true;
    }

    /**
     * Require authentication - redirect if not authenticated
     * @param {string} redirectUrl - URL to redirect to if not authenticated
     */
    requireAuth(redirectUrl = 'index.html') {
        if (!this.isAuthenticated()) {
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    }

    /**
     * Logout user
     */
    logout() {
        // Clear user data
        localStorage.removeItem('opm_user');
        this.currentUser = null;
        
        // Redirect to login page
        window.location.href = 'index.html';
    }

    /**
     * Load user from localStorage
     */
    loadUserFromStorage() {
        try {
            const userData = JSON.parse(localStorage.getItem('opm_user'));
            
            if (userData && userData.authorized) {
                // Check if session is still valid (24 hours)
                const sessionTime = new Date(userData.timestamp);
                const currentTime = new Date();
                const hoursDiff = (currentTime - sessionTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 24) {
                    this.currentUser = userData;
                } else {
                    // Session expired
                    localStorage.removeItem('opm_user');
                    this.currentUser = null;
                }
            }
        } catch (error) {
            console.error('Error loading user from storage:', error);
            this.currentUser = null;
        }
    }

    /**
     * Get all authorized users (for display purposes)
     * @returns {Array} List of authorized users
     */
    getAuthorizedUsers() {
        return Object.entries(AUTHORIZED_USERS).map(([email, name]) => ({
            email,
            name
        }));
    }

    /**
     * Get staff member by email
     * @param {string} email - Staff email
     * @returns {Object|null} Staff object or null
     */
    getStaffByEmail(email) {
        const normalizedEmail = email.toLowerCase().trim();
        return STAFF_DATABASE.find(staff => 
            staff.email.toLowerCase() === normalizedEmail
        ) || null;
    }

    /**
     * Search staff by name or email
     * @param {string} query - Search query
     * @returns {Array} Matching staff members
     */
    searchStaff(query) {
        const normalizedQuery = query.toLowerCase().trim();
        
        if (!query || query.length < 2) {
            return [];
        }
        
        return STAFF_DATABASE.filter(staff => {
            const fullName = `${staff.firstName} ${staff.lastName}`.toLowerCase();
            const email = staff.email.toLowerCase();
            
            return fullName.includes(normalizedQuery) || 
                   email.includes(normalizedQuery) ||
                   staff.title.toLowerCase().includes(normalizedQuery);
        }).slice(0, 10); // Limit to 10 results
    }

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return 'SESSION-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Display user info in the UI
     * @param {string} userNameId - ID of element to show user name
     * @param {string} userEmailId - ID of element to show user email
     */
    displayUserInfo(userNameId = 'userName', userEmailId = 'userEmail') {
        const user = this.getCurrentUser();
        
        if (user) {
            const nameElement = document.getElementById(userNameId);
            const emailElement = document.getElementById(userEmailId);
            
            if (nameElement) nameElement.textContent = user.name;
            if (emailElement) emailElement.textContent = user.email;
        }
    }

    /**
     * Setup logout button
     * @param {string} buttonId - ID of logout button
     */
    setupLogoutButton(buttonId = 'logoutBtn') {
        const logoutBtn = document.getElementById(buttonId);
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }
}

// Create global auth instance
const auth = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { auth, AUTHORIZED_USERS };
}

// Auto-check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    // If we're not on the login page, check authentication
    if (!window.location.pathname.includes('index.html')) {
        if (!auth.isAuthenticated()) {
            window.location.href = 'index.html';
        } else {
            // Display user info if elements exist
            auth.displayUserInfo();
            auth.setupLogoutButton();
        }
    }
});