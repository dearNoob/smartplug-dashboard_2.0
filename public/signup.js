document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const buttonText = document.getElementById('buttonText');
    const alertContainer = document.getElementById('alertContainer');

    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(signupForm);
        const data = {
            username: formData.get('username'),
            password: formData.get('password'),
            client_id: formData.get('client_id'),
            client_secret: formData.get('client_secret')
        };

        // Validate form data
        if (!data.username || !data.password || !data.client_id || !data.client_secret) {
            showAlert('Please fill in all fields', 'danger');
            return;
        }

        if (data.username.length < 3) {
            showAlert('Username must be at least 3 characters long', 'danger');
            return;
        }

        if (data.password.length < 6) {
            showAlert('Password must be at least 6 characters long', 'danger');
            return;
        }

        // Show loading state
        showLoading(true);
        clearAlerts();

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showAlert('Account created successfully! Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                showAlert(result.message || 'Failed to create account', 'danger');
            }
        } catch (error) {
            console.error('Signup error:', error);
            showAlert('Network error. Please try again.', 'danger');
        } finally {
            showLoading(false);
        }
    });

    function showLoading(loading) {
        if (loading) {
            loadingSpinner.classList.remove('hidden');
            buttonText.textContent = 'Creating Account...';
            signupForm.querySelector('button[type="submit"]').disabled = true;
        } else {
            loadingSpinner.classList.add('hidden');
            buttonText.textContent = 'Create Account';
            signupForm.querySelector('button[type="submit"]').disabled = false;
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
    const inputs = signupForm.querySelectorAll('input[required]');
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
        
        switch(input.name) {
            case 'username':
                if (value.length < 3) {
                    setInputInvalid(input, 'Username must be at least 3 characters');
                } else {
                    setInputValid(input);
                }
                break;
            
            case 'password':
                if (value.length < 6) {
                    setInputInvalid(input, 'Password must be at least 6 characters');
                } else {
                    setInputValid(input);
                }
                break;
            
            case 'client_id':
                if (!value) {
                    setInputInvalid(input, 'Client ID is required');
                } else if (value.length < 10) {
                    setInputInvalid(input, 'Client ID seems too short');
                } else {
                    setInputValid(input);
                }
                break;
            
            case 'client_secret':
                if (!value) {
                    setInputInvalid(input, 'Client Secret is required');
                } else if (value.length < 20) {
                    setInputInvalid(input, 'Client Secret seems too short');
                } else {
                    setInputValid(input);
                }
                break;
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
});