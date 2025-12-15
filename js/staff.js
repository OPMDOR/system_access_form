/**
 * OPM SYSTEM ACCESS PORTAL - STAFF DATABASE MODULE
 * Handles staff data loading, searching, and management
 */

class StaffManager {
    constructor() {
        this.staffDatabase = [];
        this.staffCSVUrl = 'staff_database.csv'; // Update with your actual CSV URL
        this.init();
    }

    async init() {
        await this.loadStaffDatabase();
    }

    /**
     * Load staff database from CSV/JSON
     */
    async loadStaffDatabase() {
        try {
            // Try to load from CSV first
            const csvData = await this.loadFromCSV();
            
            if (csvData && csvData.length > 0) {
                this.staffDatabase = csvData;
                console.log(`Loaded ${csvData.length} staff members from CSV`);
                return;
            }
            
            // Fallback to embedded database from auth.js
            if (typeof STAFF_DATABASE !== 'undefined') {
                this.staffDatabase = STAFF_DATABASE;
                console.log(`Loaded ${STAFF_DATABASE.length} staff members from embedded data`);
                return;
            }
            
            // Last resort: sample data
            this.staffDatabase = this.getSampleData();
            console.log('Loaded sample staff data');
            
        } catch (error) {
            console.error('Error loading staff database:', error);
            this.staffDatabase = this.getSampleData();
        }
    }

