// export.js - Export Module for Approval System

import ApprovalSystem from './approval.js';

/**
 * Export System Class
 * Handles exporting approval system data in multiple formats
 */
class ExportSystem {
    constructor(approvalSystem) {
        this.approvalSystem = approvalSystem;
        this.exportFormats = ['csv', 'json', 'excel', 'pdf', 'xml'];
        this.templates = {};
        this.initializeTemplates();
    }

    /**
     * Initialize export templates
     */
    initializeTemplates() {
        // CSV Templates
        this.templates.csv = {
            requests: {
                headers: ['ID', 'Requester', 'Subject', 'Status', 'Created', 'Completed', 'Level', 'Workflow'],
                mapper: (request) => [
                    request.id,
                    request.requester,
                    this.escapeCsv(request.subject),
                    request.metadata.status,
                    this.formatDate(request.metadata.submittedAt),
                    this.formatDate(request.metadata.completedAt),
                    request.metadata.currentLevel,
                    request.workflowId
                ]
            },
            approvals: {
                headers: ['Request ID', 'Approver', 'Level', 'Decision', 'Date', 'Comment'],
                mapper: (approval, request) => [
                    request.id,
                    approval.approverId,
                    approval.level,
                    'approved',
                    this.formatDate(approval.approvedAt),
                    this.escapeCsv(approval.comment || '')
                ]
            },
            rejections: {
                headers: ['Request ID', 'Rejector', 'Level', 'Decision', 'Date', 'Reason'],
                mapper: (rejection, request) => [
                    request.id,
                    rejection.approverId,
                    rejection.level,
                    'rejected',
                    this.formatDate(rejection.rejectedAt),
                    this.escapeCsv(rejection.reason || '')
                ]
            },
            comments: {
                headers: ['Request ID', 'User', 'Type', 'Date', 'Comment'],
                mapper: (comment, request) => [
                    request.id,
                    comment.user,
                    comment.type,
                    this.formatDate(comment.timestamp),
                    this.escapeCsv(comment.text)
                ]
            }
        };

        // JSON Templates
        this.templates.json = {
            full: (data) => JSON.stringify(data, null, 2),
            summary: (data) => JSON.stringify(this.createSummary(data), null, 2),
            minimal: (data) => JSON.stringify(this.createMinimalData(data), null, 2)
        };

        // XML Templates
        this.templates.xml = {
            requests: (requests) => this.generateXml(requests, 'requests', 'request'),
            approvals: (approvals) => this.generateXml(approvals, 'approvals', 'approval')
        };
    }

    /**
     * Main export function
     * @param {string} format - Export format (csv, json, excel, pdf, xml)
     * @param {Object} options - Export options
     * @returns {Object} - Export result with data and metadata
     */
    async exportData(format, options = {}) {
        if (!this.exportFormats.includes(format.toLowerCase())) {
            throw new Error(`Unsupported format: ${format}. Supported formats: ${this.exportFormats.join(', ')}`);
        }

        // Get filtered data based on options
        const data = await this.getExportData(options);
        
        let exportResult;
        
        switch (format.toLowerCase()) {
            case 'csv':
                exportResult = this.exportToCsv(data, options);
                break;
            case 'json':
                exportResult = this.exportToJson(data, options);
                break;
            case 'excel':
                exportResult = await this.exportToExcel(data, options);
                break;
            case 'pdf':
                exportResult = await this.exportToPdf(data, options);
                break;
            case 'xml':
                exportResult = this.exportToXml(data, options);
                break;
            default:
                throw new Error(`Format ${format} not implemented`);
        }

        // Add metadata
        exportResult.metadata = {
            exportedAt: new Date().toISOString(),
            format: format,
            recordCount: data.requests.length,
            filters: options.filters || {},
            generatedBy: 'ApprovalSystem Export Module'
        };

        return exportResult;
    }

