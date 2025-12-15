document.addEventListener('DOMContentLoaded', function() {
    console.log('Refugee Verification System loaded');
    
 
    // Auto-uppercase input

    $('#individual_id').on('input', function() {
        this.value = this.value.toUpperCase();
    });

  
    // Verify Case Button
    
    $('#verify-btn').click(function() {
        const individual_id = $('#individual_id').val().trim().toUpperCase();
        
        console.log('Individual ID entered:', individual_id);
        
        if (!individual_id) {
            Swal.fire({
                icon: 'error',
                title: 'Input Required',
                text: 'Please enter an Individual Number',
                confirmButtonColor: '#2ecc71'
            });
            return;
        }

        // Basic pattern validation
        const basicPattern = /^[A-Z]{3}-[0-9A-Z-]+$/;
        if (!basicPattern.test(individual_id)) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Format',
                html: 'Please use format similar to: <strong>UGA-13975301</strong><br>or <strong>UGA-00000001</strong>',
                confirmButtonColor: '#2ecc71'
            });
            return;
        }

        // Show loading state
        const btn = $(this);
        const originalHtml = btn.html();
        btn.html('<i class="fas fa-spinner fa-spin me-2"></i>Verifying...').prop('disabled', true);

        // Make AJAX request
        $.ajax({
            url: '/verify-case',
            method: 'POST',
            data: { INDIVIDUAL_ID: individual_id },
            success: function(data) {
                console.log('Verification response:', data);
                
                // SCENARIO 1: Active Refugee - Show success with personal info option
                if (data.success && data.eligible) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Verification Successful!',
                        html: `
                            <div class="text-center">
                                <i class="fas fa-check-circle text-success mb-3" style="font-size: 3rem;"></i>
                                <h4 class="text-primary">${data.message}</h4>
                                <p class="text-muted mt-3">Individual is eligible for NSSF services</p>
                            </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: '<i class="fas fa-user-circle me-2"></i>Show Personal Information',
                        cancelButtonText: 'Close',
                        confirmButtonColor: '#2ecc71',
                        cancelButtonColor: '#6c757d',
                        allowOutsideClick: false
                    }).then((result) => {
                        if (result.isConfirmed) {

                            // Show personal information
                            showPersonalInformation(data.individual);
                        }
                    });
                }
                // SCENARIO 2: Process Status Closed
                else if (data.inactive) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Case Closed',
                        html: `
                            <div class="text-center">
                                <i class="fas fa-times-circle text-warning mb-3" style="font-size: 3rem;"></i>
                                <h4 class="text-warning">${data.message}</h4>
                                <p class="text-muted mt-3">${data.details}</p>
                                <div class="alert alert-warning mt-3">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    This individual is not a recognised refugee in Uganda
                                </div>
                            </div>
                        `,
                        confirmButtonText: '<i class="fas fa-home me-2"></i>Return to Home Page',
                        confirmButtonColor: '#f39c12',
                        allowOutsideClick: false
                    }).then((result) => {
                        if (result.isConfirmed) {
                            returnToMainPage();
                        }
                    });
                }
                // SCENARIO 3: Active Asylum Seeker
                else if (data.asylum_seeker) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Case Found - Asylum Seeker',
                        html: `
                            <div class="text-center">
                                <i class="fas fa-passport text-info mb-3" style="font-size: 3rem;"></i>
                                <h4 class="text-info">${data.message}</h4>
                                <p class="lead text-dark mt-3">${data.details}</p>
                                <div class="alert alert-info mt-3">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Asylum seekers must complete the refugee status determination process
                                </div>
                            </div>
                        `,
                        confirmButtonText: '<i class="fas fa-home me-2"></i>Return to Home Page',
                        confirmButtonColor: '#17a2b8',
                        allowOutsideClick: false
                    }).then((result) => {
                        if (result.isConfirmed) {
                            returnToMainPage();
                        }
                    });
                }
                // SCENARIO 4: Not Found
                else if (data.message && data.message.toLowerCase().includes('not found')) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Case Not Found',
                        html: `
                            <div class="text-center">
                                <i class="fas fa-search text-warning mb-3" style="font-size: 3rem;"></i>
                                <h5 class="text-danger">Individual Not Found</h5>
                                <p class="text-muted">No record found for: <strong>${individual_id}</strong></p>
                                <div class="alert alert-info mt-3">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Please check the Individual Number and try again
                                </div>
                            </div>
                        `,
                        confirmButtonText: 'Try Again',
                        confirmButtonColor: '#2ecc71',
                        allowOutsideClick: false
                    }).then((result) => {
                        if (result.isConfirmed) {
                            $('#individual_id').focus().select();
                        }
                    });
                }
                // Other errors
                else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Verification Failed',
                        html: `
                            <div class="text-center">
                                <p class="text-danger">${data.message || 'Verification failed'}</p>
                                ${data.details ? `<p class="text-muted">${data.details}</p>` : ''}
                            </div>
                        `,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#2ecc71'
                    });
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('AJAX Error:', textStatus, errorThrown);
                
                let errorMessage = 'Unable to connect to server. Please try again.';
                
                if (textStatus === 'timeout') {
                    errorMessage = 'Request timed out. Please try again.';
                } else if (jqXHR.status === 404) {
                    errorMessage = 'Server endpoint not found. Check if Flask is running.';
                } else if (jqXHR.status === 500) {
                    errorMessage = 'Server error. Check Flask console for details.';
                }
                
                Swal.fire({
                    icon: 'error',
                    title: 'Connection Error',
                    text: errorMessage,
                    confirmButtonColor: '#2ecc71'
                });
            },
            complete: function() {
                btn.html(originalHtml).prop('disabled', false);
            }
        });
    });

  
    // Show Personal Information Function
    
    function showPersonalInformation(individual) {

        // Populate all fields
        $('#info-individual_number').text(individual.individual_number);
        $('#info-full_name').text(individual.full_name);
        
        // Highlight age if minor
        if (individual.age < 18) {
            $('#info-age').html(`
                <span class="text-danger fw-bold">${individual.age} years ⚠️ Minor</span>
            `);
        } else {
            $('#info-age').text(individual.age + ' years');
        }
        
        $('#info-gender').text(individual.gender);
        $('#info-date_of_birth').text(individual.date_of_birth);
        $('#info-legal_status').text(individual.legal_status);
        $('#info-country_of_origin').text(individual.country_of_origin);
        $('#info-registration_date').text(individual.registration_date);
        $('#info-location_address').text(individual.location_address);
        $('#info-family_group_number').text(individual.family_group_number);
        $('#info-family_size').text(individual.family_size);
        
        // Format NSSF number display
        if (individual.nssf_number) {
            $('#info-nssf_number').html(`
                <span class="text-success">${individual.nssf_number}</span>
                <br><small class="text-muted">Already issued</small>
            `);
            // Disable issue button if already has NSSF
            $('#issueNssfBtn').prop('disabled', true)
                .html('<i class="fas fa-check-circle me-2"></i>NSSF Already Issued')
                .removeClass('btn-success').addClass('btn-secondary');
        } else {
            // Show warning if minor
            if (individual.age < 18) {
                $('#info-nssf_number').html(`
                    <span class="text-warning">Cannot Issue - Minor</span>
                    <br><small class="text-muted">Age: ${individual.age} years (below 18)</small>
                `);
                // Disable issue button for minors
                $('#issueNssfBtn').prop('disabled', true)
                    .html('<i class="fas fa-child me-2"></i>Cannot Issue - Minor')
                    .removeClass('btn-success').addClass('btn-warning');
            } else {
                $('#info-nssf_number').html(`
                    <span class="text-danger">Not Issued</span>
                    <br><small class="text-muted">Click button below to issue</small>
                `);
                // Enable issue button for adults
                $('#issueNssfBtn').prop('disabled', false)
                    .html('<i class="fas fa-file-certificate me-2"></i>Proceed and Issue NSSF Number')
                    .removeClass('btn-warning').addClass('btn-success');
            }
        }

        // Show the container with animation
        $('#personalInfoContainer').fadeIn(500);
        
        // Scroll to the information
        $('html, body').animate({
            scrollTop: $('#personalInfoContainer').offset().top - 100
        }, 800);
    }

  
    // Issue NSSF Button
   
    $('#issueNssfBtn').click(function() {
        const individual_id = $('#individual_id').val().trim().toUpperCase();
        const individual_name = $('#info-full_name').text();
        
        if (!individual_id) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No individual selected',
                confirmButtonColor: '#2ecc71'
            });
            return;
        }

        Swal.fire({
            title: 'Issue NSSF Number',
            html: `
                <div class="text-center">
                    <i class="fas fa-file-certificate text-warning mb-3" style="font-size: 3rem;"></i>
                    <p>Are you sure you want to issue an NSSF number for:</p>
                    <h5 class="text-primary">${individual_name}</h5>
                    <p class="text-muted">Individual: ${individual_id}</p>
                    <div class="alert alert-info mt-3">
                        <i class="fas fa-info-circle me-2"></i>
                        This action cannot be undone
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check-circle me-2"></i>Yes, Issue NSSF',
            cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel',
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                const btn = $(this);
                const originalHtml = btn.html();
                btn.html('<i class="fas fa-spinner fa-spin me-2"></i>Issuing...').prop('disabled', true);

                // Make AJAX request
                $.ajax({
                    url: '/process-nssf',
                    method: 'POST',
                    data: { INDIVIDUAL_ID: individual_id },
                    success: function(data) {
                        if (data.success) {
                            // Update NSSF display
                            $('#info-nssf_number').html(`
                                <span class="text-success">${data.nssf_number}</span>
                                <br><small class="text-muted">Issued just now</small>
                            `);
                            
                            // Disable issue button
                            btn.prop('disabled', true)
                                .html('<i class="fas fa-check-circle me-2"></i>NSSF Issued')
                                .removeClass('btn-success').addClass('btn-secondary');
                            
                            // Show success message
                            Swal.fire({
                                icon: 'success',
                                title: 'NSSF Number Issued!',
                                html: `
                                    <div class="text-center">
                                        <div class="display-6 fw-bold text-success mb-3">
                                            ${data.nssf_number}
                                        </div>
                                        <p>Successfully issued to:</p>
                                        <h5 class="text-primary">${individual_name}</h5>
                                        <div class="alert alert-success mt-3">
                                            <i class="fas fa-check-circle me-2"></i>
                                            The NSSF number has been issued and saved.
                                        </div>
                                    </div>
                                `,
                                confirmButtonText: 'OK',
                                confirmButtonColor: '#28a745'
                            });
                        } 
                        // Handle minor case
                        else if (data.minor) {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Minor Detected',
                                html: `
                                    <div class="text-center">
                                        <i class="fas fa-child text-warning mb-3" style="font-size: 3rem;"></i>
                                        <h4 class="text-warning">${data.message}</h4>
                                        <p class="text-muted mt-3">${data.details}</p>
                                        <div class="alert alert-warning mt-3">
                                            <i class="fas fa-exclamation-triangle me-2"></i>
                                            NSSF numbers cannot be issued to individuals below 18 years
                                        </div>
                                    </div>
                                `,
                                confirmButtonText: '<i class="fas fa-home me-2"></i>Return to Home Page',
                                confirmButtonColor: '#f39c12',
                                allowOutsideClick: false
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    returnToMainPage();
                                }
                            });
                        }
                        // Other errors
                        else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Cannot Issue NSSF',
                                html: `
                                    <div class="text-center">
                                        <p class="text-danger">${data.message}</p>
                                        ${data.nssf_number ? `<p>Existing NSSF: <strong>${data.nssf_number}</strong></p>` : ''}
                                    </div>
                                `,
                                confirmButtonColor: '#2ecc71'
                            });
                        }
                    },
                    error: function() {
                        Swal.fire({
                            icon: 'error',
                            title: 'Connection Error',
                            text: 'Unable to process request. Please try again.',
                            confirmButtonColor: '#2ecc71'
                        });
                    },
                    complete: function() {
                        // Only restore button if not successful
                        if (!data || !data.success) {
                            btn.html(originalHtml).prop('disabled', false);
                        }
                    }
                });
            }
        });
    });

 
    // Return to Main Page Function
    
    function returnToMainPage() {
        // Clear input
        $('#individual_id').val('');
        
        // Hide personal info container
        $('#personalInfoContainer').fadeOut(300);
        
        // Reset issue button state
        $('#issueNssfBtn').prop('disabled', false)
            .html('<i class="fas fa-file-certificate me-2"></i>Proceed and Issue NSSF Number')
            .removeClass('btn-secondary btn-warning').addClass('btn-success');
        
        // Focus on input
        $('#individual_id').focus();
        
        // Show notification
        Swal.fire({
            icon: 'info',
            title: 'Ready for New Search',
            text: 'Search field has been cleared',
            timer: 1500,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
        });
    }

    
    // Return to Main Page Button
    
    $('#returnToMainBtn').click(function() {
        returnToMainPage();
    });

    
    // Home button in personal info
   
    $('#homeBtnInfo').click(function() {
        returnToMainPage();
    });

    
    // Hover effect for Verify Case button
   
    $('#verify-btn').hover(
        function() {
            // Mouse enter
            $(this).css({
                'transform': 'translateY(-3px)',
                'box-shadow': '0 10px 20px rgba(46, 204, 113, 0.3)'
            });
        },
        function() {
            // Mouse leave
            $(this).css({
                'transform': 'translateY(0)',
                'box-shadow': 'none'
            });
        }
    );

   
    // Enter key support for search
   
    $('#individual_id').keypress(function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            $('#verify-btn').click();
        }
    });

    
    // Format numbers on statistics page 
    
    function formatNumber(num) {
        if (!num) return "0";
        const number = parseFloat(num.toString().replace(/,/g, ''));
        if (isNaN(number)) return "0";
        return number.toLocaleString();
    }

    document.querySelectorAll('.metric-value').forEach(el => {
        el.textContent = formatNumber(el.textContent);
    });

    
    // Initialize tooltips
    
    $('[data-bs-toggle="tooltip"]').tooltip();

    
    // Log page load
    
    console.log('Refugee Verification System initialized successfully');
       
    // View NSSF Records Button
 
    $('#viewNssfRecordsBtn').click(function() {
        // Show loading
        const btn = $(this);
        const originalHtml = btn.html();
        btn.html('<i class="fas fa-spinner fa-spin me-2"></i>Loading...').prop('disabled', true);

        // Fetch NSSF records
        $.ajax({
            url: '/nssf-records',
            method: 'GET',
            success: function(data) {
                if (data.success && data.records && data.records.length > 0) {
                    // Sort records by date (newest first)
                    const sortedRecords = data.records.sort((a, b) => 
                        new Date(b.issue_date || b.date_updated) - new Date(a.issue_date || a.date_updated)
                    );

                    // Create HTML for the records table - KEEP CELL CONTENTS NORMAL
                    let recordsHtml = `
                        <div class="table-responsive mt-3">
                            <table class="table table-bordered table-hover">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>NSSF Number</th>
                                        <th>Individual Number</th>
                                        <th>Full Name</th>
                                        <th>Age</th>
                                        <th>Issue Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    sortedRecords.forEach((record, index) => {
                        const issueDate = record.issue_date || record.date_updated || 'Not available';
                        const formattedDate = new Date(issueDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        recordsHtml += `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${record.nssf_number}</td>
                                <td>${record.individual_number}</td>
                                <td>${record.full_name}</td>
                                <td>${record.age || 'N/A'}</td>
                                <td>${formattedDate}</td>
                                <td>${record.process_status}</td>
                            </tr>
                        `;
                    });

                    recordsHtml += `
                                </tbody>
                            </table>
                        </div>
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-info-circle me-2"></i>
                            Showing ${sortedRecords.length} NSSF issuance records (sorted by date, newest first)
                        </div>
                    `;

                    Swal.fire({
                        title: '<i class="fas fa-list-check text-primary me-2"></i>NSSF Issuance Records',
                        html: recordsHtml,
                        width: '90%',
                        showCloseButton: true,
                        showConfirmButton: false,
                        customClass: {
                            popup: 'nssf-records-popup'
                        }
                    });
                } else {
                    Swal.fire({
                        icon: 'info',
                        title: 'No NSSF Records',
                        html: `
                            <div class="text-center">
                                <i class="fas fa-database text-secondary mb-3" style="font-size: 3rem;"></i>
                                <h5 class="text-muted">No NSSF Records Found</h5>
                                <p class="text-muted">No NSSF numbers have been issued yet.</p>
                                <div class="alert alert-info mt-3">
                                    <i class="fas fa-info-circle me-2"></i>
                                    NSSF records will appear here once issued through the system
                                </div>
                            </div>
                        `,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#2ecc71'
                    });
                }
            },
            error: function() {
                Swal.fire({
                    icon: 'error',
                    title: 'Error Loading Records',
                    text: 'Unable to load NSSF records. Please try again.',
                    confirmButtonColor: '#2ecc71'
                });
            },
            complete: function() {
                btn.html(originalHtml).prop('disabled', false);
            }
        });
    });
});