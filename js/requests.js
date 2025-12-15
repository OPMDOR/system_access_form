/**
 * OPM SYSTEM ACCESS PORTAL - REQUEST MANAGEMENT MODULE
 * Handles system access request creation, retrieval, and updates
 */

class RequestManager {
    constructor() {
        this.requests = [];
        this.storageKey = 'opm_requests';
        this.githubRepo = 'YOUR_USERNAME/YOUR_REPO'; // Update with your GitHub repo
        this.githubFile = 'requests.json';
        this.init();
    }

    async init() {
        await this.loadRequests();
    }

    /**
     * Load requests from storage
     */
    async loadRequests() {
        try {
            // Try to load from GitHub first
            const githubData = await this.loadFromGitHub();
            
            if (githubData && githubData.requests) {
                this.requests = githubData.requests;
                console.log(`Loaded ${this.requests.length} requests from GitHub`);
                return;
            }
            
            // Fallback to localStorage
            const localData = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
            this.requests = localData;
            console.log(`Loaded ${localData.length} requests from localStorage`);
            
        } catch (error) {
            console.error('Error loading requests:', error);
            this.requests = [];
        }
    }

    /**
     * Load requests from GitHub
     */
    async loadFromGitHub() {
        try {
            const url = `https://raw.githubusercontent.com/${this.githubRepo}/main/${this.githubFile}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // File doesn't exist yet
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Error loading from GitHub:', error);
            return null;
        }
    }

    /**
     * Save requests to storage
     */
    async saveRequests() {
        try {
            // Save to localStorage
            localStorage.setItem(this.storageKey, JSON.stringify(this.requests));
            
            // Try to save to GitHub (optional)
            await this.saveToGitHub();
            
            return {
                success: true,
                message: 'Requests saved successfully'
            };
            
        } catch (error) {
            console.error('Error saving requests:', error);
            return {
                success: false,
                message: 'Error saving requests: ' + error.message
            };
        }
    }

    /**
     * Save to GitHub (simplified - would need GitHub API token for real implementation)
     */
    async saveToGitHub() {
        // In a real implementation, you would use GitHub API
        // For now, we'll just log that we would save
        console.log('Would save to GitHub:', {
            totalRequests: this.requests.length,
            file: this.githubFile
        });
        return { success: true };
    }

    /**
     * Create new request
     */
    async createRequest(requestData) {
        try {
            // Generate unique request ID
            const requestId = this.generateRequestId();
            
            // Get current user
            const user = auth.getCurrentUser();
            
            if (!user || !user.authorized) {
                throw new Error('User not authorized');
            }
            
            // Get staff details
            const staff = staffManager.getStaffByEmail(requestData.staffEmail);
            
            if (!staff) {
                throw new Error('Staff email not found in database');
            }
            
            // Create request object
            const request = {
                id: requestId,
                staffEmail: requestData.staffEmail,
                staff: {
                    id: staff.id,
                    firstname: staff.firstname,
                    middlename: staff.middlename,
                    lastname: staff.lastname,
                    email: staff.email,
                    title: staff.title,
                    settlement: staff.settlement,
                    department: staff.department,
                    fullName: staff.fullName || `${staff.firstname} ${staff.lastname}`
                },
                system: requestData.system,
                accessRights: requestData.accessRights,
                justification: requestData.justification,
                duration: requestData.duration,
                requestingOfficer: user.name,
                requestingOfficerEmail: user.email,
                timestamp: new Date().toISOString(),
                requestDate: new Date().toLocaleDateString('en-CA'),
                status: 'pending',
                approver: null,
                approverEmail: null,
                approvalDate: null,
                rejectionReason: null,
                comments: null
            };
            
            // Add to requests array
            this.requests.push(request);
            
            // Save to storage
            await this.saveRequests();
            
            // Create approval link
            const approvalLink = `${window.location.origin}/approval.html?id=${requestId}`;
            
            return {
                success: true,
                request: request,
                approvalLink: approvalLink,
                message: 'Request created successfully'
            };
            
        } catch (error) {
            console.error('Error creating request:', error);
            return {
                success: false,
                message: 'Error creating request: ' + error.message
            };
        }
    }

    /**
     * Get request by ID
     */
    getRequestById(requestId) {
        return this.requests.find(request => request.id === requestId) || null;
    }

    /**
     * Get all requests for a specific request ID (batch)
     */
    getBatchRequests(requestId) {
        return this.requests.filter(request => request.id === requestId);
    }

    /**
     * Get all requests
     */
    getAllRequests() {
        return this.requests.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    /**
     * Get requests by status
     */
    getRequestsByStatus(status) {
        return this.requests.filter(request => request.status === status);
    }

    /**
     * Get requests by requesting officer
     */
    getRequestsByOfficer(email) {
        return this.requests.filter(request => 
            request.requestingOfficerEmail.toLowerCase() === email.toLowerCase()
        );
    }

    /**
     * Update request status
     */
    async updateRequestStatus(requestId, status, approverInfo, rejectionReason = '') {
        try {
            const request = this.getRequestById(requestId);
            
            if (!request) {
                throw new Error('Request not found');
            }
            
            // Update request
            request.status = status;
            request.approver = approverInfo.name;
            request.approverEmail = approverInfo.email;
            request.approvalDate = new Date().toISOString();
            
            if (status === 'rejected' && rejectionReason) {
                request.rejectionReason = rejectionReason;
            }
            
            // Save changes
            await this.saveRequests();
            
            return {
                success: true,
                request: request,
                message: `Request ${status} successfully`
            };
            
        } catch (error) {
            console.error('Error updating request:', error);
            return {
                success: false,
                message: 'Error updating request: ' + error.message
            };
        }
    }

    /**
     * Update multiple requests (batch approval)
     */
    async updateBatchRequests(requestId, decisions, approverInfo) {
        try {
            const batchRequests = this.getBatchRequests(requestId);
            
            if (batchRequests.length === 0) {
                throw new Error('No requests found for this ID');
            }
            
            let approvedCount = 0;
            let rejectedCount = 0;
            
            // Update each request
            decisions.forEach(decision => {
                const request = this.getRequestById(decision.requestId);
                
                if (request && request.id.startsWith(requestId)) {
                    request.status = decision.action;
                    request.approver = approverInfo.name;
                    request.approverEmail = approverInfo.email;
                    request.approvalDate = new Date().toISOString();
                    
                    if (decision.action === 'rejected' && decision.reason) {
                        request.rejectionReason = decision.reason;
                    }
                    
                    if (decision.action === 'approved') approvedCount++;
                    if (decision.action === 'rejected') rejectedCount++;
                }
            });
            
            // Save changes
            await this.saveRequests();
            
            return {
                success: true,
                total: decisions.length,
                approved: approvedCount,
                rejected: rejectedCount,
                message: `Updated ${decisions.length} requests`
            };
            
        } catch (error) {
            console.error('Error updating batch requests:', error);
            return {
                success: false,
                message: 'Error updating requests: ' + error.message
            };
        }
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const stats = {
            total: this.requests.length,
            byStatus: {
                pending: 0,
                approved: 0,
                rejected: 0
            },
            bySystem: {},
            byMonth: {},
            byDepartment: {}
        };
        
        this.requests.forEach(request => {
            // Count by status
            stats.byStatus[request.status] = (stats.byStatus[request.status] || 0) + 1;
            
            // Count by system
            const system = request.system || 'Unknown';
            stats.bySystem[system] = (stats.bySystem[system] || 0) + 1;
            
            // Count by month
            const month = request.timestamp.substring(0, 7); // YYYY-MM
            stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
            
            // Count by department
            const dept = request.staff?.department || 'Unknown';
            stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
        });
        
        return stats;
    }

    /**
     * Filter requests
     */
    filterRequests(filters = {}) {
        let filtered = [...this.requests];
        
        // Filter by date range
        if (filters.dateFrom || filters.dateTo) {
            filtered = filtered.filter(request => {
                const requestDate = new Date(request.timestamp).toISOString().split('T')[0];
                
                if (filters.dateFrom && requestDate < filters.dateFrom) return false;
                if (filters.dateTo && requestDate > filters.dateTo) return false;
                
                return true;
            });
        }
        
        // Filter by status
        if (filters.status) {
            filtered = filtered.filter(request => request.status === filters.status);
        }
        
        // Filter by system
        if (filters.system) {
            filtered = filtered.filter(request => request.system === filters.system);
        }
        
        // Filter by department
        if (filters.department) {
            filtered = filtered.filter(request => 
                request.staff?.department === filters.department
            );
        }
        
        // Sort by date (newest first)
        return filtered.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    /**
     * Export requests to CSV
     */
    exportToCSV(requests = this.requests) {
        const headers = [
            'Request ID', 'Staff Name', 'Staff Email', 'System', 'Access Rights',
            'Duration', 'Justification', 'Status', 'Request Date', 'Requesting Officer',
            'Approver', 'Approval Date', 'Rejection Reason'
        ];
        
        const csvContent = [
            headers.join(','),
            ...requests.map(request => [
                `"${request.id}"`,
                `"${request.staff?.fullName || ''}"`,
                `"${request.staffEmail}"`,
                `"${request.system || ''}"`,
                `"${request.accessRights || ''}"`,
                `"${request.duration || ''}"`,
                `"${request.justification || ''}"`,
                `"${request.status || ''}"`,
                `"${request.requestDate || ''}"`,
                `"${request.requestingOfficer || ''}"`,
                `"${request.approver || ''}"`,
                `"${request.approvalDate || ''}"`,
                `"${request.rejectionReason || ''}"`
            ].join(','))
        ].join('\n');
        
        return csvContent;
    }

    /**
     * Download requests as CSV
     */
    downloadRequestsCSV(filename = 'opm_requests.csv') {
        const csvContent = this.exportToCSV();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        const date = new Date();
        const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
        const random = Math.floor(Math.random() * 9000 + 1000);
        return `REQ-${dateStr}-${random}`;
    }

    /**
     * Validate request data
     */
    validateRequestData(data) {
        const errors = [];
        
        if (!data.staffEmail || !auth.isValidEmail(data.staffEmail)) {
            errors.push('Valid staff email is required');
        }
        
        if (!data.system) {
            errors.push('System selection is required');
        }
        
        if (!data.accessRights) {
            errors.push('Access rights selection is required');
        }
        
        if (!data.duration) {
            errors.push('Access duration is required');
        }
        
        if (!data.justification || data.justification.trim().length < 10) {
            errors.push('Justification must be at least 10 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

// Create global request manager instance
const requestManager = new RequestManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = requestManager;
}