// App State
let otpTimerInterval;
let otpTimeRemaining = 45;
let toastTimeout;

// Smooth Page Navigation
function navigateTo(url) {
    if (!url) return;
    const container = document.getElementById('app-container') || document.querySelector('.container');
    if (container) {
        container.classList.add('page-exit-slide-up');
        setTimeout(() => {
            window.location.href = url;
        }, 250);
    } else {
        window.location.href = url;
    }
}

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

// Malaysian Postcode Dictionary (Client-Side Fast Lookup)
const myPostcodeMap = {
  "00000": "Coffee City",
  // Selangor & Hulu Langat / Sepang
  "43000": "Kajang",
  "43100": "Hulu Langat",
  "43200": "Cheras",
  "43300": "Seri Kembangan",
  "43400": "Serdang",
  "43500": "Semenyih",
  "43600": "Bangi",
  "43650": "Bangi",
  "43700": "Beranang",
  "43800": "Dengkil",
  "43900": "Sepang",
  "47000": "Sungai Buloh",
  "47100": "Puchong",
  "47300": "Petaling Jaya",
  "47301": "Petaling Jaya",
  "47400": "Damansara Utama",
  "47500": "Subang Jaya",
  "47600": "USJ Subang Jaya",
  "47800": "Petaling Jaya / Damansara",
  "47810": "Kota Damansara",
  "40000": "Shah Alam",
  "40100": "Shah Alam",
  "40150": "Shah Alam",
  "40200": "Shah Alam",
  "41000": "Klang",
  "41200": "Klang",
  "42000": "Pelabuhan Klang",
  "63000": "Cyberjaya",
  "68000": "Ampang",
  "68100": "Batu Caves",
  
  // Kuala Lumpur & Putrajaya
  "50000": "Kuala Lumpur",
  "50100": "Kuala Lumpur",
  "50200": "Kuala Lumpur",
  "50480": "Mont Kiara",
  "52000": "Kepong",
  "53000": "Setapak",
  "54000": "Ampang KL",
  "55000": "Pudu",
  "56000": "Cheras KL",
  "57000": "Bukit Jalil",
  "58000": "Seputeh",
  "59000": "Bangsar",
  "60000": "Taman Tun Dr Ismail (TTDI)",
  "62000": "Putrajaya",
  
  // Negeri Sembilan & Melaka
  "70000": "Seremban",
  "70300": "Seremban 2",
  "71000": "Port Dickson",
  "75000": "Melaka",
  "75450": "Ayer Keroh",
  
  // Johor
  "80000": "Johor Bahru",
  "81100": "Johor Bahru",
  "81200": "Johor Bahru",
  "81300": "Skudai",
  "81750": "Masai / Pasir Gudang",
  "84000": "Muar",
  "86000": "Kluang",
  
  // Penang & Northern States
  "10000": "George Town",
  "11900": "Bayan Lepas",
  "13000": "Butterworth",
  "14000": "Bukit Mertajam",
  "05000": "Alor Setar",
  "08000": "Sungai Petani",
  "01000": "Kangar",
  "30000": "Ipoh",
  "30200": "Ipoh",
  "34000": "Taiping",
  
  // East Coast & East Malaysia
  "15000": "Kota Bharu",
  "20000": "Kuala Terengganu",
  "25000": "Kuantan",
  "88000": "Kota Kinabalu",
  "93000": "Kuching",
  "96000": "Sibu",
  "98000": "Miri"
};

// Handle Postcode Input Auto-Lookup
let postcodeLookupTimeout;
function handlePoscodeLookup(inputEl) {
    const value = inputEl.value.trim();
    const cityInput = document.getElementById('signup-city');
    if (!cityInput) return;

    // Only lookup when 5 numeric digits are entered
    if (/^\d{5}$/.test(value)) {
        // Fast Dictionary Lookup
        if (myPostcodeMap[value]) {
            cityInput.value = myPostcodeMap[value];
            highlightCityInput(cityInput);
            return;
        }

        // General Range Fallback
        const codeNum = parseInt(value, 10);
        let estimatedCity = "";

        if (codeNum >= 50000 && codeNum <= 60000) estimatedCity = "Kuala Lumpur";
        else if (codeNum >= 62000 && codeNum <= 62999) estimatedCity = "Putrajaya";
        else if (codeNum >= 40000 && codeNum <= 48999) estimatedCity = "Selangor";
        else if (codeNum >= 70000 && codeNum <= 73999) estimatedCity = "Seremban";
        else if (codeNum >= 75000 && codeNum <= 78999) estimatedCity = "Melaka";
        else if (codeNum >= 80000 && codeNum <= 86999) estimatedCity = "Johor";
        else if (codeNum >= 10000 && codeNum <= 14999) estimatedCity = "Penang";
        else if (codeNum >= 30000 && codeNum <= 39999) estimatedCity = "Perak";
        else if (codeNum >= 5000 && codeNum <= 9999) estimatedCity = "Kedah";
        else if (codeNum >= 1000 && codeNum <= 2999) estimatedCity = "Perlis";
        else if (codeNum >= 15000 && codeNum <= 18999) estimatedCity = "Kelantan";
        else if (codeNum >= 20000 && codeNum <= 24999) estimatedCity = "Terengganu";
        else if (codeNum >= 25000 && codeNum <= 28999) estimatedCity = "Pahang";
        else if (codeNum >= 88000 && codeNum <= 91999) estimatedCity = "Sabah";
        else if (codeNum >= 93000 && codeNum <= 98999) estimatedCity = "Sarawak";

        if (estimatedCity) {
            cityInput.value = estimatedCity;
            highlightCityInput(cityInput);
        }

        // Fetch Zippopotam MY API for precision refinement
        clearTimeout(postcodeLookupTimeout);
        postcodeLookupTimeout = setTimeout(() => {
            fetch(`https://api.zippopotam.us/MY/${value}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data && data.places && data.places.length > 0) {
                        const placeName = data.places[0]['place name'];
                        if (placeName && placeName !== "Selangor") {
                            cityInput.value = placeName;
                            highlightCityInput(cityInput);
                        }
                    }
                })
                .catch(() => {});
        }, 180);
    }
}

function highlightCityInput(el) {
    el.style.borderColor = "var(--primary-green)";
    el.style.backgroundColor = "#F0F5F1";
    setTimeout(() => {
        el.style.borderColor = "";
        el.style.backgroundColor = "#FFFFFF";
    }, 800);
}
