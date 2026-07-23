// App State
let otpTimerInterval;
let otpTimeRemaining = 45;
let toastTimeout;

// Toast Notification System
function showNotification(message, type = 'warning') {
    let toast = document.getElementById('app-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-notification';
        const container = document.getElementById('app-container') || document.body;
        container.appendChild(toast);
    }
    
    clearTimeout(toastTimeout);

    const icon = type === 'warning' ? '⚠️' : '✓';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
    toast.className = `app-toast ${type} show`;

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

// Country Code Selection Logic
function updateCountryCode(selectEl) {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const code = selectEl.value;
    const parent = selectEl.closest('.phone-country');
    if (!parent) return;

    const displayEl = parent.querySelector('.code');
    if (displayEl) displayEl.innerText = code;

    const flagImg = parent.querySelector('.flag-img-small');
    const flagCode = selectedOption.getAttribute('data-flag');

    if (flagCode === 'my') {
        if (flagImg) flagImg.src = 'assets/malaysia_flag.png';
    } else {
        if (flagImg) flagImg.src = `https://flagcdn.com/w20/${flagCode}.png`;
    }
}

// Auto-run page specific logic
document.addEventListener('DOMContentLoaded', () => {
    // If on OTP page, start timer and auto-focus first box
    if (document.querySelector('.otp-inputs') || document.querySelector('.otp-box')) {
        const savedPhone = sessionStorage.getItem('userPhone');
        if (savedPhone) {
            const displayEl = document.getElementById('display-phone-otp');
            if (displayEl) displayEl.innerText = '+60 ' + savedPhone;
        }
        startOtpTimer();
        setTimeout(() => {
            const firstInput = document.querySelector('.otp-box');
            if (firstInput) firstInput.focus();
        }, 300);
    }
});

// Gender Selection Logic
let selectedGender = null;
function selectGender(gender) {
    selectedGender = gender;
    const femaleLabel = document.getElementById('label-female');
    const maleLabel = document.getElementById('label-male');
    const femaleRadio = document.getElementById('gender-female');
    const maleRadio = document.getElementById('gender-male');

    if (femaleLabel && maleLabel) {
        femaleLabel.classList.remove('selected');
        maleLabel.classList.remove('selected');

        if (gender === 'female') {
            femaleLabel.classList.add('selected');
            if (femaleRadio) femaleRadio.checked = true;
        } else if (gender === 'male') {
            maleLabel.classList.add('selected');
            if (maleRadio) maleRadio.checked = true;
        }
    }
}

// Validation & Navigation Logic for Step 1
function validateStep1() {
    const usernameEl = document.getElementById('signup-username');
    const emailEl = document.getElementById('signup-email');
    const phoneEl = document.getElementById('signup-phone');
    const birthdayEl = document.getElementById('signup-birthday');

    const username = usernameEl ? usernameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const birthday = birthdayEl ? birthdayEl.value.trim() : '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{7,11}$/;

    if (!username || username.length < 3) {
        showNotification('Please enter a valid username (min 3 characters).', 'warning');
        if (usernameEl) usernameEl.focus();
        return false;
    }

    if (!email || !emailRegex.test(email)) {
        showNotification('Please enter a valid email address (e.g. name@example.com).', 'warning');
        if (emailEl) emailEl.focus();
        return false;
    }

    if (!phone || !phoneRegex.test(phone)) {
        showNotification('Please enter a valid phone number (7 to 11 digits).', 'warning');
        if (phoneEl) phoneEl.focus();
        return false;
    }

    if (!birthday) {
        showNotification('Please select your birthday from the calendar.', 'warning');
        if (birthdayEl) {
            birthdayEl.focus();
            if (birthdayEl.showPicker) birthdayEl.showPicker();
        }
        return false;
    }

    sessionStorage.setItem('userPhone', phone);
    window.location.href = 'step2.html';
    return true;
}

// Validation & Navigation Logic for Step 2
function validateStep2() {
    const poscodeEl = document.getElementById('signup-poscode');
    const poscode = poscodeEl ? poscodeEl.value.trim() : '';

    if (poscode && !/^\d{4,6}$/.test(poscode)) {
        showNotification('Please enter a valid postcode (4 to 6 digits).', 'warning');
        if (poscodeEl) poscodeEl.focus();
        return false;
    }

    if (!selectedGender) {
        showNotification('Please select your gender.', 'warning');
        return false;
    }

    window.location.href = 'otp.html';
    return true;
}

// Login Submission & Validation
function submitLogin() {
    const phoneInput = document.getElementById('login-phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const phoneRegex = /^\d{7,11}$/;

    if (!phone || !phoneRegex.test(phone)) {
        showNotification('Please enter a valid phone number (7 to 11 digits).', 'warning');
        if (phoneInput) phoneInput.focus();
        return false;
    }

    sessionStorage.setItem('userPhone', phone);
    window.location.href = 'otp.html';
}

// OTP Input Auto-advance
function handleOtpInput(input, index) {
    const value = input.value;
    
    // Auto-advance to next input if single digit typed
    if (value.length === 1 && index < 6) {
        const nextInput = input.parentElement.children[index];
        if (nextInput) nextInput.focus();
    }

    // Auto-submit if all 6 digits entered
    const inputs = document.querySelectorAll('.otp-box');
    let fullCode = '';
    inputs.forEach(inp => fullCode += inp.value);
    if (fullCode.length === 6) {
        verifyOtp();
    }
}

// Start OTP Timer
function startOtpTimer() {
    clearInterval(otpTimerInterval);
    otpTimeRemaining = 45;
    
    const resendBtn = document.getElementById('resend-btn');
    const timerEl = document.getElementById('otp-timer');
    
    if (!resendBtn || !timerEl) return;

    resendBtn.classList.add('disabled');
    timerEl.innerText = `(00.45)`;

    otpTimerInterval = setInterval(() => {
        otpTimeRemaining--;
        const seconds = otpTimeRemaining < 10 ? `0${otpTimeRemaining}` : otpTimeRemaining;
        timerEl.innerText = `(00.${seconds})`;

        if (otpTimeRemaining <= 0) {
            clearInterval(otpTimerInterval);
            resendBtn.classList.remove('disabled');
            timerEl.innerText = '';
        }
    }, 1000);
}

// Resend OTP & Restart Timer
function resendOtp(e) {
    if (e) e.preventDefault();

    // Clear input fields and focus first field
    const inputs = document.querySelectorAll('.otp-box');
    inputs.forEach(inp => inp.value = '');
    if (inputs[0]) inputs[0].focus();

    // Restart the 45-second countdown timer
    startOtpTimer();
}

// Verify OTP
function verifyOtp() {
    window.location.href = 'login.html';
}
