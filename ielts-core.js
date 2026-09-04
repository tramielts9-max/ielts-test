/**
 * ==========================================================================
 * IELTS PRACTICE TEST CORE ENGINE (ielts-core.js)
 * Tự động hóa toàn bộ: Bấm giờ, Bôi đen Highlight, Chấm điểm, AI Trợ giảng, Gửi điểm
 * Nâng cấp: Tự động lưu & Khôi phục lịch sử bài làm theo Email (Review Mode)
 * ==========================================================================
 */

// CẤU HÌNH TOÀN CỤC DÙNG CHUNG CHO TẤT CẢ CÁC BÀI TẬP
const IELTS_CONFIG = {
  GEMINI_API_KEY: "", 
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycby7vRFXq_YhjIEq4kN-8NLRFw2sj-7VkVEmTw6IkNkPmidEPnPtxtNkSE-HKfn5mAPfbw/exec"
};

// Quản lý đồng hồ bấm giờ & Cỡ chữ
let seconds = 0;
let timerInterval = null;
let isTimerRunning = false;
let userFinalScore = 0;
let currentFontSize = 15;
let isReviewMode = false;

// Lấy Key lưu trữ độc bản cho từng trang bài tập
function getStorageKey() {
  const pageName = window.location.pathname.split('/').pop() || 'default_test';
  return 'ielts_state_' + pageName;
}

// Thay đổi Cỡ chữ To/Nhỏ toàn trang
function changeFontSize(delta) {
  currentFontSize += delta;
  if (currentFontSize < 12) currentFontSize = 12;
  if (currentFontSize > 22) currentFontSize = 22;
  document.documentElement.style.setProperty('--font-size-base', currentFontSize + 'px');
  if (!isReviewMode) saveStateToLocalStorage();
}

// Bật/Tắt Chế độ Tối (Dark Mode)
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) {
    if (document.body.classList.contains('dark-theme')) {
      btnTheme.innerText = "☀️ Chế độ sáng";
    } else {
      btnTheme.innerText = "🌙 Chế độ tối";
    }
  }
  if (!isReviewMode) saveStateToLocalStorage();
}

function updateTimerDisplay() {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timerDisplay = document.getElementById('timerDisplay');
  if (timerDisplay) {
    timerDisplay.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (mins >= 20) {
      timerDisplay.classList.add('timer-overtime');
    }
  }
}

function startTimer() {
  if (!isTimerRunning && !isReviewMode) {
    isTimerRunning = true;
    timerInterval = setInterval(() => {
      seconds++;
      updateTimerDisplay();
      if (seconds % 5 === 0) {
        saveStateToLocalStorage();
      }
    }, 1000);
  }
}

function pauseTimer() {
  if (isTimerRunning) {
    isTimerRunning = false;
    clearInterval(timerInterval);
    if (!isReviewMode) saveStateToLocalStorage();
  }
}

function stopTimer() {
  pauseTimer();
}

