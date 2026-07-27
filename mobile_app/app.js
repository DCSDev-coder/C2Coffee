// App State
let otpTimerInterval;
let otpTimeRemaining = 45;
let toastTimeout;

// Page Loading Overlay System (Inspired by Stitch Beverage Enhancements)
let loadingInterval;

function showLoadingOverlay() {
    let overlay = document.getElementById('page-loading-overlay');
    const container = document.getElementById('app-container') || document.body;

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'page-loading-overlay';
        overlay.className = 'page-loading-overlay';
        overlay.innerHTML = `
          <div class="loading-canvas">

            <!-- Central Coffee Cup Fill Animation -->
            <div class="cup-animation-wrap">
              <!-- Steam Lines -->
              <svg class="steam-svg" viewBox="0 0 100 100">
                <path class="steam-line" d="M30,80 Q40,60 30,40" fill="none" stroke="#C65102" stroke-width="2.5" style="animation-delay: 0s;"></path>
                <path class="steam-line" d="M50,85 Q60,65 50,45" fill="none" stroke="#1C3B24" stroke-width="2.5" style="animation-delay: 0.4s;"></path>
                <path class="steam-line" d="M70,80 Q80,60 70,40" fill="none" stroke="#C65102" stroke-width="2.5" style="animation-delay: 0.8s;"></path>
              </svg>

              <!-- SVG Cup -->
              <svg class="cup-svg" viewBox="0 0 100 100">
                <!-- Cup Handle -->
                <path d="M75,35 C88,35 95,45 95,55 C95,65 88,75 75,75" fill="none" stroke="#1C3B24" stroke-linecap="round" stroke-width="4.5"></path>
                <defs>
                  <clipPath id="c2CupMask">
                    <path d="M15,30 L85,30 L78,85 C77,90 73,94 68,94 L32,94 C27,94 23,90 22,85 L15,30 Z"></path>
                  </clipPath>
                </defs>
                <!-- Cup Body Background -->
                <path d="M15,30 L85,30 L78,85 C77,90 73,94 68,94 L32,94 C27,94 23,90 22,85 L15,30 Z" fill="#FFF3E8" stroke="#1C3B24" stroke-width="3.5"></path>
                <!-- Liquid Fill -->
                <g clip-path="url(#c2CupMask)">
                  <rect class="c2-liquid-fill" id="c2-liquid" fill="#5A3214" width="100" height="100" x="0" y="0"></rect>
                  <path class="c2-liquid-fill" id="c2-wave" d="M0,0 Q25,-5 50,0 T100,0 V10 H0 Z" fill="#E56000"></path>
                </g>
                <!-- Cup Rim -->
                <path d="M15,30 L85,30" fill="none" stroke="#1C3B24" stroke-linecap="round" stroke-width="3.5"></path>
              </svg>
              <!-- C2 Logo overlaid on cup -->
              <img src="assets/c2_logo.png" alt="C²" class="cup-c2-logo">
            </div>

            <!-- Percentage Counter & Status -->
            <div class="loading-counter-group">
              <div class="counter-val-wrap">
                <span class="counter-num" id="c2-counter">0</span>
                <span class="counter-pct">%</span>
              </div>
              <p class="loading-status-text">Crafting Your Beverage</p>
              <div class="bounce-dots">
                <span class="b-dot"></span>
                <span class="b-dot"></span>
                <span class="b-dot"></span>
              </div>
            </div>

            <!-- Descriptive Quote -->
            <p class="loading-quote">"A latte love makes perfect sense."</p>
          </div>
        `;
        container.appendChild(overlay);
    }

    const headerEl = document.querySelector('.order-header-bar, .sb1-header, .sb2-header, .lb-header, .ob-header');
    if (headerEl) {
        headerEl.style.transition = 'opacity 0.15s ease';
        headerEl.style.opacity = '0';
    }

    void overlay.offsetWidth;
    overlay.classList.add('active');

    // Run 0 -> 100% counter and liquid fill
    const counterEl = document.getElementById('c2-counter');
    const liquidEl = document.getElementById('c2-liquid');
    const waveEl = document.getElementById('c2-wave');
    let count = 0;
    clearInterval(loadingInterval);

    if (counterEl && liquidEl && waveEl) {
        liquidEl.style.transform = `translateY(100%)`;
        waveEl.style.transform = `translateY(100%)`;

        loadingInterval = setInterval(() => {
            count += 3;
            if (count > 100) count = 100;
            counterEl.textContent = count;

            const translateY = 100 - count;
            liquidEl.style.transform = `translateY(${translateY}%)`;
            waveEl.style.transform = `translateY(${translateY}%)`;

            if (count >= 100) {
                clearInterval(loadingInterval);
            }
        }, 32);
    }
}

