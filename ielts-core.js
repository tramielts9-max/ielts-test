/**
 * ==========================================================================
 * IELTS PRACTICE TEST CORE ENGINE (ielts-core.js) - ENHANCED VERSION
 * Tự động hóa: Bấm giờ, Resizer 2 cột, Audio Sync, Bottom Badges,
 * Modal kết quả, Chấm điểm, AI Trợ giảng Gemini, Google Drive Storage.
 * ==========================================================================
 */

const IELTS_CONFIG = {
  AI_AND_SHEET_URL: "https://script.google.com/macros/s/AKfycby7vRFXq_YhjIEq4kN-8NLRFw2sj-7VkVEmTw6IkNkPmidEPnPtxtNkSE-HKfn5mAPfbw/exec",
  DRIVE_STORAGE_URL: "https://script.google.com/macros/s/AKfycbx5HRPHr75RLlcuXvcn1QSTmsLszIhYH6cDrKiGZS4RCoxa0l3NJF4dKWplI1sVKVoCYg/exec"
};

let seconds = 0;
let timerInterval = null;
let isTimerRunning = false;
let userFinalScore = 0;
let currentFontSize = 15;
let isReviewMode = false;

function getStorageKey() {
  const pageName = window.location.pathname.split('/').pop() || 'default_test';
  return 'ielts_state_' + pageName;
}

// ==================== QUẢN LÝ THÔNG TIN HỌC VIÊN ====================
function getSavedUserInfo() {
  return {
    name: localStorage.getItem('ielts_student_name') || '',
    email: localStorage.getItem('ielts_student_email') || ''
  };
}

function saveUserInfo(name, email) {
  if (name) localStorage.setItem('ielts_student_name', name.trim());
  if (email) localStorage.setItem('ielts_student_email', email.trim().toLowerCase());
}

function autoFillUserInfo() {
  const user = getSavedUserInfo();
  const nameInput = document.getElementById('studentNameInput');
  const emailInput = document.getElementById('studentEmailInput');
  if (nameInput && !nameInput.value && user.name) nameInput.value = user.name;
  if (emailInput && !emailInput.value && user.email) emailInput.value = user.email;
}

// ==================== XÓA HẾT ĐỂ LÀM LẠI ====================
function resetCurrentTest() {
  if (confirm("⚠️ Em có chắc chắn muốn XÓA HẾT để làm lại bài này từ đầu không?")) {
    const key = getStorageKey();
    localStorage.removeItem(key);
    window.location.href = window.location.pathname;
  }
}

