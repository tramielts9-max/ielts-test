/**
 * ==========================================================================
 * IELTS PRACTICE TEST CORE ENGINE (ielts-core.js)
 * Tự động hóa toàn bộ: Bấm giờ, Bôi đen Highlight, Chấm điểm, AI Trợ giảng, Gửi điểm
 * Nâng cấp: Tự động lưu & Khôi phục trạng thái làm bài 100% qua localStorage
 * Nút: Resizer 2 cột, Dark Mode, Font controls, Nút Làm lại bài
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

// Lấy Key lưu trữ độc bản cho từng trang bài tập (Ví dụ: ielts_state_cam21-test4-p1.html)
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
  saveStateToLocalStorage();
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
  saveStateToLocalStorage();
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
  if (!isTimerRunning) {
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
    saveStateToLocalStorage();
  }
}

function stopTimer() {
  pauseTimer();
}

// TỰ ĐỘNG LƯU TOÀN BỘ TRẠNG THÁI VÀO LOCALSTORAGE
function saveStateToLocalStorage() {
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

    // Lưu các ô điền từ
    document.querySelectorAll('input[type="text"].fill-input').forEach(input => {
      state.inputs[input.id] = input.value;
    });

    // Lưu các nút chọn Radio
    document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
      state.radios[radio.name] = radio.value;
    });

    // Lưu suy nghĩ của học sinh
    document.querySelectorAll('.thought-box textarea').forEach(textarea => {
      state.thoughts[textarea.id] = textarea.value;
    });

    // Lưu phản hồi từ AI
    document.querySelectorAll('.ai-response').forEach(aiBox => {
      if (aiBox.innerHTML.trim() !== '') {
        state.aiResponses[aiBox.id] = aiBox.innerHTML;
      }
    });

    localStorage.setItem(key, JSON.stringify(state));

    // Cập nhật tín hiệu "Đã lưu" trên Header
    const saveIndicator = document.getElementById('saveIndicator');
    if (saveIndicator) {
      saveIndicator.style.display = 'inline-block';
      saveIndicator.innerText = '✓ Đã tự động lưu';
    }
  } catch (err) {
    console.warn("Không thể lưu localStorage:", err);
  }
}

// KHÔI PHỤC TOÀN BỘ TRẠNG THÁI KHI HỌC SINH QUAY LẠI TRANG
function restoreStateFromLocalStorage() {
  try {
    const key = getStorageKey();
    const savedData = localStorage.getItem(key);
    if (!savedData) return;

    const state = JSON.parse(savedData);

    // 1. Khôi phục thời gian
    if (state.seconds) {
      seconds = state.seconds;
      updateTimerDisplay();
    }

    // 2. Khôi phục Họ tên & Email
    if (state.studentName && document.getElementById('studentNameInput')) {
      document.getElementById('studentNameInput').value = state.studentName;
    }
    if (state.studentEmail && document.getElementById('studentEmailInput')) {
      document.getElementById('studentEmailInput').value = state.studentEmail;
    }

    // 3. Khôi phục Giao diện Tối/Sáng & Cỡ chữ
    if (state.isDarkTheme) {
      document.body.classList.add('dark-theme');
      const btnTheme = document.getElementById('btnThemeToggle');
      if (btnTheme) btnTheme.innerText = "☀️ Chế độ sáng";
    }
    if (state.fontSize) {
      currentFontSize = state.fontSize;
      document.documentElement.style.setProperty('--font-size-base', currentFontSize + 'px');
    }

    // 4. Khôi phục các ô Điền từ
    if (state.inputs) {
      for (const inputId in state.inputs) {
        const el = document.getElementById(inputId);
        if (el) el.value = state.inputs[inputId];
      }
    }

    // 5. Khôi phục các tùy chọn Radio
    if (state.radios) {
      for (const radioName in state.radios) {
        const val = state.radios[radioName];
        const radioEl = document.querySelector(`input[name="${radioName}"][value="${val}"]`);
        if (radioEl) radioEl.checked = true;
      }
    }

    // 6. Khôi phục Mạch suy nghĩ
    if (state.thoughts) {
      for (const textareaId in state.thoughts) {
        const el = document.getElementById(textareaId);
        if (el) el.value = state.thoughts[textareaId];
      }
    }

    // 7. Khôi phục Câu trả lời của AI
    if (state.aiResponses) {
      for (const boxId in state.aiResponses) {
        const el = document.getElementById(boxId);
        if (el) {
          el.style.display = 'block';
          el.innerHTML = state.aiResponses[boxId];
        }
      }
    }

    // 8. Nếu bài đã bấm Chấm bài trước đó -> Khôi phục kết quả & Lời giải
    if (state.isSubmitted) {
      const passageBox = document.getElementById('passageBox');
      if (passageBox) passageBox.classList.add('submitted');
      
      const scoreBadge = document.getElementById('scoreBadge');
      const scoreText = document.getElementById('scoreText');
      if (scoreBadge) scoreBadge.style.display = 'block';
      if (scoreText && state.scoreText) scoreText.innerText = state.scoreText;

      document.querySelectorAll('.explanation').forEach(exp => {
        exp.style.display = 'block';
      });

      // Đánh dấu viền đúng/sai
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
  } catch (err) {
    console.warn("Không thể khôi phục localStorage:", err);
  }
}

// NÚT LÀM LẠI BÀI (XÓA SẠCH DỮ LIỆU ĐỂ LÀM LẠI TỪ ĐẦU)
function resetTestProgress() {
  if (confirm("⚠️ Bạn có chắc chắn muốn xóa toàn bộ kết quả bài làm trang này để LÀM LẠI TỪ ĐẦU không?")) {
    const key = getStorageKey();
    localStorage.removeItem(key);
    window.location.reload();
  }
}

// Xử lý Highlight tương tác người dùng
let currentSelectedRange = null;
let currentTargetSpan = null;

document.addEventListener('DOMContentLoaded', function() {
  // 1. Tự động chèn Nút Điều khiển Cỡ chữ, Tối/Sáng & Nút Reset vào Header
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

  // 3. Khôi phục trạng thái làm bài cũ từ localStorage
  restoreStateFromLocalStorage();

  // 4. Tự động theo dõi thao tác người dùng để lưu tự động
  document.addEventListener('input', saveStateToLocalStorage);
  document.addEventListener('change', saveStateToLocalStorage);

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
    if (!isTimerRunning && seconds === 0) {
      startTimer();
    }
  }, { once: true });
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

// Chấm điểm tự động linh hoạt cho mọi dạng đề
async function checkAnswers() {
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

  for (const qKey in answers) {
    const qDiv = document.getElementById(qKey);
    if (!qDiv) continue;

    const resDiv = qDiv.querySelector('.result');
    const expDiv = qDiv.querySelector('.explanation');
    const thoughtInput = document.getElementById(`${qKey}_thought`);
    const thought = thoughtInput ? thoughtInput.value.trim() : '';

    qDiv.classList.remove('correct-border', 'incorrect-border');

    let userVal = "";
    let isCorrect = false;
    const expectedAns = answers[qKey];

    // 1. Dạng Trắc nghiệm (Radio)
    const radioSelected = qDiv.querySelector(`input[name="${qKey}"]:checked`);
    const textInput = document.getElementById(`${qKey}_input`);

    if (radioSelected) {
      userVal = radioSelected.value.trim();
      isCorrect = (userVal.toUpperCase() === expectedAns.toUpperCase());
    } else if (textInput) {
      // 2. Dạng Điền từ
      userVal = textInput.value.trim();
      const cleanUserVal = userVal.toLowerCase().replace(/\s+/g, ' ');

      if (Array.isArray(expectedAns)) {
        isCorrect = expectedAns.map(a => a.toLowerCase().trim()).includes(cleanUserVal);
      } else {
        isCorrect = (cleanUserVal === expectedAns.toLowerCase().trim());
      }
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

    // TỰ ĐỘNG HIỆN TOÀN BỘ LỜI GIẢI CHI TIẾT DÙ ĐÚNG HAY SAI
    if (expDiv) expDiv.style.display = "block";
    detailsSummary += `${qKey.toUpperCase()}: ${userVal || 'Để trống'} | Suy nghĩ: ${thought || 'N/A'}\n`;
  }

  userFinalScore = score;
  const timeSpentText = document.getElementById('timerDisplay') ? document.getElementById('timerDisplay').innerText : '00:00';
  
  const scoreText = document.getElementById('scoreText');
  const scoreBadge = document.getElementById('scoreBadge');
  if (scoreText) scoreText.innerText = `${score}/${totalQuestions}`;
  if (scoreBadge) scoreBadge.style.display = 'block';

  // LƯU TRẠNG THÁI SAU KHI CHẤM BÀI
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
          score: `${score}/${totalQuestions}`,
          timeSpent: timeSpentText,
          details: detailsSummary
        })
      });
      alert(`🎉 Chúc mừng ${studentName}! Bài làm đạt ${score}/${totalQuestions} câu. Kết quả đã được lưu về hệ thống!`);
    } catch (err) {
      console.error("Lỗi gửi điểm:", err);
      alert(`Bài làm đạt ${score}/${totalQuestions} câu!`);
    }
  }
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

  const prompt = `Bạn là một giáo viên dạy IELTS Reading kỳ cựu và tận tâm.
Nhiệm vụ: Giải thích trực tiếp, chính xác thắc mắc của học viên.

BẮT BUỘC (QUAN TRỌNG):
- CHỈ xuất ra câu trả lời giải thích bằng tiếng Việt.
- KHÔNG lặp lại dòng "[THẮC MẮC CỦA HỌC VIÊN]". KHÔNG lặp lại prompt. KHÔNG lặp lại câu hỏi nhiều lần.

YÊU CẦU ĐỊNH DẠNG:
- Dùng **từ khóa** để IN ĐẬM các từ quan trọng.
- Dùng ==bằng chứng== để TÔ VÀNG đoạn thông tin cốt lõi trong bài đọc.
- Dùng [kw]từ khóa[/kw] để TÔ XANH LÁ CÂY các từ đồng nghĩa (paraphrase).

[CÂU HỎI IELTS]:
${questionTextOnly}

[HỌC VIÊN HỎI]:
${userQuestion}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        targetEl.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Kết nối quá thời gian cho phép (Timeout 30s). Vui lòng bấm gửi lại!`;
      } else {
        console.error("Lỗi gọi Apps Script:", err);
        targetEl.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Lỗi kết nối đến server. Em bấm thử lại lần nữa nhé!`;
      }
    }
  }
}
