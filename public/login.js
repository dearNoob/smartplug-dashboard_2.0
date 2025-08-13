document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const buttonText = document.getElementById('buttonText');
    const alertContainer = document.getElementById('alertContainer');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(loginForm);
        const data = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        // Validate form data
        if (!data.username || !data.password) {
            showAlert('Please fill in all fields', 'danger');
            return;
        }

        // Show loading state
        showLoading(true);
        clearAlerts();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showAlert('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);
            } else {
                showAlert(result.message || 'Login failed', 'danger');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('Network error. Please try again.', 'danger');
        } finally {
            showLoading(false);
        }
    });

    function showLoading(loading) {
        if (loading) {
            loadingSpinner.classList.remove('hidden');
            buttonText.textContent = 'Logging in...';
            loginForm.querySelector('button[type="submit"]').disabled = true;
        } else {
            loadingSpinner.classList.add('hidden');
            buttonText.textContent = 'Login';
            loginForm.querySelector('button[type="submit"]').disabled = false;
        }
    }

    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-custom alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
        `;
        
        alertContainer.appendChild(alertDiv);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    function clearAlerts() {
        alertContainer.innerHTML = '';
    }

    // Add input validation on blur
    const inputs = loginForm.querySelectorAll('input[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateInput(this);
        });

        input.addEventListener('input', function() {
            // Remove validation styling while typing
            this.classList.remove('is-invalid', 'is-valid');
        });
    });

    function validateInput(input) {
        const value = input.value.trim();
        
        if (!value) {
            setInputInvalid(input, `${input.name.charAt(0).toUpperCase() + input.name.slice(1)} is required`);
        } else {
            setInputValid(input);
        }
    }

    function setInputInvalid(input, message) {
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
        
        // Remove existing feedback
        const existingFeedback = input.parentNode.querySelector('.invalid-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }
        
        // Add feedback message
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.textContent = message;
        input.parentNode.appendChild(feedback);
    }

    function setInputValid(input) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        
        // Remove feedback message
        const existingFeedback = input.parentNode.querySelector('.invalid-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }
    }

    // Check for signup success message
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signup') === 'success') {
        showAlert('Account created successfully! Please login.', 'success');
    }

    // Add some visual enhancements
    addInputAnimations();

    function addInputAnimations() {
        const inputs = document.querySelectorAll('input');
        
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.parentNode.classList.add('focused');
            });
            
            input.addEventListener('blur', function() {
                this.parentNode.classList.remove('focused');
            });
        });
    }

    // Enter key handling
    loginForm.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
});