// TỰ ĐỘNG LƯU TRẠNG THÁI HIỆN TẠI VÀO LOCALSTORAGE
function saveStateToLocalStorage() {
  if (isReviewMode) {
    // Nếu đang ở Review Mode, tự động cập nhật Mạch suy nghĩ & Chat AI vào Lịch sử
    const urlParams = new URLSearchParams(window.location.search);
    const attemptId = urlParams.get('attemptId');
    const studentEmailParam = urlParams.get('email');
    if (attemptId && studentEmailParam) {
      const db = getHistoryDatabase();
      const emailKey = studentEmailParam.toLowerCase().trim();
      const userAttempts = db[emailKey] || [];
      const matchedAttempt = userAttempts.find(a => a.id === attemptId);
      if (matchedAttempt) {
        document.querySelectorAll('.thought-box textarea').forEach(textarea => {
          if (!matchedAttempt.thoughts) matchedAttempt.thoughts = {};
          matchedAttempt.thoughts[textarea.id] = textarea.value;
        });
        document.querySelectorAll('.ai-response').forEach(aiBox => {
          if (aiBox.innerHTML.trim() !== '') {
            if (!matchedAttempt.aiResponses) matchedAttempt.aiResponses = {};
            matchedAttempt.aiResponses[aiBox.id] = aiBox.innerHTML;
          }
        });
        localStorage.setItem('ielts_history_database', JSON.stringify(db));
      }
    }
    return;
  }
  try {
    const key = getStorageKey();
    const state = {
      seconds: seconds,
      studentName: document.getElementById('studentNameInput') ? document.getElementById('studentNameInput').value : '',
      studentEmail: document.getElementById('studentEmailInput') ? document.getElementById('studentEmailInput').value : '',
      isDarkTheme: document.body.classList.contains('dark-theme'),
      fontSize: currentFontSize,
      isSubmitted: document.getElementById('passageBox') ? document.getElementById('passageBox').classList.contains('submitted') : false,
      scoreText: document.getElementById('scoreText') ? document.getElementById('scoreText').innerText : '',
      inputs: {},
      radios: {},
      thoughts: {},
      aiResponses: {}
    };

    document.querySelectorAll('input[type="text"].fill-input').forEach(input => {
      state.inputs[input.id] = input.value;
    });

    document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
      state.radios[radio.name] = radio.value;
    });

    document.querySelectorAll('.thought-box textarea').forEach(textarea => {
      state.thoughts[textarea.id] = textarea.value;
    });

    document.querySelectorAll('.ai-response').forEach(aiBox => {
      if (aiBox.innerHTML.trim() !== '') {
        state.aiResponses[aiBox.id] = aiBox.innerHTML;
      }
    });

    localStorage.setItem(key, JSON.stringify(state));

    const saveIndicator = document.getElementById('saveIndicator');
    if (saveIndicator) {
      saveIndicator.style.display = 'inline-block';
      saveIndicator.innerText = '✓ Đã tự động lưu';
    }
  } catch (err) {
    console.warn("Không thể lưu localStorage:", err);
  }
}