// ==================== BẤM GIỜ ====================
function updateTimerDisplay() {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timerDisplay = document.getElementById('timerDisplay');
  if (timerDisplay) {
    timerDisplay.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

function startTimer() {
  if (!isTimerRunning && !isReviewMode) {
    isTimerRunning = true;
    timerInterval = setInterval(() => {
      seconds++;
      updateTimerDisplay();
      if (seconds % 5 === 0) saveStateToLocalStorage();
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
  document.querySelectorAll('audio').forEach(a => a.pause());
}

// ==================== BOTTOM BADGES & CUỘN MƯỢT ====================
function updateBottomBadgesRealtime() {
  if (!window.TEST_DATA || !window.TEST_DATA.answers) return;
  const answers = window.TEST_DATA.answers;
  for (const qKey in answers) {
    const badge = document.getElementById(`badge_${qKey}`);
    const input = document.getElementById(`${qKey}_input`);
    const radio = document.querySelector(`input[name="${qKey}"]:checked`);
    if (!badge) continue;

    let hasVal = false;
    if (input && input.value.trim() !== "") hasVal = true;
    if (radio) hasVal = true;

    if (hasVal) {
      badge.classList.add('filled');
    } else {
      badge.classList.remove('filled');
    }
  }
}

function scrollToQuestion(qId) {
  const target = document.getElementById(qId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = document.getElementById(`${qId}_input`);
    if (input) input.focus();
  }
}

// ==================== AUDIO TRACKING & CLICK TRANSCRIPT ====================
function initAudioTranscriptSync() {
  const audio = document.getElementById('mainAudioElement');
  const transcriptLines = document.querySelectorAll('.transcript-line');

  // Click vào transcript -> tua audio đến giây đó
  transcriptLines.forEach(line => {
    line.addEventListener('click', function() {
      const timeSec = parseFloat(this.getAttribute('data-time'));
      if (!isNaN(timeSec) && audio) {
        audio.currentTime = timeSec;
        audio.play();
      }
    });
  });

  // Khi audio phát -> highlight câu đang nói
  if (audio && transcriptLines.length > 0) {
    audio.addEventListener('timeupdate', function() {
      const curTime = audio.currentTime;
      let activeLine = null;

      transcriptLines.forEach(line => {
        const lineTime = parseFloat(line.getAttribute('data-time'));
        if (!isNaN(lineTime) && curTime >= lineTime) {
          activeLine = line;
        }
      });

      transcriptLines.forEach(l => l.classList.remove('playing-active'));
      if (activeLine) {
        activeLine.classList.add('playing-active');
      }
    });
  }
}

// ==================== RESIZER KÉO THẢ 2 CỘT ====================
function initResizableDivider() {
  const resizer = document.getElementById('dragResizer');
  const passageBox = document.getElementById('passageBox');
  const questionBox = document.getElementById('questionBox');
  const container = document.getElementById('mainContainer');

  if (!resizer || !passageBox || !container) return;

  let isDragging = false;

  resizer.addEventListener('mousedown', function(e) {
    isDragging = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;

    let leftPercent = (offsetLeft / containerWidth) * 100;
    if (leftPercent < 20) leftPercent = 20;
    if (leftPercent > 80) leftPercent = 80;

    passageBox.style.width = `${leftPercent}%`;
    questionBox.style.width = `calc(${100 - leftPercent}% - 14px)`;
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      resizer.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// ==================== MODAL KẾT QUẢ ====================
function toggleResultModal(show) {
  const modal = document.getElementById('resultModal');
  if (!modal) return;
  modal.style.display = show ? 'flex' : 'none';
  if (show) renderModalTable();
}

function renderModalTable() {
  if (!window.TEST_DATA || !window.TEST_DATA.answers) return;
  const answers = window.TEST_DATA.answers;
  const tbody = document.getElementById('modalTableBody');
  if (!tbody) return;

  const isSubmitted = document.getElementById('mainContainer')?.classList.contains('submitted-mode');
  let html = '';

  let idx = 1;
  for (const qKey in answers) {
    const input = document.getElementById(`${qKey}_input`);
    const radio = document.querySelector(`input[name="${qKey}"]:checked`);
    const expected = answers[qKey];
    let userVal = input ? input.value.trim() : (radio ? radio.value.trim() : '');

    let statusClass = '';
    let correctStr = Array.isArray(expected) ? expected.join(" / ") : expected;

    if (isSubmitted) {
      let isCorrect = false;
      const cleanUserVal = userVal.toLowerCase().replace(/\s+/g, ' ');
      if (Array.isArray(expected)) {
        isCorrect = expected.map(a => a.toLowerCase().trim()).includes(cleanUserVal);
      } else {
        isCorrect = (cleanUserVal === String(expected).toLowerCase().trim());
      }
      statusClass = isCorrect ? 'ans-correct-tag' : 'ans-incorrect-tag';
    }

    html += `
      <tr>
        <td><b>${idx}</b></td>
        <td class="${statusClass}">${userVal || '<i style="color:#94a3b8;">Chưa trả lời</i>'}</td>
        <td>${isSubmitted ? `<b>${correctStr}</b>` : '<span style="color:#94a3b8;">Ẩn khi đang làm</span>'}</td>
      </tr>
    `;
    idx++;
  }
  tbody.innerHTML = html;
}

// ==================== LƯU / PHỤC HỒI ====================
function saveStateToLocalStorage() {
  if (isReviewMode) return;
  try {
    const key = getStorageKey();
    const nameVal = document.getElementById('studentNameInput')?.value || '';
    const emailVal = document.getElementById('studentEmailInput')?.value || '';
    saveUserInfo(nameVal, emailVal);

    const state = {
      seconds: seconds,
      studentName: nameVal,
      studentEmail: emailVal,
      isSubmitted: document.getElementById('mainContainer')?.classList.contains('submitted-mode') || false,
      scoreText: document.getElementById('scoreText')?.innerText || '',
      inputs: {},
      thoughts: {},
      aiResponses: {}
    };

    document.querySelectorAll('input[type="text"].fill-input').forEach(i => { state.inputs[i.id] = i.value; });
    document.querySelectorAll('.thought-box textarea').forEach(t => { state.thoughts[t.id] = t.value; });
    document.querySelectorAll('.ai-response').forEach(a => {
      if (a.innerHTML.trim() !== '') state.aiResponses[a.id] = a.innerHTML;
    });

    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {}
}

function restoreStateFromLocalStorage() {
  try {
    autoFillUserInfo();
    const key = getStorageKey();
    const savedData = localStorage.getItem(key);
    if (!savedData) return;

    const state = JSON.parse(savedData);
    if (state.seconds) { seconds = state.seconds; updateTimerDisplay(); }

    if (state.inputs) {
      for (const id in state.inputs) {
        const el = document.getElementById(id);
        if (el) el.value = state.inputs[id];
      }
    }
    if (state.thoughts) {
      for (const id in state.thoughts) {
        const el = document.getElementById(id);
        if (el) el.value = state.thoughts[id];
      }
    }
    if (state.aiResponses) {
      for (const id in state.aiResponses) {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'block'; el.innerHTML = state.aiResponses[id]; }
      }
    }

    updateBottomBadgesRealtime();

    if (state.isSubmitted) {
      applySubmittedUI(state.scoreText);
      showPostSaveButton();
    }
  } catch (err) {}
}

// ==================== REVIEW MODE ====================
function restoreAttemptFromSnapshot(attempt) {
  isReviewMode = true;
  stopTimer();

  const reviewBanner = document.createElement('div');
  reviewBanner.style.cssText = "background: #fef3c7; color: #92400e; border: 1.5px solid #f59e0b; padding: 10px 16px; font-weight: 700; font-size: 14px; text-align: center; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;";
  reviewBanner.innerHTML = `
    <span>📜 ĐANG XEM LẠI BÀI (${attempt.timestamp}) — Điểm: <b>${attempt.score}</b> (Học viên: ${attempt.studentName})</span>
    <div style="display: flex; gap: 8px;">
      <button type="button" onclick="resetCurrentTest()" style="background: #ef4444; color: white; border: none; padding: 5px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer;">🔄 Làm lại bài</button>
      <a href="index.html" style="background: #b45309; color: white; padding: 5px 12px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold;">🔙 Trang chủ</a>
    </div>
  `;
  document.body.insertBefore(reviewBanner, document.body.firstChild);

  if (document.getElementById('studentNameInput')) document.getElementById('studentNameInput').value = attempt.studentName;
  if (document.getElementById('studentEmailInput')) document.getElementById('studentEmailInput').value = attempt.studentEmail;
  if (document.getElementById('timerDisplay') && attempt.timeSpent) document.getElementById('timerDisplay').innerText = attempt.timeSpent;

  if (attempt.inputs) {
    for (const id in attempt.inputs) {
      const el = document.getElementById(id);
      if (el) { el.value = attempt.inputs[id]; el.disabled = true; }
    }
  }

  if (attempt.thoughts) {
    for (const id in attempt.thoughts) {
      const el = document.getElementById(id);
      if (el) { el.value = attempt.thoughts[id]; el.disabled = true; }
    }
  }

  if (attempt.aiResponses) {
    for (const id in attempt.aiResponses) {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'block'; el.innerHTML = attempt.aiResponses[id]; }
    }
  }

  applySubmittedUI(attempt.score);
  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) submitBtn.style.display = 'none';
}

// ==================== ÁP DỤNG GIAO DIỆN NỘP BÀI (SPLIT-SCREEN) ====================
function applySubmittedUI(scoreStr) {
  const container = document.getElementById('mainContainer');
  const passageBox = document.getElementById('passageBox');
  if (container) container.classList.add('submitted-mode');
  if (passageBox) passageBox.classList.add('submitted');

  const scoreBadge = document.getElementById('scoreBadge');
  const scoreText = document.getElementById('scoreText');
  if (scoreBadge) scoreBadge.style.display = 'block';
  if (scoreText && scoreStr) scoreText.innerText = scoreStr;

  document.querySelectorAll('.explanation').forEach(exp => { exp.style.display = 'block'; });

  if (window.TEST_DATA && window.TEST_DATA.answers) {
    const answers = window.TEST_DATA.answers;
    for (const qKey in answers) {
      const qDiv = document.getElementById(qKey);
      const badge = document.getElementById(`badge_${qKey}`);
      if (!qDiv) continue;

      const resDiv = qDiv.querySelector('.result');
      const expectedAns = answers[qKey];
      const textInput = document.getElementById(`${qKey}_input`);

      let userVal = textInput ? textInput.value.trim() : "";
      const cleanUserVal = userVal.toLowerCase().replace(/\s+/g, ' ');
      let isCorrect = false;

      if (Array.isArray(expectedAns)) {
        isCorrect = expectedAns.map(a => a.toLowerCase().trim()).includes(cleanUserVal);
      } else {
        isCorrect = (cleanUserVal === String(expectedAns).toLowerCase().trim());
      }

      if (isCorrect) {
        if (resDiv) resDiv.innerHTML = "<span style='color:#16a34a; font-weight:700;'>✓ Đúng</span>";
        if (badge) { badge.classList.add('status-correct'); badge.classList.remove('status-incorrect'); }
      } else {
        const correctStr = Array.isArray(expectedAns) ? expectedAns.join(" / ") : expectedAns;
        if (resDiv) resDiv.innerHTML = `<span style='color:#dc2626; font-weight:700;'>✗ Sai (Đáp án: <b>${correctStr}</b>)</span>`;
        if (badge) { badge.classList.add('status-incorrect'); badge.classList.remove('status-correct'); }
      }
    }
  }
}

// ==================== CHẤM BÀI VÀ NỘP KẾT QUẢ ====================
async function checkAnswers() {
  if (isReviewMode) return;
  if (!window.TEST_DATA || !window.TEST_DATA.answers) return;

  const studentNameInput = document.getElementById('studentNameInput');
  const studentEmailInput = document.getElementById('studentEmailInput');
  const studentName = studentNameInput ? studentNameInput.value.trim() : "";
  const studentEmail = studentEmailInput ? studentEmailInput.value.trim().toLowerCase() : "";

  if (!studentName || !studentEmail) {
    alert("⚠️ Em vui lòng nhập đầy đủ 'Họ và Tên' và 'Email' ở góc trên trước khi nộp bài nhé!");
    return;
  }

  saveUserInfo(studentName, studentEmail);
  stopTimer();

  let score = 0;
  const answers = window.TEST_DATA.answers;
  const totalQuestions = Object.keys(answers).length;
  let detailsSummary = "";

  const snapshotInputs = {};
  const snapshotThoughts = {};
  const snapshotAI = {};

  for (const qKey in answers) {
    const qDiv = document.getElementById(qKey);
    const badge = document.getElementById(`badge_${qKey}`);
    if (!qDiv) continue;

    const resDiv = qDiv.querySelector('.result');
    const expDiv = qDiv.querySelector('.explanation');
    const thoughtInput = document.getElementById(`${qKey}_thought`);
    const thought = thoughtInput ? thoughtInput.value.trim() : '';
    if (thoughtInput) snapshotThoughts[`${qKey}_thought`] = thought;

    const expectedAns = answers[qKey];
    const textInput = document.getElementById(`${qKey}_input`);
    let userVal = textInput ? textInput.value.trim() : "";
    snapshotInputs[`${qKey}_input`] = userVal;

    const cleanUserVal = userVal.toLowerCase().replace(/\s+/g, ' ');
    let isCorrect = false;

    if (Array.isArray(expectedAns)) {
      isCorrect = expectedAns.map(a => a.toLowerCase().trim()).includes(cleanUserVal);
    } else {
      isCorrect = (cleanUserVal === String(expectedAns).toLowerCase().trim());
    }

    const aiResBox = document.getElementById(`ai_response_${qKey}`);
    if (aiResBox && aiResBox.innerHTML.trim() !== '') {
      snapshotAI[`ai_response_${qKey}`] = aiResBox.innerHTML;
    }

    if (isCorrect) {
      score++;
      if (resDiv) resDiv.innerHTML = "<span style='color:#16a34a; font-weight:700;'>✓ Đúng</span>";
      if (badge) { badge.classList.add('status-correct'); badge.classList.remove('status-incorrect'); }
    } else {
      const correctStr = Array.isArray(expectedAns) ? expectedAns.join(" / ") : expectedAns;
      if (resDiv) resDiv.innerHTML = `<span style='color:#dc2626; font-weight:700;'>✗ Sai (Đáp án: <b>${correctStr}</b>)</span>`;
      if (badge) { badge.classList.add('status-incorrect'); badge.classList.remove('status-correct'); }
    }

    if (expDiv) expDiv.style.display = "block";
    detailsSummary += `${qKey.toUpperCase()}: ${userVal || 'Trống'} | Mạch nghĩ: ${thought || 'N/A'}\n`;
  }

  userFinalScore = score;
  const timeSpentText = document.getElementById('timerDisplay')?.innerText || '00:00';
  const scoreStr = `${score}/${totalQuestions}`;

  if (document.getElementById('scoreText')) document.getElementById('scoreText').innerText = scoreStr;
  if (document.getElementById('scoreBadge')) document.getElementById('scoreBadge').style.display = 'block';

  // Chuyển sang giao diện 2 cột
  const container = document.getElementById('mainContainer');
  const passageBox = document.getElementById('passageBox');
  if (container) container.classList.add('submitted-mode');
  if (passageBox) passageBox.classList.add('submitted');

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
    thoughts: snapshotThoughts,
    aiResponses: snapshotAI
  };

  saveStateToLocalStorage();

  // Gửi Google Sheets
  if (IELTS_CONFIG.AI_AND_SHEET_URL) {
    fetch(IELTS_CONFIG.AI_AND_SHEET_URL, {
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
    }).catch(() => {});
  }

  // Gửi Google Drive
  if (IELTS_CONFIG.DRIVE_STORAGE_URL && !IELTS_CONFIG.DRIVE_STORAGE_URL.includes("DÁN_LINK")) {
    fetch(IELTS_CONFIG.DRIVE_STORAGE_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
    }).catch(() => {});
  }

  // Cập nhật Modal popup và TỰ ĐỘNG BẬT POPUP KẾT QUẢ
  const modalBand = document.getElementById('modalBandScoreText');
  const modalDetail = document.getElementById('modalScoreDetailText');
  if (modalBand) modalBand.innerText = `Điểm của bạn: ${score}/${totalQuestions}`;
  if (modalDetail) modalDetail.innerText = `Thời gian làm bài: ${timeSpentText} • Học viên: ${studentName}`;
  toggleResultModal(true);

  showPostSaveButton();
}

function showPostSaveButton() {
  if (document.getElementById('btnPostSaveContainer')) return;
  const questionBox = document.querySelector('.question-box');
  if (!questionBox) return;

  const postSaveBox = document.createElement('div');
  postSaveBox.id = 'btnPostSaveContainer';
  postSaveBox.style.cssText = "margin-top: 15px; padding: 14px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; text-align: center; display: flex; flex-direction: column; gap: 8px; align-items: center;";
  postSaveBox.innerHTML = `
    <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
      <button type="button" id="btnPostSave" onclick="savePostReviewUpdate()" style="background: #16a34a; color: white; border: none; padding: 10px 18px; font-weight: 700; font-size: 14px; border-radius: 6px; cursor: pointer;">
        💾 Lưu vào lịch sử (Bản Sau sửa)
      </button>
      <button type="button" onclick="resetCurrentTest()" style="background: #ef4444; color: white; border: none; padding: 10px 18px; font-weight: 700; font-size: 14px; border-radius: 6px; cursor: pointer;">
        🔄 Xóa hết để làm lại bài này
      </button>
    </div>
  `;
  questionBox.appendChild(postSaveBox);
}

function savePostReviewUpdate() {
  const studentEmail = document.getElementById('studentEmailInput')?.value.trim().toLowerCase() || "";
  const studentName = document.getElementById('studentNameInput')?.value.trim() || "";

  if (!studentEmail) {
    alert("⚠️ Không tìm thấy Email học viên để lưu!");
    return;
  }

  const snapshotThoughts = {};
  const snapshotAI = {};

  document.querySelectorAll('.thought-box textarea').forEach(textarea => {
    snapshotThoughts[textarea.id] = textarea.value;
  });

  document.querySelectorAll('.ai-response').forEach(aiBox => {
    if (aiBox.innerHTML.trim() !== '') snapshotAI[aiBox.id] = aiBox.innerHTML;
  });

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} - ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

  const attemptSnapshot = {
    id: "attempt_" + Date.now(),
    timestamp: timeStr + " (Sau sửa)",
    testTitle: (window.TEST_DATA.title || document.title) + " (Sau sửa)",
    pageUrl: window.location.pathname.split('/').pop(),
    studentName: studentName,
    studentEmail: studentEmail,
    score: document.getElementById('scoreText')?.innerText || '',
    timeSpent: document.getElementById('timerDisplay')?.innerText || '',
    inputs: {},
    thoughts: snapshotThoughts,
    aiResponses: snapshotAI
  };

  document.querySelectorAll('input[type="text"].fill-input').forEach(i => { attemptSnapshot.inputs[i.id] = i.value; });

  if (IELTS_CONFIG.DRIVE_STORAGE_URL && !IELTS_CONFIG.DRIVE_STORAGE_URL.includes("DÁN_LINK")) {
    fetch(IELTS_CONFIG.DRIVE_STORAGE_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
    });
  }

  alert("✅ Đã cập nhật thành công toàn bộ Mạch suy nghĩ & Chat AI mới nhất lên Google Drive!");
}

function highlightText(elementId) {
  document.querySelectorAll('.hl-active').forEach(el => el.classList.remove('hl-active'));
  const target = document.getElementById(elementId);
  if (target) {
    target.classList.add('hl-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ==================== TRỢ GIẢNG AI GEMINI ====================
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
  tempDiv.style.paddingTop = "10px";
  tempDiv.style.marginTop = "10px";
  tempDiv.innerHTML = `
    <div style="color: var(--primary-blue); font-weight: 700; font-size: 13.5px; margin-bottom: 6px;">
      💬 Thắc mắc: "${safeQuestionText}"
    </div>
    <i style="color: var(--text-muted); font-size: 13px;">⏳ AI đang đọc bài và soạn lời giải thích...</i>
  `;
  responseBox.appendChild(tempDiv);
  inputEl.value = "";

  const qDiv = document.getElementById(qId);
  let questionTextOnly = "";
  if (qDiv) {
    let cloneDiv = qDiv.cloneNode(true);
    cloneDiv.querySelectorAll('.explanation, .thought-box, .ai-assistant-box, .result').forEach(el => el.remove());
    questionTextOnly = cloneDiv.innerText.trim();
  }

  const prompt = `Bạn là giáo viên IELTS. Giải thích trực tiếp, ngắn gọn bằng tiếng Việt thắc mắc của học viên.
Dùng **từ khóa** để IN ĐẬM, ==bằng chứng== để TÔ VÀNG đoạn thông tin cốt lõi, [kw]từ khóa[/kw] để TÔ XANH LÁ CÂY.
[CÂU HỎI]: ${questionTextOnly}
[HỌC VIÊN HỎI]: ${userQuestion}`;

  try {
    const res = await fetch(IELTS_CONFIG.AI_AND_SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "ask_ai", prompt: prompt })
    });
    const data = await res.json();
    const targetEl = document.getElementById(tempId);
    if (data && data.reply && targetEl) {
      let formattedReply = data.reply
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/==(.*?)==/g, "<mark style='background-color: #fef08a; color: #854d0e; padding: 2px 5px; border-radius: 4px; font-weight: 600;'>$1</mark>")
        .replace(/\[kw\](.*?)\[\/kw\]/g, "<span style='background-color: #bbf7d0; color: #14532d; padding: 2px 6px; border-radius: 4px; font-weight: 700;'>$1</span>");

      targetEl.innerHTML = `
        <div style="color: var(--primary-blue); font-weight: 700; font-size: 13.5px; margin-bottom: 6px;">
          💬 Thắc mắc: "${safeQuestionText}"
        </div>
        <div style="font-size: 14px; line-height: 1.7; color: var(--text-main);">
          <b style="color: var(--primary-blue);">🤖 Trợ giảng AI:</b><br>${formattedReply}
        </div>
      `;
      saveStateToLocalStorage();
    }
  } catch (err) {
    const targetEl = document.getElementById(tempId);
    if (targetEl) targetEl.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Lỗi kết nối. Em bấm hỏi lại nhé!`;
  }
}

// ==================== KHỞI CHẠY HỆ THỐNG ====================
document.addEventListener('DOMContentLoaded', async function() {
  initResizableDivider();
  initAudioTranscriptSync();

  const urlParams = new URLSearchParams(window.location.search);
  const attemptId = urlParams.get('attemptId');
  const emailParam = urlParams.get('email');

  if (attemptId && emailParam && IELTS_CONFIG.DRIVE_STORAGE_URL && !IELTS_CONFIG.DRIVE_STORAGE_URL.includes("DÁN_LINK")) {
    try {
      const res = await fetch(IELTS_CONFIG.DRIVE_STORAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_single_attempt", email: emailParam, attemptId: attemptId })
      });
      const data = await res.json();
      if (data && data.attempt) {
        restoreAttemptFromSnapshot(data.attempt);
        return;
      }
    } catch (e) {}
  }

  restoreStateFromLocalStorage();

  // Lắng nghe nhập liệu để cập nhật bottom badges
  document.addEventListener('input', function() {
    updateBottomBadgesRealtime();
    saveStateToLocalStorage();
  });
});
