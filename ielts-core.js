/**
 * ==========================================================================
 * IELTS PRACTICE TEST CORE ENGINE (ielts-core.js)
 * Tự động hóa toàn bộ: Bấm giờ, Bôi đen Highlight, Chấm điểm, AI Trợ giảng, Gửi điểm
 * ==========================================================================
 */

// CẤU HÌNH TOÀN CỤC DÙNG CHUNG CHO TẤT CẢ CÁC BÀI TẬP
const IELTS_CONFIG = {
  // Key API Gemini của bạn
  GEMINI_API_KEY: "AQ.Ab8RN6LwV10cN4CAoL0C7zUMUKvb8nFfPZ1rWdSp3Dg2x1AMPg",
  
  // Đường link Web App Google Apps Script nhận điểm và xử lý AI của bạn
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

// BỘ CHUYỂN ĐỔI CHUẨN ĐẸP MẮT (In đậm, Tô xanh từ khóa, Tô vàng bằng chứng, Mũi tên, Tiêu đề)
function formatMarkdownToHTML(text) {
  if (!text) return "";
  
  var formatted = text;

  // 1. Chuyển đổi mũi tên ->
  formatted = formatted.split("->").join(" ➔ ");
  formatted = formatted.split("-->").join(" ➔ ");
  formatted = formatted.split("$\\rightarrow$").join(" ➔ ");
  formatted = formatted.split("\\rightarrow").join(" ➔ ");

  // 2. Chuyển đổi Tiêu đề các mục (1. 2. 3. hoặc ### ##)
  formatted = formatted.replace(/^(###|\d+\.)\s*(.*$)/gim, function(match, p1, p2) {
    var titleText = (p1.endsWith('.')) ? (p1 + " " + p2) : p2;
    return '<h4 style="color: #0369a1; margin: 16px 0 8px 0; font-size: 15px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">' + titleText + '</h4>';
  });

  // 3. Chuyển đổi Khung trích dẫn (> Text)
  formatted = formatted.replace(/^\>\s*(.*$)/gim, '<blockquote style="background: #f8fafc; border-left: 4px solid #0284c7; margin: 8px 0; padding: 8px 12px; font-style: italic; color: #334155; border-radius: 0 4px 4px 0;">$1</blockquote>');

  // 4. Chuyển đổi [kw]từ khóa[/kw] -> Thẻ XANH LÁ CÂY
  formatted = formatted.replace(/\[kw\](.*?)\[\/kw\]/gi, '<span style="background-color: #bbf7d0; color: #14532d; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 13px; display: inline-block;">$1</span>');

  // 5. Chuyển đổi ==bằng chứng== -> Thẻ TÔ VÀNG
  formatted = formatted.replace(/==(.*?)==/gi, '<mark style="background-color: #fef08a; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 13px; display: inline-block;">$1</mark>');

  // 6. Chuyển đổi `cấu trúc` -> Thẻ XÁM NHẸ
  formatted = formatted.replace(/`([^`]+)`/gi, '<code style="background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">$1</code>');

  // 7. Chuyển đổi **in đậm** -> Thẻ IN ĐẬM
  formatted = formatted.replace(/\*\*(.*?)\*\*/gi, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');

  // 8. Chuyển đổi đường kẻ ngang ---
  formatted = formatted.replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 14px 0;">');

  // 9. Chuyển đổi gạch đầu dòng (* item hoặc - item)
  formatted = formatted.replace(/^\s*[\-\*]\s+(.*)$/gim, '<div style="margin-left: 8px; margin-bottom: 4px; line-height: 1.5;">• $1</div>');

  // 10. Chuyển đổi xuống dòng <br>
  formatted = formatted.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');

  return formatted;
}

// AI Trợ giảng IELTS (Hiển thị Format Đẹp mắt như hình mẫu)
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
  responseBox.innerHTML = "<i>⏳ Trợ giảng AI đang đọc bài và soạn lời giải thích...</i>";

  const qDiv = document.getElementById(qId);
  const questionContent = qDiv ? qDiv.innerText : "";

  const prompt = `Bạn là một giáo viên dạy IELTS Reading kỳ cựu, tận tâm và chuyên nghiệp.
Nhiệm vụ: Giải thích thắc mắc của học viên theo BỐ CỤC 3 PHẦN CHUẨN ĐẸP như sau:

Chào em, thầy/cô giải thích chi tiết lý do tại sao đáp án lại là **từ_đáp_án** nhé!

---

1. Phân tích ngữ pháp & Ngữ cảnh câu hỏi
- Câu hỏi: > [câu_hỏi]
- Dịch nghĩa: [dịch_nghĩa]
- Cấu trúc ngữ pháp: `[cấu_trúc]`

---

2. Đối chiếu với bài đọc (Evidence)
Trong bài đọc, đoạn văn chứa thông tin như sau:
> ==[đoạn_bằng_chứng_trong_bài]==

---

3. Bảng đối chiếu từ đồng nghĩa (Paraphrasing)
Em hãy nhìn vào cách bài đọc biến đổi từ ngữ [kw]paraphrase[/kw] nhé:
- [kw]từ_cụm_từ_câu_hỏi[/kw] -> ==từ_cụm_từ_bài_đọc== (giải thích nghĩa)

---

💡 Tóm lại:
[Lời khuyên ngắn gọn hoặc mẹo rút ra]

[CÂU HỎI & ĐÁP ÁN CỦA HỌC VIÊN]:
${questionContent}

[THẮC MẮC CỦA HỌC VIÊN]:
"${userQuestion}"`;

  try {
    const res = await fetch(IELTS_CONFIG.GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "ask_ai",
        prompt: prompt,
        apiKey: IELTS_CONFIG.GEMINI_API_KEY
      })
    });

    const data = await res.json();
    if (data && data.reply) {
      const htmlFormatted = formatMarkdownToHTML(data.reply);
      responseBox.innerHTML = `<div style="line-height: 1.6; color: #334155;"><b style="color: #0284c7; font-size: 14px;">🤖 Trợ giảng AI:</b><br><br>${htmlFormatted}</div>`;
    } else {
      responseBox.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Phản hồi từ máy chủ: ${data.error || "Trống"}`;
    }
  } catch (err) {
    console.warn("Lỗi kết nối:", err);
    responseBox.innerHTML = `⚠️ <b>Trợ giảng AI:</b> Lỗi kết nối đến Google Apps Script. Vui lòng thử lại!`;
  }
}