// QUẢN LÝ DATABASE LỊCH SỬ THEO EMAIL (STORAGE DATABASE)
function getHistoryDatabase() {
  try {
    const raw = localStorage.getItem('ielts_history_database');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveAttemptToHistoryDatabase(attemptData) {
  try {
    const db = getHistoryDatabase();
    const email = attemptData.studentEmail.toLowerCase().trim();
    if (!email) return;

    if (!db[email]) db[email] = [];
    // Thêm lần nộp bài mới lên đầu danh sách
    db[email].unshift(attemptData);

    localStorage.setItem('ielts_history_database', JSON.stringify(db));
  } catch (e) {
    console.warn("Không thể lưu vào history database:", e);
  }
}

// KHÔI PHỤC TOÀN BỘ TRẠNG THÁI BÀI LÀM CŨ NẾU MỞ TRANG THƯỜNG
function restoreStateFromLocalStorage() {
  try {
    const key = getStorageKey();
    const savedData = localStorage.getItem(key);
    if (!savedData) return;

    const state = JSON.parse(savedData);

    if (state.seconds) {
      seconds = state.seconds;
      updateTimerDisplay();
    }

    if (state.studentName && document.getElementById('studentNameInput')) {
      document.getElementById('studentNameInput').value = state.studentName;
    }
    if (state.studentEmail && document.getElementById('studentEmailInput')) {
      document.getElementById('studentEmailInput').value = state.studentEmail;
    }

    if (state.isDarkTheme) {
      document.body.classList.add('dark-theme');
      const btnTheme = document.getElementById('btnThemeToggle');
      if (btnTheme) btnTheme.innerText = "☀️ Chế độ sáng";
    }
    if (state.fontSize) {
      currentFontSize = state.fontSize;
      document.documentElement.style.setProperty('--font-size-base', currentFontSize + 'px');
    }

    if (state.inputs) {
      for (const inputId in state.inputs) {
        const el = document.getElementById(inputId);
        if (el) el.value = state.inputs[inputId];
      }
    }

    if (state.radios) {
      for (const radioName in state.radios) {
        const val = state.radios[radioName];
        const radioEl = document.querySelector(`input[name="${radioName}"][value="${val}"]`);
        if (radioEl) radioEl.checked = true;
      }
    }

    if (state.thoughts) {
      for (const textareaId in state.thoughts) {
        const el = document.getElementById(textareaId);
        if (el) el.value = state.thoughts[textareaId];
      }
    }

    if (state.aiResponses) {
      for (const boxId in state.aiResponses) {
        const el = document.getElementById(boxId);
        if (el) {
          el.style.display = 'block';
          el.innerHTML = state.aiResponses[boxId];
        }
      }
    }

if (state.isSubmitted) {
      applySubmittedUI(state.scoreText);
      showPostSaveButton();
    }
  } catch (err) {
    console.warn("Không thể khôi phục localStorage:", err);
  }
}

// KHÔI PHỤC TOÀN BỘ BỨC ẢNH LẦN NỘP BÀI QUÁ KHỨ (CHẾ ĐỘ XEM LẠI LỊCH SỬ - REVIEW MODE)
function restoreAttemptFromSnapshot(attempt) {
  isReviewMode = true;
  stopTimer();

  // Tạo thanh thông báo Review Mode
  const reviewBanner = document.createElement('div');
  reviewBanner.style.cssText = "background: #f59e0b; color: #78350f; padding: 10px 16px; font-weight: 700; font-size: 14px; text-align: center; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;";
  reviewBanner.innerHTML = `
    <span>📜 ĐANG XEM LẠI LỊCH SỬ BÀI LÀM (${attempt.timestamp}) — Điểm: ${attempt.score} (Học viên: ${attempt.studentName})</span>
    <a href="index.html" style="background: #78350f; color: white; padding: 4px 12px; text-decoration: none; border-radius: 4px; font-size: 13px;">🔙 Quay lại Danh mục Lịch sử</a>
  `;
  document.body.insertBefore(reviewBanner, document.body.firstChild);

  // Điền Họ tên & Email
  if (document.getElementById('studentNameInput')) document.getElementById('studentNameInput').value = attempt.studentName;
  if (document.getElementById('studentEmailInput')) document.getElementById('studentEmailInput').value = attempt.studentEmail;

  // Thời gian
  const timerDisplay = document.getElementById('timerDisplay');
  if (timerDisplay && attempt.timeSpent) timerDisplay.innerText = attempt.timeSpent;

  // Ô điền từ
  if (attempt.inputs) {
    for (const inputId in attempt.inputs) {
      const el = document.getElementById(inputId);
      if (el) {
        el.value = attempt.inputs[inputId];
        el.disabled = true;
      }
    }
  }

  // Radio chọn
  if (attempt.radios) {
    for (const radioName in attempt.radios) {
      const val = attempt.radios[radioName];
      const radioEl = document.querySelector(`input[name="${radioName}"][value="${val}"]`);
      if (radioEl) {
        radioEl.checked = true;
      }
    }
    document.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
  }

// Mạch suy nghĩ
  if (attempt.thoughts) {
    for (const textareaId in attempt.thoughts) {
      const el = document.getElementById(textareaId);
      if (el) {
        el.value = attempt.thoughts[textareaId];
      }
    }
  }

  // Phản hồi AI
  if (attempt.aiResponses) {
    for (const boxId in attempt.aiResponses) {
      const el = document.getElementById(boxId);
      if (el) {
        el.style.display = 'block';
        el.innerHTML = attempt.aiResponses[boxId];
      }
    }
  }

  // Bật giao diện đã nộp bài & Lời giải
  applySubmittedUI(attempt.score);

  // Ẩn nút nộp bài
  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) submitBtn.style.display = 'none';
}

function applySubmittedUI(scoreStr) {
  const passageBox = document.getElementById('passageBox');
  if (passageBox) passageBox.classList.add('submitted');
  
  const scoreBadge = document.getElementById('scoreBadge');
  const scoreText = document.getElementById('scoreText');
  if (scoreBadge) scoreBadge.style.display = 'block';
  if (scoreText && scoreStr) scoreText.innerText = scoreStr;

  document.querySelectorAll('.explanation').forEach(exp => {
    exp.style.display = 'block';
  });

  if (window.TEST_DATA && window.TEST_DATA.answers) {
    const answers = window.TEST_DATA.answers;
    for (const qKey in answers) {
      const qDiv = document.getElementById(qKey);
      if (!qDiv) continue;
      const resDiv = qDiv.querySelector('.result');
      const expectedAns = answers[qKey];
      const radioSelected = qDiv.querySelector(`input[name="${qKey}"]:checked`);
      const textInput = document.getElementById(`${qKey}_input`);

      let userVal = "";
      let isCorrect = false;
      if (radioSelected) {
        userVal = radioSelected.value.trim();
        isCorrect = (userVal.toUpperCase() === expectedAns.toUpperCase());
      } else if (textInput) {
        userVal = textInput.value.trim();
        const cleanUserVal = userVal.toLowerCase().replace(/\s+/g, ' ');
        if (Array.isArray(expectedAns)) {
          isCorrect = expectedAns.map(a => a.toLowerCase().trim()).includes(cleanUserVal);
        } else {
          isCorrect = (cleanUserVal === expectedAns.toLowerCase().trim());
        }
      }

      if (isCorrect) {
        if (resDiv) resDiv.innerHTML = "<span class='correct-text'>✓ Đúng</span>";
        qDiv.classList.add('correct-border');
      } else {
        const correctStr = Array.isArray(expectedAns) ? expectedAns.join(" / ") : expectedAns;
        if (resDiv) resDiv.innerHTML = `<span class='incorrect-text'>✗ Sai (Đáp án đúng: <b>${correctStr}</b>)</span>`;
        qDiv.classList.add('incorrect-border');
      }
    }
  }
}

// NÚT LÀM LẠI BÀI (XÓA SẠCH DỮ LIỆU ĐỂ BẮT ĐẦU PHIÊN BẢN MỚI)
function resetTestProgress() {
  if (confirm("⚠️ Bạn có chắc chắn muốn xóa toàn bộ kết quả bài làm trang này để BẮT ĐẦU PHIÊN BẢN MỚI không?")) {
    const key = getStorageKey();
    localStorage.removeItem(key);
    
    // Xóa thêm cache tạm nếu có
    const currentPath = window.location.pathname;
    document.querySelectorAll('.ai-response').forEach(box => {
      const qId = box.id.replace("ai_response_", "");
      localStorage.removeItem(`ai_chat_${currentPath}_${qId}`);
    });

    window.location.href = window.location.pathname;
  }
}

// Xử lý Highlight tương tác người dùng
let currentSelectedRange = null;
let currentTargetSpan = null;

document.addEventListener('DOMContentLoaded', function() {
  // 1. Tự động chèn Nút Control vào Header
  const headerBar = document.querySelector('.header-bar');
  if (headerBar && !document.getElementById('btnThemeToggle')) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'header-controls';
    controlsDiv.innerHTML = `
      <span id="saveIndicator" style="font-size: 12px; background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 4px 10px; border-radius: 20px; font-weight: 600;">✓ Đã tự động lưu</span>
      <button class="btn-header" onclick="changeFontSize(-1)">🔍 A-</button>
      <button class="btn-header" onclick="changeFontSize(1)">🔍 A+</button>
      <button class="btn-header" id="btnThemeToggle" onclick="toggleTheme()">🌙 Chế độ tối</button>
      <button class="btn-header" style="background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4);" onclick="resetTestProgress()">🗑️ Làm lại bài</button>
    `;
    headerBar.appendChild(controlsDiv);
  }

  // 2. Tự động chèn Thanh kéo Kích thước 2 cột (Resizable Drag Bar)
  const container = document.querySelector('.container');
  const passageBox = document.getElementById('passageBox');
  const questionBox = document.querySelector('.question-box');

  if (container && passageBox && questionBox && !document.getElementById('dragResizer')) {
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    resizer.id = 'dragResizer';
    container.insertBefore(resizer, questionBox);

    let isResizing = false;

    resizer.addEventListener('mousedown', function(e) {
      isResizing = true;
      resizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      const containerRect = container.getBoundingClientRect();
      let pointerRelativeX = e.clientX - containerRect.left;
      let minWidthPx = 250;
      let maxWidthPx = containerRect.width - 250;

      if (pointerRelativeX < minWidthPx) pointerRelativeX = minWidthPx;
      if (pointerRelativeX > maxWidthPx) pointerRelativeX = maxWidthPx;

      let passageWidthPercent = (pointerRelativeX / containerRect.width) * 100;
      passageBox.style.width = passageWidthPercent + '%';
      questionBox.style.width = (100 - passageWidthPercent) + '%';
    });

    document.addEventListener('mouseup', function() {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    });
  }

  // 3. ĐIỀU HƯỚNG: KIỂM TRA XEM CÓ PHẢI ĐANG XEM LẠI LỊCH SỬ (REVIEW MODE) HAY KHÔNG
  const urlParams = new URLSearchParams(window.location.search);
  const attemptId = urlParams.get('attemptId');
  const studentEmailParam = urlParams.get('email');

  if (attemptId && studentEmailParam) {
    const db = getHistoryDatabase();
    const userAttempts = db[studentEmailParam.toLowerCase().trim()] || [];
    const matchedAttempt = userAttempts.find(a => a.id === attemptId);
    if (matchedAttempt) {
      restoreAttemptFromSnapshot(matchedAttempt);
    } else {
      restoreStateFromLocalStorage();
    }
  } else {
    restoreStateFromLocalStorage();
  }

  // 4. Theo dõi thao tác người dùng để tự động lưu
  if (!isReviewMode) {
    document.addEventListener('input', saveStateToLocalStorage);
    document.addEventListener('change', saveStateToLocalStorage);
  }

  // 5. Xử lý Popup bôi đen
  const hlPopup = document.getElementById('hlPopup');
  const removeHlPopup = document.getElementById('removeHlPopup');

  if (hlPopup && removeHlPopup) {
    document.addEventListener('mouseup', function(e) {
      if (hlPopup.contains(e.target) || removeHlPopup.contains(e.target)) return;
      const selection = window.getSelection();

      if (e.target.classList.contains('user-highlight')) {
        currentTargetSpan = e.target;
        hlPopup.style.display = 'none';
        removeHlPopup.style.left = (e.pageX + 5) + 'px';
        removeHlPopup.style.top = (e.pageY - 35) + 'px';
        removeHlPopup.style.display = 'block';
        return;
      } else {
        removeHlPopup.style.display = 'none';
      }

      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
        currentSelectedRange = selection.getRangeAt(0);
        hlPopup.style.left = (e.pageX + 5) + 'px';
        hlPopup.style.top = (e.pageY - 35) + 'px';
        hlPopup.style.display = 'block';
      } else {
        hlPopup.style.display = 'none';
      }
    });

    const btnDoHighlight = document.getElementById('btnDoHighlight');
    if (btnDoHighlight) {
      btnDoHighlight.addEventListener('click', function() {
        if (currentSelectedRange) {
          const span = document.createElement('span');
          span.className = 'user-highlight';
          try {
            currentSelectedRange.surroundContents(span);
          } catch (e) {
            console.warn("Không thể bôi đen trên nhiều phần tử phức tạp");
          }
          window.getSelection().removeAllRanges();
          hlPopup.style.display = 'none';
          currentSelectedRange = null;
        }
      });
    }

    const btnRemoveHighlight = document.getElementById('btnRemoveHighlight');
    if (btnRemoveHighlight) {
      btnRemoveHighlight.addEventListener('click', function() {
        if (currentTargetSpan) {
          const parent = currentTargetSpan.parentNode;
          while (currentTargetSpan.firstChild) {
            parent.insertBefore(currentTargetSpan.firstChild, currentTargetSpan);
          }
          parent.removeChild(currentTargetSpan);
          removeHlPopup.style.display = 'none';
          currentTargetSpan = null;
        }
      });
    }
  }

  // Tự động bật timer khi tương tác
  document.body.addEventListener('click', function() {
    if (!isTimerRunning && seconds === 0 && !isReviewMode) {
      startTimer();
    }
}, { once: true });

  // Tự động "đánh thức" server ngay khi học viên vừa mở trang web
  if (IELTS_CONFIG.GOOGLE_SCRIPT_URL) {
    fetch(IELTS_CONFIG.GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "ping" })
    }).catch(() => {});
  }
});