    /**
     * Get data for export based on filters
     */
    async getExportData(options = {}) {
        const filters = options.filters || {};
        const allRequests = Array.from(this.approvalSystem.requests.values());
        
        // Apply filters
        let filteredRequests = allRequests;
        
        if (filters.dateRange) {
            filteredRequests = filteredRequests.filter(request => {
                const submitted = new Date(request.metadata.submittedAt);
                return submitted >= new Date(filters.dateRange.start) &&
                       submitted <= new Date(filters.dateRange.end);
            });
        }
        
        if (filters.status) {
            filteredRequests = filteredRequests.filter(
                request => request.metadata.status === filters.status
            );
        }
        
        if (filters.requester) {
            filteredRequests = filteredRequests.filter(
                request => request.requester === filters.requester
            );
        }
        
        if (filters.workflowId) {
            filteredRequests = filteredRequests.filter(
                request => request.workflowId === filters.workflowId
            );
        }
        
        // Sort data
        const sortField = filters.sortBy || 'submittedAt';
        const sortOrder = filters.sortOrder || 'desc';
        
        filteredRequests.sort((a, b) => {
            let aValue = a.metadata[sortField] || a[sortField];
            let bValue = b.metadata[sortField] || b[sortField];
            
            if (sortField.includes('At')) {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
        
        // Limit results if specified
        if (filters.limit) {
            filteredRequests = filteredRequests.slice(0, filters.limit);
        }
        
        // Extract related data
        const approvals = [];
        const rejections = [];
        const comments = [];
        
        filteredRequests.forEach(request => {
            approvals.push(...request.metadata.approvals.map(a => ({ ...a, requestId: request.id })));
            rejections.push(...request.metadata.rejections.map(r => ({ ...r, requestId: request.id })));
            comments.push(...request.metadata.comments.map(c => ({ ...c, requestId: request.id })));
        });
        
        return {
            requests: filteredRequests,
            approvals,
            rejections,
            comments,
            statistics: this.approvalSystem.getStatistics()
        };
    }

    /**
     * Export to CSV format
     */
    exportToCsv(data, options) {
        const { sheet = 'requests' } = options;
        const template = this.templates.csv[sheet];
        
        if (!template) {
            throw new Error(`No CSV template for sheet: ${sheet}`);
        }
        
        const rows = [];
        
        // Add headers
        rows.push(template.headers.join(','));
        
        // Add data rows
        if (sheet === 'requests') {
            data.requests.forEach(request => {
                rows.push(template.mapper(request).join(','));
            });
        } else if (sheet === 'approvals') {
            data.approvals.forEach(approval => {
                const request = data.requests.find(r => r.id === approval.requestId);
                rows.push(template.mapper(approval, request).join(','));
            });
        } else if (sheet === 'rejections') {
            data.rejections.forEach(rejection => {
                const request = data.requests.find(r => r.id === rejection.requestId);
                rows.push(template.mapper(rejection, request).join(','));
            });
        } else if (sheet === 'comments') {
            data.comments.forEach(comment => {
                const request = data.requests.find(r => r.id === comment.requestId);
                rows.push(template.mapper(comment, request).join(','));
            });
        }
        
        const csvContent = rows.join('\n');
        const filename = `approvals_${sheet}_${new Date().toISOString().split('T')[0]}.csv`;
        
        return {
            content: csvContent,
            filename,
            mimeType: 'text/csv',
            size: new Blob([csvContent]).size
        };
    }

    /**
     * Export to JSON format
     */
    exportToJson(data, options) {
        const { mode = 'full', includeMetadata = true } = options;
        const template = this.templates.json[mode];
        
        if (!template) {
            throw new Error(`No JSON template for mode: ${mode}`);
        }
        
        let jsonData;
        
        if (mode === 'full') {
            jsonData = {
                requests: data.requests.map(req => this.sanitizeRequest(req)),
                approvals: data.approvals,
                rejections: data.rejections,
                comments: data.comments,
                statistics: data.statistics
            };
        } else {
            jsonData = template(data);
        }
        
        const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
        const filename = `approvals_${mode}_${new Date().toISOString().split('T')[0]}.json`;
        
        return {
            content: jsonString,
            filename,
            mimeType: 'application/json',
            size: new Blob([jsonString]).size
        };
    }

    /**
     * Export to Excel format
     */
    async exportToExcel(data, options) {
        // Check if ExcelJS is available
        if (typeof window === 'undefined' || !window.ExcelJS) {
            throw new Error('Excel export requires ExcelJS library. Please include it in your project.');
        }

        const ExcelJS = window.ExcelJS;
        const workbook = new ExcelJS.Workbook();
        
        // Add metadata
        workbook.creator = 'Approval System';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        // Create Requests sheet
        const requestsSheet = workbook.addWorksheet('Requests');
        this.createExcelSheet(requestsSheet, 'requests', data.requests);
        
        // Create Approvals sheet
        const approvalsSheet = workbook.addWorksheet('Approvals');
        this.createExcelSheet(approvalsSheet, 'approvals', data.approvals, data.requests);
        
        // Create Rejections sheet
        const rejectionsSheet = workbook.addWorksheet('Rejections');
        this.createExcelSheet(rejectionsSheet, 'rejections', data.rejections, data.requests);
        
        // Create Summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        this.createSummarySheet(summarySheet, data);
        
        // Create Statistics sheet
        const statsSheet = workbook.addWorksheet('Statistics');
        this.createStatisticsSheet(statsSheet, data.statistics);
        
        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `approvals_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        return {
            content: buffer,
            filename,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: buffer.byteLength
        };
    }

    /**
     * Create Excel sheet
     */
    createExcelSheet(worksheet, sheetType, items, relatedRequests = null) {
        const template = this.templates.csv[sheetType];
        
        if (!template) {
            throw new Error(`No template for sheet type: ${sheetType}`);
        }
        
        // Add headers
        const headerRow = worksheet.addRow(template.headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Add data rows
        items.forEach(item => {
            let rowData;
            
            if (sheetType === 'requests') {
                rowData = template.mapper(item);
            } else {
                const request = relatedRequests.find(r => r.id === item.requestId);
                rowData = template.mapper(item, request);
            }
            
            worksheet.addRow(rowData);
        });
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(maxLength + 2, 50);
        });
        
        // Add filters
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: worksheet.rowCount, column: worksheet.columnCount }
        };
    }

    /**
     * Create summary sheet in Excel
     */
    createSummarySheet(worksheet, data) {
        worksheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 }
        ];
        
        const summaryData = this.createSummary(data);
        
        Object.entries(summaryData).forEach(([metric, value]) => {
            worksheet.addRow({ metric: this.capitalize(metric), value });
        });
        
        // Style header
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
    }

    /**
     * Create statistics sheet in Excel
     */
    createStatisticsSheet(worksheet, statistics) {
        worksheet.columns = [
            { header: 'Statistic', key: 'statistic', width: 25 },
            { header: 'Count', key: 'count', width: 15 },
            { header: 'Percentage', key: 'percentage', width: 15 }
        ];
        
        const total = statistics.total || 1;
        
        Object.entries(statistics).forEach(([key, value]) => {
            const percentage = ((value / total) * 100).toFixed(2) + '%';
            worksheet.addRow({
                statistic: this.capitalize(key.replace(/([A-Z])/g, ' $1')),
                count: value,
                percentage: key === 'total' ? '100%' : percentage
            });
        });
        
        // Style header
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
    }

    /**
     * Export to PDF format
     */
    async exportToPdf(data, options) {
        // Check if jsPDF is available
        if (typeof window === 'undefined' || !window.jsPDF) {
            throw new Error('PDF export requires jsPDF library. Please include it in your project.');
        }

        const { jsPDF } = window.jsPDF;
        const doc = new jsPDF();
        const { title = 'Approval System Report', includeCharts = false } = options;
        
        let yPosition = 20;
        
        // Add title
        doc.setFontSize(20);
        doc.text(title, 20, yPosition);
        yPosition += 15;
        
        // Add export date
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition);
        yPosition += 10;
        
        // Add summary section
        doc.setFontSize(16);
        doc.text('Summary', 20, yPosition);
        yPosition += 10;
        
        const summary = this.createSummary(data);
        doc.setFontSize(11);
        
        Object.entries(summary).forEach(([key, value]) => {
            doc.text(`${this.capitalize(key)}: ${value}`, 25, yPosition);
            yPosition += 7;
            
            // Add new page if needed
            if (yPosition > 280) {
                doc.addPage();
                yPosition = 20;
            }
        });
        
        yPosition += 5;
        
        // Add requests table
        doc.setFontSize(16);
        doc.text('Recent Requests', 20, yPosition);
        yPosition += 10;
        
        // Create table headers
        const tableHeaders = ['ID', 'Requester', 'Subject', 'Status', 'Created'];
        const tableData = data.requests.slice(0, 15).map(req => [
            req.id.substring(0, 10) + '...',
            req.requester,
            req.subject.length > 30 ? req.subject.substring(0, 30) + '...' : req.subject,
            req.metadata.status,
            this.formatDate(req.metadata.submittedAt, 'short')
        ]);
        
        // Generate table (simplified - in production, use autoTable plugin)
        doc.setFontSize(8);
        tableData.forEach((row, rowIndex) => {
            row.forEach((cell, cellIndex) => {
                doc.text(cell, 20 + (cellIndex * 35), yPosition + (rowIndex * 7));
            });
        });
        
        const filename = `approvals_report_${new Date().toISOString().split('T')[0]}.pdf`;
        const pdfData = doc.output('arraybuffer');
        
        return {
            content: pdfData,
            filename,
            mimeType: 'application/pdf',
            size: pdfData.byteLength
        };
    }

    /**
     * Export to XML format
     */
    exportToXml(data, options) {
        const { includeAll = false } = options;
        
        let xmlContent;
        
        if (includeAll) {
            xmlContent = this.generateFullXml(data);
        } else {
            xmlContent = this.templates.xml.requests(data.requests);
        }
        
        const filename = `approvals_${new Date().toISOString().split('T')[0]}.xml`;
        
        return {
            content: xmlContent,
            filename,
            mimeType: 'application/xml',
            size: new Blob([xmlContent]).size
        };
    }

    /**
     * Generate full XML
     */
    generateFullXml(data) {
        const xml = [];
        xml.push('<?xml version="1.0" encoding="UTF-8"?>');
        xml.push('<approvalSystemExport>');
        xml.push('<exportInfo>');
        xml.push(`<exportDate>${new Date().toISOString()}</exportDate>`);
        xml.push(`<recordCount>${data.requests.length}</recordCount>`);
        xml.push('</exportInfo>');
        
        xml.push('<requests>');
        data.requests.forEach(request => {
            xml.push(this.requestToXml(request));
        });
        xml.push('</requests>');
        
        xml.push('<statistics>');
        xml.push(this.objectToXml(data.statistics, 'stat'));
        xml.push('</statistics>');
        
        xml.push('</approvalSystemExport>');
        
        return xml.join('\n');
    }

    /**
     * Generate XML from data
     */
    generateXml(items, rootTag, itemTag) {
        const xml = [];
        xml.push('<?xml version="1.0" encoding="UTF-8"?>');
        xml.push(`<${rootTag}>`);
        
        items.forEach(item => {
            xml.push(this.objectToXml(item, itemTag));
        });
        
        xml.push(`</${rootTag}>`);
        return xml.join('\n');
    }

    /**
     * Convert object to XML
     */
    objectToXml(obj, tagName) {
        const xml = [];
        xml.push(`<${tagName}>`);
        
        Object.entries(obj).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                xml.push(`<${key}>`);
                value.forEach(item => {
                    if (typeof item === 'object') {
                        xml.push(this.objectToXml(item, 'item'));
                    } else {
                        xml.push(`<item>${this.escapeXml(item.toString())}</item>`);
                    }
                });
                xml.push(`</${key}>`);
            } else if (typeof value === 'object' && value !== null) {
                xml.push(this.objectToXml(value, key));
            } else {
                xml.push(`<${key}>${this.escapeXml(value.toString())}</${key}>`);
            }
        });
        
        xml.push(`</${tagName}>`);
        return xml.join('');
    }

    /**
     * Convert request to XML
     */
    requestToXml(request) {
        return `
    <request>
        <id>${this.escapeXml(request.id)}</id>
        <requester>${this.escapeXml(request.requester)}</requester>
        <subject>${this.escapeXml(request.subject)}</subject>
        <workflowId>${this.escapeXml(request.workflowId)}</workflowId>
        <status>${this.escapeXml(request.metadata.status)}</status>
        <submittedAt>${this.escapeXml(request.metadata.submittedAt.toISOString())}</submittedAt>
        <currentLevel>${request.metadata.currentLevel}</currentLevel>
        <approvals>${request.metadata.approvals.length}</approvals>
        <rejections>${request.metadata.rejections.length}</rejections>
    </request>`;
    }

    /**
     * Create summary object
     */
    createSummary(data) {
        return {
            totalRequests: data.requests.length,
            pendingRequests: data.requests.filter(r => r.metadata.status === 'pending').length,
            approvedRequests: data.requests.filter(r => r.metadata.status === 'approved').length,
            rejectedRequests: data.requests.filter(r => r.metadata.status === 'rejected').length,
            totalApprovals: data.approvals.length,
            totalRejections: data.rejections.length,
            totalComments: data.comments.length,
            avgApprovalTime: this.calculateAverageApprovalTime(data.requests),
            mostActiveRequester: this.getMostActiveRequester(data.requests),
            mostCommonWorkflow: this.getMostCommonWorkflow(data.requests)
        };
    }

    /**
     * Create minimal data structure
     */
    createMinimalData(data) {
        return {
            requests: data.requests.map(req => ({
                id: req.id,
                requester: req.requester,
                subject: req.subject,
                status: req.metadata.status,
                submittedAt: req.metadata.submittedAt,
                workflow: req.workflowId
            })),
            summary: this.createSummary(data)
        };
    }

    /**
     * Sanitize request object for export
     */
    sanitizeRequest(request) {
        const sanitized = { ...request };
        
        // Remove sensitive data if needed
        delete sanitized.workflow?.approvers;
        delete sanitized.data?.sensitiveInfo;
        
        // Convert dates to strings
        sanitized.metadata = { ...sanitized.metadata };
        Object.keys(sanitized.metadata).forEach(key => {
            if (sanitized.metadata[key] instanceof Date) {
                sanitized.metadata[key] = sanitized.metadata[key].toISOString();
            }
        });
        
        return sanitized;
    }

    /**
     * Calculate average approval time
     */
    calculateAverageApprovalTime(requests) {
        const approvedRequests = requests.filter(r => 
            r.metadata.status === 'approved' && 
            r.metadata.completedAt
        );
        
        if (approvedRequests.length === 0) return 'N/A';
        
        const totalTime = approvedRequests.reduce((sum, req) => {
            const start = new Date(req.metadata.submittedAt);
            const end = new Date(req.metadata.completedAt);
            return sum + (end - start);
        }, 0);
        
        const avgMs = totalTime / approvedRequests.length;
        return this.formatDuration(avgMs);
    }

    /**
     * Get most active requester
     */
    getMostActiveRequester(requests) {
        if (requests.length === 0) return 'N/A';
        
        const requesterCounts = {};
        requests.forEach(req => {
            requesterCounts[req.requester] = (requesterCounts[req.requester] || 0) + 1;
        });
        
        return Object.keys(requesterCounts).reduce((a, b) => 
            requesterCounts[a] > requesterCounts[b] ? a : b
        );
    }

    /**
     * Get most common workflow
     */
    getMostCommonWorkflow(requests) {
        if (requests.length === 0) return 'N/A';
        
        const workflowCounts = {};
        requests.forEach(req => {
            workflowCounts[req.workflowId] = (workflowCounts[req.workflowId] || 0) + 1;
        });
        
        return Object.keys(workflowCounts).reduce((a, b) => 
            workflowCounts[a] > workflowCounts[b] ? a : b
        );
    }

    /**
     * Utility functions
     */
    escapeCsv(str) {
        if (str === null || str === undefined) return '';
        const string = str.toString();
        if (string.includes(',') || string.includes('"') || string.includes('\n')) {
            return `"${string.replace(/"/g, '""')}"`;
        }
        return string;
    }

