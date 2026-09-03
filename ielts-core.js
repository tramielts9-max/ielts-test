/**
 * ==========================================================================
 * IELTS PRACTICE TEST CORE ENGINE (ielts-core.js)
 * Tự động hóa toàn bộ: Bấm giờ, Bôi đen Highlight, Chấm điểm, AI Trợ giảng, Gửi điểm
 * NÂNG CẤP HỆ THỐNG:
 * 1. Tự động lưu ngầm thời gian thực (Auto-save & State Retention qua localStorage)
 * 2. Khôi phục nguyên trạng lịch sử làm bài (Full Snapshot Restoration)
 * 3. Nút Xuất Báo Cáo Bài Làm (Export Document / Printable Report)
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

// Lấy ID bài làm duy nhất làm Key lưu vào Storage
function getTestStorageKey() {
  const pagePath = window.location.pathname.split('/').pop().replace('.html', '') || 'default_test';
  return `IELTS_PRACTICE_STATE_${pagePath}`;
}

// --------------------------------------------------------------------------
// 1. CƠ CHẾ TỰ ĐỘNG LƯU NGẦM THỜI GIAN THỰC (AUTO-SAVE TO LOCALSTORAGE)
// --------------------------------------------------------------------------
function saveStateToStorage() {
  const key = getTestStorageKey();
  const studentNameInput = document.getElementById('studentNameInput');
  const studentEmailInput = document.getElementById('studentEmailInput');
  const scoreBadge = document.getElementById('scoreBadge');
  const scoreText = document.getElementById('scoreText');

  const state = {
    studentName: studentNameInput ? studentNameInput.value : "",
    studentEmail: studentEmailInput ? studentEmailInput.value : "",
    seconds: seconds,
    isSubmitted: document.getElementById('passageBox') ? document.getElementById('passageBox').classList.contains('submitted') : false,
    scoreText: scoreText ? scoreText.innerText : "",
    scoreBadgeDisplay: scoreBadge ? scoreBadge.style.display : "none",
    answers: {},
    thoughts: {},
    aiResponses: {}
  };

  // Lưu các câu trả lời
  if (window.TEST_DATA && window.TEST_DATA.answers) {
    for (const qKey in window.TEST_DATA.answers) {
      const radioSelected = document.querySelector(`input[name="${qKey}"]:checked`);
      const textInput = document.getElementById(`${qKey}_input`);
      if (radioSelected) {
        state.answers[qKey] = radioSelected.value;
      } else if (textInput) {
        state.answers[qKey] = textInput.value;
      }

      // Lưu mạch suy nghĩ
      const thoughtInput = document.getElementById(`${qKey}_thought`);
      if (thoughtInput) {
        state.thoughts[`${qKey}_thought`] = thoughtInput.value;
      }

      // Lưu nội dung phản hồi từ AI
      const aiResponseBox = document.getElementById(`ai_response_${qKey}`);
      if (aiResponseBox && aiResponseBox.innerHTML.trim().length > 0) {
        state.aiResponses[qKey] = aiResponseBox.innerHTML;
      }
    }
  }

  localStorage.setItem(key, JSON.stringify(state));
}

// --------------------------------------------------------------------------
// 2. KHÔI PHỤC NGUYÊN TRẠNG KHI MỞ LẠI BÀI (FULL SNAPSHOT RESTORATION)
// --------------------------------------------------------------------------
function restoreStateFromStorage() {
  const key = getTestStorageKey();
  const savedData = localStorage.getItem(key);
  if (!savedData) return;

  try {
    const state = JSON.parse(savedData);

    // Điền lại Họ tên & Email
    const studentNameInput = document.getElementById('studentNameInput');
    const studentEmailInput = document.getElementById('studentEmailInput');
    if (studentNameInput && state.studentName) studentNameInput.value = state.studentName;
    if (studentEmailInput && state.studentEmail) studentEmailInput.value = state.studentEmail;

    // Khôi phục đồng hồ
    if (state.seconds) {
      seconds = state.seconds;
      updateTimerDisplay();
    }

    // Điền lại các đáp án đã khoanh / điền
    if (state.answers) {
      for (const qKey in state.answers) {
        const val = state.answers[qKey];
        const radio = document.querySelector(`input[name="${qKey}"][value="${val}"]`);
        const textInput = document.getElementById(`${qKey}_input`);
        if (radio) radio.checked = true;
        if (textInput) textInput.value = val;
      }
    }

    // Điền lại mạch suy nghĩ
    if (state.thoughts) {
      for (const tKey in state.thoughts) {
        const thoughtInput = document.getElementById(tKey);
        if (thoughtInput) thoughtInput.value = state.thoughts[tKey];
      }
    }

    // Điền lại các câu trả lời của AI
    if (state.aiResponses) {
      for (const qKey in state.aiResponses) {
        const aiResponseBox = document.getElementById(`ai_response_${qKey}`);
        if (aiResponseBox && state.aiResponses[qKey]) {
          aiResponseBox.style.display = "block";
          aiResponseBox.innerHTML = state.aiResponses[qKey];
        }
      }
    }

    // Khôi phục giao diện đã chấm bài (nếu đã nộp bài trước đó)
    if (state.isSubmitted) {
      renderSubmittedUI(state.scoreText);
    }
  } catch (e) {
    console.warn("Lỗi khôi phục dữ liệu từ localStorage:", e);
  }
}

// Hiển thị lại giao diện kết quả UI mà không gửi lại điểm sang Google Sheets
function renderSubmittedUI(scoreStr) {
  if (!window.TEST_DATA || !window.TEST_DATA.answers) return;

  const passageBox = document.getElementById('passageBox');
  if (passageBox) passageBox.classList.add('submitted');

  const answers = window.TEST_DATA.answers;
  for (const qKey in answers) {
    const qDiv = document.getElementById(qKey);
    if (!qDiv) continue;

    const resDiv = qDiv.querySelector('.result');
    const expDiv = qDiv.querySelector('.explanation');
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

    qDiv.classList.remove('correct-border', 'incorrect-border');
    if (isCorrect) {
      if (resDiv) resDiv.innerHTML = "<span class='correct-text'>✓ Đúng</span>";
      qDiv.classList.add('correct-border');
    } else {
      const correctStr = Array.isArray(expectedAns) ? expectedAns.join(" / ") : expectedAns;
      if (resDiv) resDiv.innerHTML = `<span class='incorrect-text'>✗ Sai (Đáp án đúng: <b>${correctStr}</b>)</span>`;
      qDiv.classList.add('incorrect-border');
    }

    if (expDiv) expDiv.style.display = "block";
  }

  const scoreText = document.getElementById('scoreText');
  const scoreBadge = document.getElementById('scoreBadge');
  if (scoreText && scoreStr) scoreText.innerText = scoreStr;
  if (scoreBadge) scoreBadge.style.display = 'block';
}

// --------------------------------------------------------------------------
// 3. XUẤT BÁO CÁO BÀI LÀM TRÍCH XUẤT ĐẦY ĐỦ (EXPORT REPORT / PRINT DOCUMENT)
// --------------------------------------------------------------------------
function exportStudentReport() {
  const studentName = document.getElementById('studentNameInput') ? document.getElementById('studentNameInput').value.trim() || 'Học viên' : 'Học viên';
  const studentEmail = document.getElementById('studentEmailInput') ? document.getElementById('studentEmailInput').value.trim() || 'N/A' : 'N/A';
  const testTitle = window.TEST_DATA ? (window.TEST_DATA.title || document.title) : document.title;
  const timeSpent = document.getElementById('timerDisplay') ? document.getElementById('timerDisplay').innerText : '00:00';
  const scoreText = document.getElementById('scoreText') ? document.getElementById('scoreText').innerText : 'Chưa chấm';

  let reportHtml = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Báo Cáo Bài Làm - ${studentName}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #1e293b; line-height: 1.6; }
        .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #0f172a; font-size: 22px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; padding: 14px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #cbd5e1; }
        .info-item { font-size: 14px; }
        .info-item b { color: #0284c7; }
        .q-card { border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin-bottom: 16px; background: #ffffff; }
        .q-title { font-weight: bold; font-size: 15px; margin-bottom: 8px; color: #0f172a; }
        .ans-user { color: #0369a1; font-weight: 600; }
        .thought-text { font-style: italic; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 13.5px; border-left: 3px solid #64748b; }
        .exp-box { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 12px; margin-top: 10px; border-radius: 4px; font-size: 14px; }
        .btn-print { background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-bottom: 20px; font-size: 14px; }
        @media print { .btn-print { display: none; } }
      </style>
    </head>
    <body>
      <button class="btn-print" onclick="window.print()">🖨️ In / Tải file PDF Báo Cáo</button>
      <div class="header">
        <h1>📊 BÁO CÁO KẾT QUẢ BÀI LÀM IELTS READING</h1>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Hệ Thống Luyện Thi Thông Minh - TramIELTS9 Max</p>
      </div>

      <div class="info-grid">
        <div class="info-item"><b>👤 Học viên:</b> ${studentName}</div>
        <div class="info-item"><b>✉️ Email:</b> ${studentEmail}</div>
        <div class="info-item"><b>📖 Bài làm:</b> ${testTitle}</div>
        <div class="info-item"><b>⏱️ Thời gian:</b> ${timeSpent}</div>
        <div class="info-item"><b>🎯 Điểm số:</b> ${scoreText}</div>
        <div class="info-item"><b>📅 Ngày xuất báo cáo:</b> ${new Date().toLocaleString('vi-VN')}</div>
      </div>

      <h2>📝 CHI TIẾT TỪNG CÂU HỎI VÀ LỜI GIẢI:</h2>
  `;

  if (window.TEST_DATA && window.TEST_DATA.answers) {
    let qIndex = 1;
    for (const qKey in window.TEST_DATA.answers) {
      const qDiv = document.getElementById(qKey);
      if (!qDiv) continue;

      const qText = qDiv.querySelector('p') ? qDiv.querySelector('p').innerText : `Câu ${qIndex}`;
      const radioSelected = qDiv.querySelector(`input[name="${qKey}"]:checked`);
      const textInput = document.getElementById(`${qKey}_input`);
      const userVal = radioSelected ? radioSelected.value : (textInput ? textInput.value : "Chưa trả lời");
      
      const thoughtInput = document.getElementById(`${qKey}_thought`);
      const thoughtVal = thoughtInput ? thoughtInput.value.trim() : "";

      const expDiv = qDiv.querySelector('.explanation');
      let expContent = expDiv ? expDiv.innerHTML : "";
      // Dọn dẹp nút bấm và ô hỏi AI trong bản in
      expContent = expContent.replace(/<button.*?>.*?<\/button>/gi, "").replace(/<div class="ai-assistant-box">.*?<\/div>/gis, "");

      const aiResponseBox = document.getElementById(`ai_response_${qKey}`);
      const aiVal = aiResponseBox ? aiResponseBox.innerHTML.trim() : "";

      reportHtml += `
        <div class="q-card">
          <div class="q-title">${qText}</div>
          <div><b>👉 Câu trả lời của em:</b> <span class="ans-user">${userVal}</span></div>
          ${thoughtVal ? `<div class="thought-text">💭 <b>Mạch suy nghĩ:</b> "${thoughtVal}"</div>` : ''}
          <div class="exp-box">
            ${expContent}
            ${aiVal ? `<div style="margin-top: 10px; border-top: 1px dashed #bae6fd; padding-top: 8px;">${aiVal}</div>` : ''}
          </div>
        </div>
      `;
      qIndex++;
    }
  }

  reportHtml += `</body></html>`;

  const reportWindow = window.open('', '_blank');
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();
}

// Thay đổi Cỡ chữ To/Nhỏ toàn trang
function changeFontSize(delta) {
  currentFontSize += delta;
  if (currentFontSize < 12) currentFontSize = 12;
  if (currentFontSize > 22) currentFontSize = 22;
  document.documentElement.style.setProperty('--font-size-base', currentFontSize + 'px');
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
}

document.addEventListener('DOMContentLoaded', function() {
  // 1. Tự động chèn Nút Control & Nút Xuất Báo Cáo vào Header
  const headerBar = document.querySelector('.header-bar');
  if (headerBar && !document.getElementById('btnExportReport')) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'header-controls';
    controlsDiv.innerHTML = `
      <button class="btn-header" onclick="changeFontSize(-1)">🔍 A-</button>
      <button class="btn-header" onclick="changeFontSize(1)">🔍 A+</button>
      <button class="btn-header" id="btnThemeToggle" onclick="toggleTheme()">🌙 Chế độ tối</button>
      <button class="btn-header" id="btnExportReport" onclick="exportStudentReport()" style="background: #16a34a; border-color: #15803d;">📥 Xuất Báo Cáo</button>
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

  // 3. Tự động khôi phục dữ liệu đã lưu từ trước (State Restoration)
  restoreStateFromStorage();

  // 4. Lắng nghe các sự kiện thay đổi để lưu ngầm thời gian thực (Real-time Auto-save)
  document.body.addEventListener('input', function(e) {
    saveStateToStorage();
  });
  document.body.addEventListener('change', function(e) {
    saveStateToStorage();
  });

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
          saveStateToStorage();
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
          saveStateToStorage();
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

    if (expDiv) expDiv.style.display = "block";
    detailsSummary += `${qKey.toUpperCase()}: ${userVal || 'Để trống'} | Suy nghĩ: ${thought || 'N/A'}\n`;
  }

  userFinalScore = score;
  const timeSpentText = document.getElementById('timerDisplay') ? document.getElementById('timerDisplay').innerText : '00:00';
  
  const scoreText = document.getElementById('scoreText');
  const scoreBadge = document.getElementById('scoreBadge');
  if (scoreText) scoreText.innerText = `${score}/${totalQuestions}`;
  if (scoreBadge) scoreBadge.style.display = 'block';

  // Lưu trạng thái đã nộp bài vào Storage
  saveStateToStorage();

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
      saveStateToStorage();
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