    /**
     * Load staff data from CSV file
     */
    async loadFromCSV() {
        try {
            const response = await fetch(this.staffCSVUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            return this.parseCSV(csvText);
            
        } catch (error) {
            console.error('Error loading CSV:', error);
            return null;
        }
    }

    /**
     * Parse CSV text to JSON
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const staffData = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',');
                const staff = {};
                
                headers.forEach((header, index) => {
                    staff[header] = values[index] ? values[index].trim() : '';
                });
                
                // Ensure required fields
                if (staff.email) {
                    staff.fullName = `${staff.firstname || ''} ${staff.lastname || ''}`.trim();
                    staffData.push(staff);
                }
            }
        }
        
        return staffData;
    }

    /**
     * Get sample staff data (fallback)
     */
    getSampleData() {
        return [
            {
                id: "146",
                firstname: "Anthony",
                middlename: "Opio",
                lastname: "Ijalla",
                email: "opix23@gmail.com",
                title: "Registration Volunteer",
                settlement: "Kampala",
                department: "Registration",
                fullName: "Anthony Ijalla"
            },
            {
                id: "147",
                firstname: "Emmanuel",
                middlename: "",
                lastname: "Komakech",
                email: "komakech2023@gmail.com",
                title: "Registration Volunteer",
                settlement: "Adjumani",
                department: "Registration",
                fullName: "Emmanuel Komakech"
            }
        ];
    }

    /**
     * Get staff member by email
     */
    getStaffByEmail(email) {
        const normalizedEmail = email.toLowerCase().trim();
        return this.staffDatabase.find(staff => 
            staff.email.toLowerCase() === normalizedEmail
        ) || null;
    }

    /**
     * Search staff members
     */
    searchStaff(query, limit = 10) {
        const normalizedQuery = query.toLowerCase().trim();
        
        if (!query || query.length < 2) {
            return [];
        }
        
        const results = this.staffDatabase.filter(staff => {
            const searchText = `
                ${staff.firstname || ''} 
                ${staff.middlename || ''} 
                ${staff.lastname || ''}
                ${staff.email || ''}
                ${staff.title || ''}
                ${staff.settlement || ''}
                ${staff.department || ''}
            `.toLowerCase();
            
            return searchText.includes(normalizedQuery);
        });
        
        return results.slice(0, limit);
    }

    /**
     * Get all staff members
     */
    getAllStaff() {
        return this.staffDatabase;
    }

    /**
     * Get staff count
     */
    getStaffCount() {
        return this.staffDatabase.length;
    }

    /**
     * Get staff by department
     */
    getStaffByDepartment(department) {
        return this.staffDatabase.filter(staff => 
            staff.department && staff.department.toLowerCase() === department.toLowerCase()
        );
    }

    /**
     * Get unique departments
     */
    getDepartments() {
        const departments = new Set();
        this.staffDatabase.forEach(staff => {
            if (staff.department) {
                departments.add(staff.department);
            }
        });
        return Array.from(departments).sort();
    }

    /**
     * Auto-populate staff form fields
     */
    autoPopulateForm(email, formSelectors = {}) {
        const staff = this.getStaffByEmail(email);
        
        if (!staff) {
            return false;
        }
        
        // Default selectors
        const selectors = {
            firstName: '#firstName',
            lastName: '#lastName',
            fullName: '#staffFullName',
            title: '#staffTitle',
            settlement: '#staffSettlement',
            department: '#staffDepartment',
            staffId: '#staffId'
        };
        
        // Merge with custom selectors
        Object.assign(selectors, formSelectors);
        
        // Populate fields
        Object.keys(selectors).forEach(key => {
            const element = document.querySelector(selectors[key]);
            if (element) {
                switch(key) {
                    case 'firstName':
                        element.value = staff.firstname || '';
                        break;
                    case 'lastName':
                        element.value = staff.lastname || '';
                        break;
                    case 'fullName':
                        element.textContent = staff.fullName || `${staff.firstname} ${staff.lastname}`;
                        break;
                    case 'title':
                        element.textContent = staff.title || '';
                        break;
                    case 'settlement':
                        element.textContent = staff.settlement || '';
                        break;
                    case 'department':
                        element.textContent = staff.department || '';
                        break;
                    case 'staffId':
                        element.textContent = staff.id || '';
                        break;
                }
            }
        });
        
        return true;
    }

    /**
     * Setup staff search input with suggestions
     */
    setupStaffSearch(inputId, suggestionsId, detailsId) {
        const searchInput = document.getElementById(inputId);
        const suggestionsBox = document.getElementById(suggestionsId);
        const detailsBox = document.getElementById(detailsId);
        
        if (!searchInput) return;
        
        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                this.hideSuggestions(suggestionsBox);
                this.hideStaffDetails(detailsBox);
                return;
            }
            
            searchTimeout = setTimeout(() => {
                const results = this.searchStaff(query);
                this.displaySuggestions(results, suggestionsBox, detailsBox);
            }, 300);
        });
        
        // Handle clicks outside to close suggestions
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                this.hideSuggestions(suggestionsBox);
            }
        });
        
        // Handle Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    this.selectFirstSuggestion(suggestionsBox, detailsBox);
                }
            }
        });
    }

    /**
     * Display search suggestions
     */
    displaySuggestions(results, suggestionsBox, detailsBox) {
        if (!suggestionsBox) return;
        
        suggestionsBox.innerHTML = '';
        
        if (results.length === 0) {
            suggestionsBox.innerHTML = '<div class="suggestion-item">No staff found</div>';
            suggestionsBox.style.display = 'block';
            return;
        }
        
        results.forEach(staff => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <strong>${staff.fullName || `${staff.firstname} ${staff.lastname}`}</strong><br>
                <small>${staff.email}</small> • ${staff.title}
            `;
            div.onclick = () => {
                this.selectStaff(staff, suggestionsBox, detailsBox);
            };
            suggestionsBox.appendChild(div);
        });
        
        suggestionsBox.style.display = 'block';
    }

    /**
     * Select staff from suggestions
     */
    selectStaff(staff, suggestionsBox, detailsBox) {
        if (detailsBox) {
            detailsBox.innerHTML = `
                <h3><i class="fas fa-user-check"></i> Staff Details</h3>
                <div class="staff-details-grid">
                    <div class="detail-item">
                        <div class="detail-label">Full Name</div>
                        <div class="detail-value">${staff.fullName || `${staff.firstname} ${staff.lastname}`}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Staff ID</div>
                        <div class="detail-value">${staff.id || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Position</div>
                        <div class="detail-value">${staff.title || ''}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Settlement</div>
                        <div class="detail-value">${staff.settlement || ''}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Department</div>
                        <div class="detail-value">${staff.department || ''}</div>
                    </div>
                </div>
            `;
            detailsBox.style.display = 'block';
        }
        
        this.hideSuggestions(suggestionsBox);
    }

    /**
     * Select first suggestion
     */
    selectFirstSuggestion(suggestionsBox, detailsBox) {
        const firstItem = suggestionsBox.querySelector('.suggestion-item');
        if (firstItem && !firstItem.textContent.includes('No staff found')) {
            firstItem.click();
        }
    }

    /**
     * Hide suggestions box
     */
    hideSuggestions(suggestionsBox) {
        if (suggestionsBox) {
            suggestionsBox.style.display = 'none';
        }
    }

    /**
     * Hide staff details box
     */
    hideStaffDetails(detailsBox) {
        if (detailsBox) {
            detailsBox.style.display = 'none';
        }
    }

    /**
     * Export staff data to CSV
     */
    exportToCSV() {
        const headers = ['ID', 'First Name', 'Middle Name', 'Last Name', 'Email', 'Title', 'Settlement', 'Department'];
        
        const csvContent = [
            headers.join(','),
            ...this.staffDatabase.map(staff => [
                `"${staff.id || ''}"`,
                `"${staff.firstname || ''}"`,
                `"${staff.middlename || ''}"`,
                `"${staff.lastname || ''}"`,
                `"${staff.email || ''}"`,
                `"${staff.title || ''}"`,
                `"${staff.settlement || ''}"`,
                `"${staff.department || ''}"`
            ].join(','))
        ].join('\n');
        
        return csvContent;
    }

    /**
     * Download staff database
     */
    downloadStaffDatabase() {
        const csvContent = this.exportToCSV();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'opm_staff_database.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Create global staff manager instance
const staffManager = new StaffManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = staffManager;
}