    escapeXml(str) {
        if (str === null || str === undefined) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    formatDate(date, format = 'medium') {
        if (!date) return '';
        
        const d = new Date(date);
        
        switch (format) {
            case 'short':
                return d.toLocaleDateString();
            case 'medium':
                return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
            case 'iso':
                return d.toISOString();
            default:
                return d.toLocaleString();
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Save export to file (browser only)
     */
    saveToFile(exportResult, options = {}) {
        if (typeof window === 'undefined') {
            throw new Error('saveToFile is only available in browser environment');
        }

        const { autoDownload = true } = options;
        const { content, filename, mimeType } = exportResult;
        
        let blob;
        
        if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
            blob = new Blob([content], { type: mimeType });
        } else {
            blob = new Blob([content], { type: mimeType });
        }
        
        if (autoDownload) {
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
        
        return {
            blob,
            url: window.URL.createObjectURL(blob),
            filename,
            mimeType
        };
    }

    /**
     * Get available export formats
     */
    getAvailableFormats() {
        return [...this.exportFormats];
    }

    /**
     * Add custom export format
     */
    addCustomFormat(formatName, template) {
        if (this.exportFormats.includes(formatName)) {
            throw new Error(`Format ${formatName} already exists`);
        }
        
        this.exportFormats.push(formatName);
        this.templates[formatName] = template;
        
        return this;
    }
}

/**
 * Export builder for fluent API
 */
class ExportBuilder {
    constructor(exportSystem) {
        this.exportSystem = exportSystem;
        this.options = {
            filters: {},
            format: 'json'
        };
    }

    format(format) {
        this.options.format = format;
        return this;
    }

    filter(filters) {
        this.options.filters = { ...this.options.filters, ...filters };
        return this;
    }

    dateRange(start, end) {
        this.options.filters.dateRange = { start, end };
        return this;
    }

    status(status) {
        this.options.filters.status = status;
        return this;
    }

    requester(requester) {
        this.options.filters.requester = requester;
        return this;
    }

    workflow(workflowId) {
        this.options.filters.workflowId = workflowId;
        return this;
    }

    sortBy(field, order = 'desc') {
        this.options.filters.sortBy = field;
        this.options.filters.sortOrder = order;
        return this;
    }

    limit(count) {
        this.options.filters.limit = count;
        return this;
    }

    async execute() {
        return await this.exportSystem.exportData(
            this.options.format,
            this.options
        );
    }

    async download() {
        const result = await this.execute();
        return this.exportSystem.saveToFile(result);
    }
}

/**
 * Factory function to create export system
 */
export function createExportSystem(approvalSystem) {
    return new ExportSystem(approvalSystem);
}

/**
 * Factory function to create export builder
 */
export function createExportBuilder(approvalSystem) {
    const exportSystem = new ExportSystem(approvalSystem);
    return new ExportBuilder(exportSystem);
}

/**
 * Example usage exports
 */
export const ExportExamples = {
    async generateMonthlyReport(approvalSystem) {
        const exportSystem = new ExportSystem(approvalSystem);
        
        // Get first and last day of current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        return await exportSystem.exportData('excel', {
            title: `Monthly Approval Report - ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            filters: {
                dateRange: {
                    start: firstDay,
                    end: lastDay
                },
                sortBy: 'submittedAt',
                sortOrder: 'desc'
            }
        });
    },

    async exportUserActivity(approvalSystem, userId) {
        const exportSystem = new ExportSystem(approvalSystem);
        
        const requests = approvalSystem.getUserRequests(userId, { asRequester: true });
        const approvals = approvalSystem.getUserRequests(userId, { asApprover: true });
        
        // Combine and export
        const allData = {
            requests: requests,
            approvals: approvals,
            statistics: {
                submitted: requests.length,
                approved: approvals.filter(a => a.metadata.status === 'approved').length,
                pending: approvals.filter(a => a.metadata.status === 'pending').length
            }
        };
        
        return exportSystem.exportToJson(allData, { mode: 'summary' });
    }
};

// Default export
export default ExportSystem;