// Định vị đoạn văn chứa đáp án trong bài đọc
function highlightText(elementId) {
  document.querySelectorAll('.hl-active').forEach(el => el.classList.remove('hl-active'));
  const target = document.getElementById(elementId);
  if (target) {
    target.classList.add('hl-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// CHẤM ĐIỂM VÀ LƯU BỨC ẢNH VÀO DATABASE LỊCH SỬ CỦA EMAIL
async function checkAnswers() {
  if (isReviewMode) return;
  if (!window.TEST_DATA || !window.TEST_DATA.answers) {
    alert("Lỗi cấu hình: Chưa khai báo TEST_DATA.answers cho bài tập này!");
    return;
  }

  const studentNameInput = document.getElementById('studentNameInput');
  const studentEmailInput = document.getElementById('studentEmailInput');
  const studentName = studentNameInput ? studentNameInput.value.trim() : "";
  const studentEmail = studentEmailInput ? studentEmailInput.value.trim() : "";

  if (!studentName || !studentEmail) {
    alert("⚠️ Em vui lòng nhập đầy đủ 'Họ và Tên' và 'Email' ở góc trên trước khi nộp bài nhé!");
    return;
  }

  stopTimer();
  let score = 0;
  const answers = window.TEST_DATA.answers;
  const totalQuestions = Object.keys(answers).length;
  let detailsSummary = "";

  const passageBox = document.getElementById('passageBox');
  if (passageBox) {
    passageBox.classList.add('submitted');
  }

  const snapshotInputs = {};
  const snapshotRadios = {};
  const snapshotThoughts = {};
  const snapshotAI = {};

  for (const qKey in answers) {
    const qDiv = document.getElementById(qKey);
    if (!qDiv) continue;

    const resDiv = qDiv.querySelector('.result');
    const expDiv = qDiv.querySelector('.explanation');
    const thoughtInput = document.getElementById(`${qKey}_thought`);
    const thought = thoughtInput ? thoughtInput.value.trim() : '';

    if (thoughtInput) snapshotThoughts[`${qKey}_thought`] = thought;

    qDiv.classList.remove('correct-border', 'incorrect-border');

    let userVal = "";
    let isCorrect = false;
    const expectedAns = answers[qKey];

    const radioSelected = qDiv.querySelector(`input[name="${qKey}"]:checked`);
    const textInput = document.getElementById(`${qKey}_input`);

    if (radioSelected) {
      userVal = radioSelected.value.trim();
      snapshotRadios[qKey] = userVal;
      isCorrect = (userVal.toUpperCase() === expectedAns.toUpperCase());
    } else if (textInput) {
      userVal = textInput.value.trim();
      snapshotInputs[`${qKey}_input`] = userVal;
      const cleanUserVal = userVal.toLowerCase().replace(/\s+/g, ' ');

      if (Array.isArray(expectedAns)) {
        isCorrect = expectedAns.map(a => a.toLowerCase().trim()).includes(cleanUserVal);
      } else {
        isCorrect = (cleanUserVal === expectedAns.toLowerCase().trim());
      }
    }

    const aiResBox = document.getElementById(`ai_response_${qKey}`);
    if (aiResBox && aiResBox.innerHTML.trim() !== '') {
      snapshotAI[`ai_response_${qKey}`] = aiResBox.innerHTML;
    }

    if (isCorrect) {
      score++;
      if (resDiv) resDiv.innerHTML = "<span class='correct-text'>✓ Đúng</span>";
      qDiv.classList.add('correct-border');
    } else {
      const correctStr = Array.isArray(expectedAns) ? expectedAns.join(" / ") : expectedAns;
      if (resDiv) resDiv.innerHTML = `<span class='incorrect-text'>✗ Sai (Đáp án đúng: <b>${correctStr}</b>)</span>`;
      qDiv.classList.add('incorrect-border');
    }

    if (expDiv) expDiv.style.display = "block";
    detailsSummary += `${qKey.toUpperCase()}: ${userVal || 'Để trống'} | Suy nghĩ: ${thought || 'N/A'}\n`;
  }

  userFinalScore = score;
  const timeSpentText = document.getElementById('timerDisplay') ? document.getElementById('timerDisplay').innerText : '00:00';
  
  const scoreText = document.getElementById('scoreText');
  const scoreBadge = document.getElementById('scoreBadge');
  const scoreStr = `${score}/${totalQuestions}`;
  if (scoreText) scoreText.innerText = scoreStr;
  if (scoreBadge) scoreBadge.style.display = 'block';

  // LƯU BỨC ẢNH CHI TIẾT LẦN NỘP NÀY VÀO DATABASE LỊCH SỬ DÀNH RIÊNG CHO EMAIL NÀY
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} - ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  
  const attemptSnapshot = {
    id: "attempt_" + Date.now(),
    timestamp: timeStr,
    testTitle: window.TEST_DATA.title || document.title,
    pageUrl: window.location.pathname.split('/').pop(),
    studentName: studentName,
    studentEmail: studentEmail,
    score: scoreStr,
    timeSpent: timeSpentText,
    inputs: snapshotInputs,
    radios: snapshotRadios,
    thoughts: snapshotThoughts,
    aiResponses: snapshotAI
  };

  saveAttemptToHistoryDatabase(attemptSnapshot);
  saveStateToLocalStorage();

  // Gửi kết quả về Google Sheets
  if (IELTS_CONFIG.GOOGLE_SCRIPT_URL) {
    try {
      await fetch(IELTS_CONFIG.GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          action: "submit_score",
          testTitle: window.TEST_DATA.title || document.title,
          studentName: studentName,
          studentEmail: studentEmail,
          score: scoreStr,
          timeSpent: timeSpentText,
          details: detailsSummary
        })
      });
      alert(`🎉 Chúc mừng ${studentName}! Bài làm đạt ${scoreStr} câu. Kết quả đã được lưu về hệ thống!`);
} catch (err) {
      console.error("Lỗi gửi điểm:", err);
      alert(`Bài làm đạt ${scoreStr} câu!`);
    }
  }

  // TỰ ĐỘNG HIỆN NÚT LƯU BỔ SUNG SAU KHI NỘP BÀI
  showPostSaveButton();
}