// Smooth Page Navigation with Loading Screen
function navigateTo(url) {
    if (!url) return;
    showLoadingOverlay();
    setTimeout(() => {
        window.location.href = url;
    }, 1200);
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
    window.location.href = 'stepbackup2.html';
    return true;
}

// Validation & Navigation Logic for Step 2
function validateStep2() {
    // Support both original step2 and stepbackup2 postcode IDs
    const poscodeEl = document.getElementById('signup-poscode') || document.getElementById('sb2-postcode');
    const poscode = poscodeEl ? poscodeEl.value.trim() : '';

    if (poscode && !/^\d{4,6}$/.test(poscode)) {
        showNotification('Please enter a valid postcode (4 to 6 digits).', 'warning');
        if (poscodeEl) poscodeEl.focus();
        return false;
    }

    // Support both original selectedGender and stepbackup2's sb2Gender
    const gender = (typeof sb2Gender !== 'undefined' && sb2Gender) ? sb2Gender : selectedGender;
    if (!gender) {
        showNotification('Please select your gender.', 'warning');
        return false;
    }

    window.location.href = 'otpbackup.html';
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
    navigateTo('home.html');
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
                .catch(() => { });
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

// Automatic & Interactive Promo Carousel Slider
let currentSlide = 0;
let carouselInterval;

function initCarousel() {
    const track = document.getElementById('carousel-track');
    const dots = document.querySelectorAll('.carousel-dots .dot');
    const container = document.getElementById('promo-carousel');

    if (!track || !dots.length) return;

    function showSlide(index) {
        const slides = track.children;
        if (!slides.length) return;

        if (index >= slides.length) currentSlide = 0;
        else if (index < 0) currentSlide = slides.length - 1;
        else currentSlide = index;

        track.style.transform = `translateX(-${currentSlide * 100}%)`;

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    }

    window.goToSlide = function (index) {
        showSlide(index);
        resetCarouselTimer();
    };

    window.nextSlide = function () {
        showSlide(currentSlide + 1);
        resetCarouselTimer();
    };

    window.prevSlide = function () {
        showSlide(currentSlide - 1);
        resetCarouselTimer();
    };

    function startCarouselTimer() {
        clearInterval(carouselInterval);
        carouselInterval = setInterval(() => {
            showSlide(currentSlide + 1);
        }, 3500);
    }

    function resetCarouselTimer() {
        startCarouselTimer();
    }

    if (container) {
        container.addEventListener('mouseenter', () => clearInterval(carouselInterval));
        container.addEventListener('mouseleave', () => startCarouselTimer());
        container.addEventListener('touchstart', () => clearInterval(carouselInterval), { passive: true });
        container.addEventListener('touchend', () => startCarouselTimer(), { passive: true });
    }

    startCarouselTimer();
}

document.addEventListener('DOMContentLoaded', () => {
    initCarousel();

    // For order page swipe delete
    if (typeof attachSwipeListeners === 'function') {
        attachSwipeListeners();
        const scrollBody = document.querySelector('.order-scroll-body');
        if (scrollBody) {
            scrollBody.addEventListener('scroll', closeAllSwipes);
        }
    }
});

document.addEventListener('click', function (e) {
    if (typeof closeAllSwipes === 'function' && !e.target.closest('.history-swipe-wrapper')) {
        closeAllSwipes();
    }
});

// ----- Swipe to delete (purchase history) -----
function attachSwipeListeners() {
    const wrappers = document.querySelectorAll('.history-swipe-wrapper');
    wrappers.forEach(wrapper => {
        wrapper.removeEventListener('touchstart', handleTouchStart);
        wrapper.removeEventListener('touchmove', handleTouchMove);
        wrapper.removeEventListener('touchend', handleTouchEnd);
        wrapper.removeEventListener('mousedown', handleMouseDown);
        wrapper.removeEventListener('mousemove', handleMouseMove);
        wrapper.removeEventListener('mouseup', handleMouseUp);
        wrapper.removeEventListener('mouseleave', handleMouseUp);

        wrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
        wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
        wrapper.addEventListener('touchend', handleTouchEnd, { passive: true });

        wrapper.addEventListener('mousedown', handleMouseDown);
        wrapper.addEventListener('mousemove', handleMouseMove);
        wrapper.addEventListener('mouseup', handleMouseUp);
        wrapper.addEventListener('mouseleave', handleMouseUp);
    });
}

let touchStartX = 0;
let touchCurrentX = 0;
let isSwiping = false;
let activeWrapper = null;
let activeContainer = null;
const SWIPE_THRESHOLD = 50;
const MAX_SWIPE = 80;

function handleTouchStart(e) {
    const wrapper = e.currentTarget;
    const container = wrapper.querySelector('.history-swipe-container');
    if (!container || !wrapper.parentNode) return;

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchCurrentX = touchStartX;
    isSwiping = true;
    activeWrapper = wrapper;
    activeContainer = container;
    container.style.transition = 'none';
}

function handleTouchMove(e) {
    if (!isSwiping || !activeContainer) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    let newX = Math.min(0, deltaX);
    newX = Math.max(-MAX_SWIPE, newX);
    activeContainer.style.transform = `translateX(${newX}px)`;
    touchCurrentX = touch.clientX;
    e.preventDefault();
}

function handleTouchEnd(e) {
    if (!isSwiping || !activeContainer) {
        resetSwipe();
        return;
    }
    const deltaX = touchCurrentX - touchStartX;
    if (deltaX < -SWIPE_THRESHOLD) {
        activeContainer.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
        activeContainer.style.transform = `translateX(-${MAX_SWIPE}px)`;
        activeContainer.dataset.swipeOpen = 'true';
    } else {
        activeContainer.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
        activeContainer.style.transform = 'translateX(0px)';
        activeContainer.dataset.swipeOpen = 'false';
    }
    resetSwipe();
}

let mouseDown = false;
let mouseStartX = 0;
let mouseCurrentX = 0;

function handleMouseDown(e) {
    const wrapper = e.currentTarget;
    const container = wrapper.querySelector('.history-swipe-container');
    if (!container || !wrapper.parentNode) return;
    if (e.button !== 0) return;
    mouseDown = true;
    mouseStartX = e.clientX;
    mouseCurrentX = mouseStartX;
    activeWrapper = wrapper;
    activeContainer = container;
    container.style.transition = 'none';
}

function handleMouseMove(e) {
    if (!mouseDown || !activeContainer) return;
    const deltaX = e.clientX - mouseStartX;
    let newX = Math.min(0, deltaX);
    newX = Math.max(-MAX_SWIPE, newX);
    activeContainer.style.transform = `translateX(${newX}px)`;
    mouseCurrentX = e.clientX;
}

function handleMouseUp(e) {
    if (!mouseDown || !activeContainer) {
        resetSwipeMouse();
        return;
    }
    const deltaX = mouseCurrentX - mouseStartX;
    if (deltaX < -SWIPE_THRESHOLD) {
        activeContainer.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
        activeContainer.style.transform = `translateX(-${MAX_SWIPE}px)`;
        activeContainer.dataset.swipeOpen = 'true';
    } else {
        activeContainer.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
        activeContainer.style.transform = 'translateX(0px)';
        activeContainer.dataset.swipeOpen = 'false';
    }
    resetSwipeMouse();
}

function resetSwipe() {
    isSwiping = false;
    activeWrapper = null;
    activeContainer = null;
}

function resetSwipeMouse() {
    mouseDown = false;
    activeWrapper = null;
    activeContainer = null;
}

function deleteHistoryItem(deleteBtn) {
    const container = deleteBtn.closest('.history-swipe-container');
    if (!container) return;
    const wrapper = container.closest('.history-swipe-wrapper');
    if (!wrapper) return;

    container.style.transition = 'transform 0.25s ease, opacity 0.2s ease';
    container.style.transform = 'translateX(-100%)';
    container.style.opacity = '0';

    setTimeout(() => {
        if (wrapper.parentNode) {
            wrapper.style.transition = 'height 0.25s ease, margin 0.25s ease';
            wrapper.style.height = '0px';
            wrapper.style.margin = '0';
            wrapper.style.overflow = 'hidden';
            setTimeout(() => {
                if (wrapper.parentNode) {
                    wrapper.remove();
                    const historyView = document.getElementById('view-history');
                    if (historyView) {
                        const remaining = historyView.querySelectorAll('.history-swipe-wrapper');
                        if (remaining.length === 0) {
                            const loadingText = historyView.querySelector('.loading-completed-text');
                            if (loadingText) {
                                loadingText.textContent = 'No purchase history';
                                loadingText.style.marginTop = '40px';
                            }
                        }
                    }
                }
            }, 250);
        }
    }, 300);
}

function closeAllSwipes() {
    document.querySelectorAll('.history-swipe-container[data-swipe-open="true"]').forEach(container => {
        container.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
        container.style.transform = 'translateX(0px)';
        container.dataset.swipeOpen = 'false';
    });
}
