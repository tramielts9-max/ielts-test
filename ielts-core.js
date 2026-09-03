/**
 * ==========================================================================
 * IELTS PRACTICE TEST CORE ENGINE (ielts-core.js)
 * Tự động hóa toàn bộ: Bấm giờ, Bôi đen Highlight, Chấm điểm, AI Trợ giảng, Gửi điểm
 * ==========================================================================
 */

// CẤU HÌNH TOÀN CỤC DÙNG CHUNG CHO TẤT CẢ CÁC BÀI TẬP
const IELTS_CONFIG = {
  // KHÔNG dán key trực tiếp vào đây để tránh lộ key trên Web (Bảo mật 100% qua Script Properties)
  GEMINI_API_KEY: "", 
  
  // Đường link Web App Google Apps Script PHIÊN BẢN MỚI NHẤT CỦA BẠN
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycby7vRFXq_YhjIEq4kN-8NLRFw2sj-7VkVEmTw6IkNkPmidEPnPtxtNkSE-HKfn5mAPfbw/exec"
};

// Quản lý đồng hồ bấm giờ
let seconds = 0;
let timerInterval = null;
let isTimerRunning = false;
let userFinalScore = 0;

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
    }, 1000);
  }
}

function pauseTimer() {
  if (isTimerRunning) {
    isTimerRunning = false;
    clearInterval(timerInterval);
  }
}

function stopTimer() {
  pauseTimer();
}

// Xử lý Highlight tương tác người dùng
let currentSelectedRange = null;
let currentTargetSpan = null;

document.addEventListener('DOMContentLoaded', function() {
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

    if (expDiv) expDiv.style.display = "block";
    detailsSummary += `${qKey.toUpperCase()}: ${userVal || 'Để trống'} | Suy nghĩ: ${thought || 'N/A'}\n`;
  }

  userFinalScore = score;
  const timeSpentText = document.getElementById('timerDisplay') ? document.getElementById('timerDisplay').innerText : '00:00';
  
  const scoreText = document.getElementById('scoreText');
  const scoreBadge = document.getElementById('scoreBadge');
  if (scoreText) scoreText.innerText = `${score}/${totalQuestions}`;
  if (scoreBadge) scoreBadge.style.display = 'block';

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

// AI TRỢ GIẢNG (Cấu hình Timeout 30 giây để ngắt chờ an toàn)
async function askGeminiAI(qId) {
  const inputEl = document.getElementById(`ai_ask_${qId}`);
  const responseBox = document.getElementById(`ai_response_${qId}`);
  if (!inputEl || !responseBox) return;

  const userQuestion = inputEl.value.trim();
  if (!userQuestion) {
    alert("Vui lòng gõ thắc mắc của em trước khi bấm hỏi nhé!");
    return;
  }

  // Mở khung phản hồi
  responseBox.style.display = "block";

  const safeQuestionText = userQuestion.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Thêm ô thắc mắc mới (Cỡ chữ to 16px, Font đậm nổi bật)
  const tempId = "temp_" + Date.now();
  const tempDiv = document.createElement('div');
  tempDiv.id = tempId;
  tempDiv.style.borderTop = "1px dashed #cbd5e1";
  tempDiv.style.paddingTop = "12px";
  tempDiv.style.marginTop = "12px";
  tempDiv.innerHTML = `
    <div style="color: #0369a1; font-weight: 700; font-size: 16px; margin-bottom: 6px; background: #e0f2fe; padding: 6px 12px; border-radius: 6px; border-left: 4px solid #0284c7;">
      💬 Thắc mắc: "${safeQuestionText}"
    </div>
    <i style="color: #64748b; font-size: 14px;">⏳ AI đang đọc bài và soạn lời giải thích...</i>
  `;
  
  responseBox.appendChild(tempDiv);
  tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Xóa sạch ô nhập
  inputEl.value = "";

  // BẢO VỆ PROMPT: Chỉ lấy nội dung câu hỏi IELTS thuần túy
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

  // THỜI GIAN CHỜ TIMEOUT NÂNG LÊN 30 GIÂY (30000ms)
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
        .replace(/\*\*(.*?)\*\*/g, "<strong style='color: #0f172a;'>$1</strong>")
        .replace(/==(.*?)==/g, "<mark style='background-color: #fef08a; color: #854d0e; padding: 2px 5px; border-radius: 4px; font-weight: 600;'>$1</mark>")
        .replace(/\[kw\](.*?)\[\/kw\]/g, "<span style='background-color: #bbf7d0; color: #14532d; padding: 2px 6px; border-radius: 4px; font-weight: 700;'>$1</span>");

      targetEl.innerHTML = `
        <div style="color: #0369a1; font-weight: 700; font-size: 16px; margin-bottom: 8px; background: #e0f2fe; padding: 6px 12px; border-radius: 6px; border-left: 4px solid #0284c7;">
          💬 Thắc mắc: "${safeQuestionText}"
        </div>
        <div style="font-size: 15px; line-height: 1.7; color: #1e293b;">
          <b style="color: #0284c7; font-size: 15px;">🤖 Trợ giảng AI:</b><br>${formattedReply}
        </div>
      `;
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