// NÚT LƯU CẬP NHẬT (SAU KHI HỎI AI VÀ SỬA MẠCH SUY NGHĨ)
function showPostSaveButton() {
  if (document.getElementById('btnPostSave')) return;

  const actionBar = document.querySelector('.action-bar') || document.querySelector('.question-box');
  if (!actionBar) return;

  const postSaveBox = document.createElement('div');
  postSaveBox.id = 'btnPostSaveContainer';
  postSaveBox.style.cssText = "margin-top: 15px; padding: 12px; background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 8px; text-align: center;";
  postSaveBox.innerHTML = `
    <button type="button" id="btnPostSave" onclick="savePostReviewUpdate()" style="background: #16a34a; color: white; border: none; padding: 10px 20px; font-weight: 700; font-size: 14.5px; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
      💾 Lưu vào lịch sử bài làm (Bản Sau sửa)
    </button>
    <p style="margin: 6px 0 0 0; font-size: 13px; color: #15803d; font-style: italic;">
      💡 Chú thích: Hãy bấm nút này sau khi em đã hỏi AI xong và điền đầy đủ Mạch suy nghĩ để lưu trọn vẹn vào Lịch sử nhé!
    </p>
  `;
  actionBar.appendChild(postSaveBox);
}

function savePostReviewUpdate() {
  const studentEmailInput = document.getElementById('studentEmailInput');
  const email = studentEmailInput ? studentEmailInput.value.trim().toLowerCase() : "";

  if (!email) {
    alert("⚠️ Không tìm thấy Email học viên để lưu!");
    return;
  }

  const db = getHistoryDatabase();
  const userAttempts = db[email] || [];
  if (userAttempts.length === 0) {
    alert("⚠️ Em chưa nộp bài lần nào để ghi nhận lịch sử!");
    return;
  }

  // Thu thập Mạch suy nghĩ và Chat AI hiện tại
  const snapshotThoughts = {};
  const snapshotAI = {};

  document.querySelectorAll('.thought-box textarea').forEach(textarea => {
    snapshotThoughts[textarea.id] = textarea.value;
  });

  document.querySelectorAll('.ai-response').forEach(aiBox => {
    if (aiBox.innerHTML.trim() !== '') {
      snapshotAI[aiBox.id] = aiBox.innerHTML;
    }
  });

  // Cập nhật bản gần nhất hoặc tạo bản "Sau sửa"
  const latestAttempt = userAttempts[0];
  latestAttempt.thoughts = snapshotThoughts;
  latestAttempt.aiResponses = snapshotAI;
  
  if (!latestAttempt.testTitle.includes("(Sau sửa)")) {
    latestAttempt.testTitle += " (Sau sửa)";
  }

  localStorage.setItem('ielts_history_database', JSON.stringify(db));
  saveStateToLocalStorage();

  alert("✅ Đã cập nhật thành công toàn bộ Mạch suy nghĩ & Chat AI mới nhất vào Lịch sử làm bài!");
}

// BỘ LỌC TẬN GỐC CÁC THẺ NHÃN VÀ THẮC MẮC LẶP LẠI
function cleanMetaThoughts(text) {
  if (!text) return "";
  let clean = text;
  clean = clean.replace(/\[THẮC MẮC CỦA HỌC VIÊN\]:\s*".*?"/gi, "");
  clean = clean.replace(/\[THÔNG TIN CÂU HỎI\]:.*/gi, "");
  clean = clean.replace(/💬 Trả lời:/gi, "");
  if (clean.includes("Check constraints:") || clean.includes("Self-Correction")) {
    const parts = clean.split(/(Check constraints:|Self-Correction|Proceeds|Output Generation)/i);
    clean = parts[0];
  }
  return clean.trim();
}

// AI TRỢ GIẢNG
async function askGeminiAI(qId) {
  if (isReviewMode) {
    alert("Bạn đang ở chế độ xem lại lịch sử.");
    return;
  }
  const inputEl = document.getElementById(`ai_ask_${qId}`);
  const responseBox = document.getElementById(`ai_response_${qId}`);
  if (!inputEl || !responseBox) return;

  const userQuestion = inputEl.value.trim();
  if (!userQuestion) {
    alert("Vui lòng gõ thắc mắc của em trước khi bấm hỏi nhé!");
    return;
  }

  responseBox.style.display = "block";

  const safeQuestionText = userQuestion.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const tempId = "temp_" + Date.now();
  const tempDiv = document.createElement('div');
  tempDiv.id = tempId;
  tempDiv.style.borderTop = "1px dashed var(--border-color)";
  tempDiv.style.paddingTop = "12px";
  tempDiv.style.marginTop = "12px";
  tempDiv.innerHTML = `
    <div style="color: var(--primary-blue); font-weight: 700; font-size: 1.05em; margin-bottom: 6px; background: #e0f2fe; padding: 6px 12px; border-radius: 6px; border-left: 4px solid var(--primary-blue);">
      💬 Thắc mắc: "${safeQuestionText}"
    </div>
    <i style="color: var(--text-muted); font-size: 0.95em;">⏳ AI đang đọc bài và soạn lời giải thích...</i>
  `;
  
  responseBox.appendChild(tempDiv);
  tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  inputEl.value = "";

  const qDiv = document.getElementById(qId);
  let questionTextOnly = "";
  if (qDiv) {
    let cloneDiv = qDiv.cloneNode(true);
    cloneDiv.querySelectorAll('.explanation, .thought-box, .ai-assistant-box, .result').forEach(el => el.remove());
    questionTextOnly = cloneDiv.innerText.trim();
  }

const prompt = `Trợ giảng IELTS Reading: Giải thích ngắn gọn, đi thẳng vào vấn đề.
Dùng **từ khóa** in đậm, ==bằng chứng== tô vàng đoạn văn.

[CÂU HỎI]: ${questionTextOnly}
[HỌC VIÊN HỎI]: ${userQuestion}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(IELTS_CONFIG.GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      signal: controller.signal,
      body: JSON.stringify({
        action: "ask_ai",
        prompt: prompt
      })
    });

    clearTimeout(timeoutId);
    const data = await res.json();
    const targetEl = document.getElementById(tempId);

    if (data && data.reply && targetEl) {
      let cleanedReply = cleanMetaThoughts(data.reply);
      
      let formattedReply = cleanedReply
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/==(.*?)==/g, "<mark style='background-color: #fef08a; color: #854d0e; padding: 2px 5px; border-radius: 4px; font-weight: 600;'>$1</mark>")
        .replace(/\[kw\](.*?)\[\/kw\]/g, "<span style='background-color: #bbf7d0; color: #14532d; padding: 2px 6px; border-radius: 4px; font-weight: 700;'>$1</span>");

      targetEl.innerHTML = `
        <div style="color: var(--primary-blue); font-weight: 700; font-size: 1.05em; margin-bottom: 8px; background: #e0f2fe; padding: 6px 12px; border-radius: 6px; border-left: 4px solid var(--primary-blue);">
          💬 Thắc mắc: "${safeQuestionText}"
        </div>
        <div style="font-size: 1em; line-height: 1.7; color: var(--text-main);">
          <b style="color: var(--primary-blue);">🤖 Trợ giảng AI:</b><br>${formattedReply}
        </div>
      `;
targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      saveStateToLocalStorage();

    } else if (targetEl) {
      targetEl.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Phản hồi trống, em thử gửi lại nhé!`;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const targetEl = document.getElementById(tempId);
    if (targetEl) {
      if (err.name === 'AbortError') {
        targetEl.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Kết nối quá thời gian cho phép (Timeout 90s). Vui lòng bấm gửi lại!`;
      } else {
        console.error("Lỗi gọi Apps Script:", err);
        targetEl.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Lỗi kết nối đến server. Em bấm thử lại lần nữa nhé!`;
      }
    }
  }
}
