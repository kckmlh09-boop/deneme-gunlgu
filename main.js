import { CameraPreview } from '@capacitor-community/camera-preview';

const DB_NAME = 'YanlisDefterimDB';
const STORE_NAME = 'records';
const $ = (id) => document.getElementById(id);

let db;
let exams = [];
let questions = [];
let pending = [];
let draftName = '';
let draftType = 'TYT';
let subjectIndex = 0;
let cameraOn = false;
let capturing = false;
let facing = 'environment';
let webStream = null;
let cameraMode = 'native';
let activeExamType = 'TYT';
let openedExamId = null;
let selectedSubject = '';

let workflowSubjects = [
  'Türkçe', 'Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü',
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji'
];

function show(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  $(id).classList.add('active');
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => { db = request.result; resolve(); };
    request.onerror = () => reject(request.error);
  });
}

function readData() {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get('data');
    request.onsuccess = () => resolve(request.result || { exams: [], questions: [] });
    request.onerror = () => reject(request.error);
  });
}

function saveData() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ exams, questions }, 'data');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const objectURLs = new WeakMap();
function photoURL(blob) {
  if (!objectURLs.has(blob)) objectURLs.set(blob, URL.createObjectURL(blob));
  return objectURLs.get(blob);
}

function renderExamList() {
  const search = $('examSearch').value.trim().toLocaleLowerCase('tr-TR');
  const filtered = exams.slice().reverse().filter((exam) =>
    (exam.type || 'TYT') === activeExamType &&
    `${exam.name} ${exam.type || ''}`.toLocaleLowerCase('tr-TR').includes(search)
  );
  $('examShown').textContent = `${filtered.length} deneme`;
  $('examList').innerHTML = filtered.length ? filtered.map((exam) => `
    <button class="exam exam-button" type="button" data-exam-id="${escapeHTML(exam.id)}">
      <span class="examTop"><span class="examName">${escapeHTML(exam.name)}</span><span class="examTag">${escapeHTML(exam.type || 'TYT')}</span></span>
      <span class="examMeta">${questions.filter((q) => q.examId === exam.id).length} yanlış soru · ${new Date(exam.date).toLocaleDateString('tr-TR')}</span>
    </button>`).join('')
    : `<div class="empty">${search ? 'Aramana uygun deneme bulunamadı.' : `${activeExamType} için henüz deneme yok.`}</div>`;
  $('examList').querySelectorAll('[data-exam-id]').forEach((button) => {
    button.addEventListener('click', () => openExam(button.dataset.examId));
  });
}

function render() {
  $('total').textContent = questions.length;
  $('examCount').textContent = exams.length;
  $('tytExamCount').textContent = `${exams.filter((exam) => (exam.type || 'TYT') === 'TYT').length} deneme`;
  $('aytExamCount').textContent = `${exams.filter((exam) => exam.type === 'AYT').length} deneme`;
  $('subjectCount').textContent = new Set(questions.map((q) => q.subject)).size;
  renderExamList();
  const counts = {};
  questions.forEach((q) => { counts[q.subject] = (counts[q.subject] || 0) + 1; });
  $('statsBySubject').innerHTML = Object.keys(counts).length
    ? Object.entries(counts).map(([subject, count]) => `<div class="exam"><span>${escapeHTML(subject)}</span><b style="float:right">${count}</b></div>`).join('')
    : '<div class="empty">Yanlış ekledikçe burada görünecek.</div>';
}

function selectType(type) {
  draftType = type;
  workflowSubjects = type === 'AYT'
    ? ['Matematik', 'Fizik', 'Kimya', 'Biyoloji']
    : ['Türkçe', 'Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji'];
  $('createHeading').textContent = `${type} denemesi`;
  $('examName').value = '';
  show('create');
}

function showCaptureSubject() {
  const subject = workflowSubjects[subjectIndex];
  $('typePill').textContent = draftType;
  $('captureHeading').textContent = `${subject} yanlışları`;
  $('captureHint').textContent = `${subjectIndex + 1}/${workflowSubjects.length} · Fotoğrafları art arda çek; kamera çekimden sonra açık kalır.`;
  $('subjectProgress').textContent = `${subjectIndex + 1}/${workflowSubjects.length}`;
  $('nextSubject').textContent = subjectIndex === workflowSubjects.length - 1
    ? 'Fotoğrafları kontrol et →'
    : `${workflowSubjects[subjectIndex + 1]} dersine geç →`;
  renderPending();
  show('capture');
}

function renderPending() {
  $('pendingCount').textContent = `${pending.length} fotoğraf eklendi`;
  $('cameraCount').textContent = `${pending.length} fotoğraf`;
  $('photoGrid').innerHTML = pending.map((item, index) => ({ ...item, index }))
    .filter((item) => item.subject === workflowSubjects[subjectIndex])
    .map((item) => `
      <div class="photo-item">
        <img src="${photoURL(item.photo)}" alt="${escapeHTML(item.subject)} yanlış soru">
        <button class="btn secondary full" type="button" data-remove-photo="${item.index}">Kaldır</button>
      </div>`).join('');
  $('photoGrid').querySelectorAll('[data-remove-photo]').forEach((button) => {
    button.addEventListener('click', () => {
      pending.splice(Number(button.dataset.removePhoto), 1);
      renderPending();
    });
  });
}

function dataURLToBlob(dataURL) {
  const [header, base64] = dataURL.split(',');
  const mime = (header.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function addCapturedPhoto(blob) {
  pending.push({ photo: blob, subject: workflowSubjects[subjectIndex] });
  renderPending();
}

async function startWebCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }
  });
  webStream = stream;
  $('webCamera').srcObject = stream;
  $('webCamera').classList.add('active');
  await $('webCamera').play();
}

async function startCamera() {
  try {
    $('cameraSubject').textContent = `${workflowSubjects[subjectIndex]} · Kamera`;
    $('cameraCount').textContent = `${pending.length} fotoğraf`;
    show('cameraScreen');
    document.body.classList.add('camera-live');
    document.documentElement.classList.add('camera-live');

    if (window.Capacitor?.isNativePlatform?.()) {
      cameraMode = 'native';
      await CameraPreview.start({
        position: facing === 'environment' ? 'rear' : 'front',
        toBack: true,
        enableZoom: true,
        disableAudio: true,
        storeToFile: false,
        lockAndroidOrientation: true
      });
    } else {
      cameraMode = 'web';
      await startWebCamera();
    }
    cameraOn = true;
  } catch (error) {
    cameraOn = false;
    document.body.classList.remove('camera-live');
    document.documentElement.classList.remove('camera-live');
    show('capture');
    alert(`Kamera açılamadı. Kamera iznini kontrol et.\n${error?.message || ''}`);
  }
}

async function stopCamera() {
  if (cameraMode === 'native' && cameraOn) {
    try { await CameraPreview.stop(); } catch (error) { console.warn('Kamera kapatılamadı', error); }
  }
  if (webStream) {
    webStream.getTracks().forEach((track) => track.stop());
    webStream = null;
  }
  $('webCamera').srcObject = null;
  $('webCamera').classList.remove('active');
  cameraOn = false;
  document.body.classList.remove('camera-live');
  document.documentElement.classList.remove('camera-live');
}

async function capturePhoto() {
  if (!cameraOn || capturing) return;
  capturing = true;
  $('snapPhoto').classList.add('capturing');
  try {
    if (cameraMode === 'native') {
      const result = await CameraPreview.capture({ quality: 92 });
      if (!result?.value) throw new Error('Kamera fotoğraf döndürmedi.');
      const dataURL = result.value.startsWith('data:') ? result.value : `data:image/jpeg;base64,${result.value}`;
      addCapturedPhoto(dataURLToBlob(dataURL));
    } else {
      const video = $('webCamera');
      if (!video.videoWidth || !video.videoHeight) throw new Error('Kamera görüntüsü henüz hazır değil.');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Fotoğraf oluşturulamadı.');
      addCapturedPhoto(blob);
    }
  } catch (error) {
    alert(`Fotoğraf çekilemedi: ${error?.message || 'Kamera hatası'}`);
  } finally {
    capturing = false;
    $('snapPhoto').classList.remove('capturing');
  }
}

async function flipCamera() {
  if (!cameraOn) return;
  try {
    if (cameraMode === 'native') {
      await CameraPreview.flip();
    } else {
      facing = facing === 'environment' ? 'user' : 'environment';
      if (webStream) webStream.getTracks().forEach((track) => track.stop());
      await startWebCamera();
    }
  } catch (error) {
    alert(`Kamera değiştirilemedi: ${error?.message || ''}`);
  }
}

function openReview() {
  $('reviewTitle').textContent = `${draftName} · ${draftType}`;
  $('batchTitle').textContent = `${pending.length} fotoğraf hazır`;
  $('batchStatus').textContent = 'Fotoğrafları derslerine göre kontrol et. İstersen konu ekleyebilirsin.';
  $('reviewList').innerHTML = workflowSubjects.map((subject) => {
    const rows = pending.map((item, index) => ({ ...item, index })).filter((item) => item.subject === subject);
    if (!rows.length) return '';
    return `<h2>${escapeHTML(subject)} · ${rows.length}</h2>` + rows.map((item) => `
      <article class="review-card">
        <div class="qrow"><img src="${photoURL(item.photo)}" alt="Yanlış soru">
          <div class="details"><b>${escapeHTML(subject)} · Soru ${item.index + 1}</b>
            <div class="field"><label for="topic${item.index}">Konu (isteğe bağlı)</label>
              <input id="topic${item.index}" placeholder="Örn. Paragraf, Elektrik, Fonksiyonlar" maxlength="100">
            </div>
          </div>
        </div>
      </article>`).join('');
  }).join('');
  show('review');
}

async function saveExam() {
  if (!pending.length) return alert('Kaydedilecek fotoğraf yok.');
  if (!draftName.trim()) return alert('Deneme adı boş olamaz.');

  const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const examId = makeId();
  const previousExams = exams;
  const previousQuestions = questions;
  const newExam = { id: examId, name: draftName.trim(), type: draftType, date: Date.now() };

  exams = [...exams, newExam];
  questions = [
    ...questions,
    ...pending.map((item) => ({
      id: makeId(),
      examId,
      photo: item.photo,
      subject: item.subject,
      topic: '',
      date: Date.now()
    }))
  ];

  // Read topic fields before leaving the review screen.
  questions.slice(previousQuestions.length).forEach((question, index) => {
    question.topic = $('topic' + index)?.value.trim() || '';
  });

  try {
    await saveData();
    pending = [];
    render();
    show('home');
  } catch (error) {
    exams = previousExams;
    questions = previousQuestions;
    alert(`Kayıt yapılamadı; deneme bellekte de eklenmedi. Tekrar deneyebilirsin.\n${error?.message || ''}`);
  }
}

function openExam(id) {
  const exam = exams.find((item) => item.id === id);
  if (!exam) return;
  openedExamId = id;
  $('selectedExamType').textContent = exam.type || 'TYT';
  $('selectedExamTitle').textContent = exam.name;
  renderExamSubjects();
  show('examSubjects');
}

function renderExamSubjects() {
  const examQuestions = questions.filter((question) => question.examId === openedExamId);
  const exam = exams.find((item) => item.id === openedExamId);
  if (!exam) return;
  const order = exam.type === 'AYT'
    ? ['Matematik', 'Fizik', 'Kimya', 'Biyoloji']
    : ['Türkçe', 'Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji'];
  const present = [...new Set(examQuestions.map((question) => question.subject))];
  const orderedSubjects = [...order.filter((subject) => present.includes(subject)), ...present.filter((subject) => !order.includes(subject))];
  $('subjectList').innerHTML = orderedSubjects.length ? orderedSubjects.map((subject) => {
    const count = examQuestions.filter((question) => question.subject === subject).length;
    return `<button class="subject-choice" type="button" data-subject="${escapeHTML(subject)}"><span><b>${escapeHTML(subject)}</b><small>${count} fotoğraf</small></span><span class="type-arrow">›</span></button>`;
  }).join('') : '<div class="empty">Bu denemede henüz fotoğraf bulunmuyor.</div>';
  $('subjectList').querySelectorAll('[data-subject]').forEach((button) => {
    button.addEventListener('click', () => openSubjectPhotos(button.dataset.subject));
  });
}

function openSubjectPhotos(subject) {
  const exam = exams.find((item) => item.id === openedExamId);
  if (!exam) return;
  selectedSubject = subject;
  renderSubjectPhotos();
  show('subjectPhotos');
}

function renderSubjectPhotos() {
  const exam = exams.find((item) => item.id === openedExamId);
  if (!exam) return;
  const rows = questions.filter((question) =>
    question.examId === openedExamId && question.subject === selectedSubject
  );

  $('photosExamType').textContent = `${exam.type || 'TYT'} · ${exam.name}`;
  $('photosHeading').textContent = selectedSubject;
  $('photosMeta').textContent = `${rows.length} yanlış soru fotoğrafı`;

  $('subjectPhotoList').innerHTML = rows.length ? rows.map((question, index) => `
    <article class="subject-photo-card">
      <img src="${photoURL(question.photo)}" alt="${escapeHTML(selectedSubject)} yanlış soru ${index + 1}" loading="lazy">
      <div class="field photo-topic-edit">
        <label for="savedTopic-${escapeHTML(question.id)}">Konu</label>
        <input id="savedTopic-${escapeHTML(question.id)}" data-topic-id="${escapeHTML(question.id)}"
          value="${escapeHTML(question.topic || '')}" maxlength="100" placeholder="Örn. Paragraf, Elektrik, Fonksiyonlar">
      </div>
      <button class="btn danger full" type="button" data-delete-question="${escapeHTML(question.id)}">Bu fotoğrafı sil</button>
    </article>`).join('')
    : '<div class="empty">Bu derste fotoğraf bulunamadı.</div>';

  $('subjectPhotoList').querySelectorAll('[data-topic-id]').forEach((input) => {
    input.addEventListener('change', async () => {
      const question = questions.find((item) => item.id === input.dataset.topicId);
      if (!question) return;
      const oldTopic = question.topic || '';
      question.topic = input.value.trim();
      try {
        await saveData();
      } catch (error) {
        question.topic = oldTopic;
        input.value = oldTopic;
        alert(`Konu kaydedilemedi: ${error?.message || ''}`);
      }
    });
  });

  $('subjectPhotoList').querySelectorAll('[data-delete-question]').forEach((button) => {
    button.addEventListener('click', async () => {
      const questionId = button.dataset.deleteQuestion;
      const question = questions.find((item) => item.id === questionId);
      if (!question || !confirm('Bu yanlış soru fotoğrafını silmek istiyor musun?')) return;

      const previousQuestions = questions;
      questions = questions.filter((item) => item.id !== questionId);
      try {
        await saveData();
        render();
        if (!questions.some((item) => item.examId === openedExamId && item.subject === selectedSubject)) {
          renderExamSubjects();
          show('examSubjects');
        } else {
          renderSubjectPhotos();
        }
      } catch (error) {
        questions = previousQuestions;
        alert(`Fotoğraf silinemedi; kayıt korundu.\n${error?.message || ''}`);
      }
    });
  });
}

async function deleteExamRecord() {
  if (!openedExamId) return;
  const exam = exams.find((item) => item.id === openedExamId);
  if (!exam) return;

  const linkedCount = questions.filter((question) => question.examId === openedExamId).length;
  const confirmed = confirm(
    `“${exam.name}” denemesi ve ona ait ${linkedCount} yanlış soru kalıcı olarak silinsin mi?\n\nBu işlem geri alınamaz. Önce yedek almak istiyorsan İptal'e bas.`
  );
  if (!confirmed) return;

  const previousExams = exams;
  const previousQuestions = questions;
  exams = exams.filter((item) => item.id !== openedExamId);
  questions = questions.filter((question) => question.examId !== openedExamId);

  try {
    await saveData();
    openedExamId = null;
    render();
    show('home');
    alert('Deneme ve ona bağlı yanlış sorular silindi.');
  } catch (error) {
    exams = previousExams;
    questions = previousQuestions;
    alert(`Silme işlemi kaydedilemedi; kayıtlar korunuyor.\n${error?.message || ''}`);
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exportBackup() {
  try {
    const backupQuestions = [];
    for (const question of questions) {
      backupQuestions.push({ ...question, photoData: await blobToDataURL(question.photo), photo: undefined });
    }
    const blob = new Blob([JSON.stringify({ format: 'yanlis-defterim-backup-v1', exams, questions: backupQuestions })], { type: 'application/json' });
    const link = document.createElement('a');
    const objectURL = URL.createObjectURL(blob);
    link.href = objectURL;
    link.download = 'yanlis-defterim-yedek.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectURL), 1500);
  } catch (error) {
    alert(`Yedek oluşturulamadı: ${error?.message || ''}`);
  }
}

async function importBackup(file) {
  try {
    if (!file || file.size > 150 * 1024 * 1024) {
      throw new Error('Yedek dosyası boş veya 150 MB sınırını aşıyor.');
    }

    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.exams) || !Array.isArray(parsed.questions)) {
      throw new Error('Yedek dosyasının biçimi tanınmadı.');
    }

    const validExams = parsed.exams.filter((exam) =>
      exam && typeof exam.id === 'string' && typeof exam.name === 'string' &&
      ['TYT', 'AYT'].includes(exam.type || 'TYT')
    );
    const validExamIds = new Set(validExams.map((exam) => exam.id));
    if (validExamIds.size !== validExams.length) {
      throw new Error('Yedekte aynı kimliğe sahip birden fazla deneme var.');
    }

    const restoredQuestions = [];
    const backupQuestionIds = new Set();
    for (const question of parsed.questions) {
      if (!question || typeof question.id !== 'string' ||
          !validExamIds.has(question.examId) || typeof question.subject !== 'string') {
        throw new Error('Yedekte geçersiz veya denemesi bulunmayan bir soru var.');
      }

      if (backupQuestionIds.has(question.id)) {
        throw new Error('Yedekte aynı kimliğe sahip birden fazla soru var.');
      }
      backupQuestionIds.add(question.id);

      let photo = question.photo;
      if (!(photo instanceof Blob)) {
        if (typeof question.photoData !== 'string' || !question.photoData.startsWith('data:image/')) {
          throw new Error('Yedekte bir fotoğraf verisi eksik veya geçersiz.');
        }
        photo = dataURLToBlob(question.photoData);
      }
      if (!photo.size || !photo.type.startsWith('image/')) {
        throw new Error('Yedekte geçersiz bir fotoğraf bulunuyor.');
      }
      restoredQuestions.push({
        id: question.id,
        examId: question.examId,
        photo,
        subject: question.subject,
        topic: typeof question.topic === 'string' ? question.topic.slice(0, 100) : '',
        date: Number(question.date) || Date.now()
      });
    }

    const merge = confirm('Yedek mevcut kayıtların üzerine yazılmasın; kayıtlar birleştirilsin mi?\nTamam: Birleştir · İptal: Vazgeç');
    if (!merge) return;

    const previousExams = exams;
    const previousQuestions = questions;
    const examIds = new Set(exams.map((exam) => exam.id));
    const questionIds = new Set(questions.map((question) => question.id));

    exams = [...exams, ...validExams.filter((exam) => !examIds.has(exam.id))];
    const questionsToAdd = restoredQuestions.filter((question) => !questionIds.has(question.id));
    questions = [...questions, ...questionsToAdd];

    try {
      await saveData();
      render();
      alert('Yedek kayıtlarla birleştirildi.');
    } catch (error) {
      exams = previousExams;
      questions = previousQuestions;
      throw error;
    }
  } catch (error) {
    alert(`Yedek açılamadı: ${error?.message || ''}`);
  } finally {
    $('backupFile').value = '';
  }
}

// Main navigation and workflow
$('examSearch').addEventListener('input', renderExamList);
$('browseTYT').addEventListener('click', () => { activeExamType = 'TYT'; $('typeExamsTitle').textContent = 'TYT denemelerim'; $('examSearch').value = ''; renderExamList(); show('typeExams'); });
$('browseAYT').addEventListener('click', () => { activeExamType = 'AYT'; $('typeExamsTitle').textContent = 'AYT denemelerim'; $('examSearch').value = ''; renderExamList(); show('typeExams'); });
$('typeExamsBack').addEventListener('click', () => show('home'));
$('subjectsBack').addEventListener('click', () => { renderExamList(); show('typeExams'); });
$('photosBack').addEventListener('click', () => { renderExamSubjects(); show('examSubjects'); });
$('fab').addEventListener('click', () => show('typeSelect'));
$('typeBack').addEventListener('click', () => show('home'));
$('chooseTYT').addEventListener('click', () => selectType('TYT'));
$('chooseAYT').addEventListener('click', () => selectType('AYT'));
$('backHome').addEventListener('click', () => show('typeSelect'));
$('backCreate').addEventListener('click', () => show('create'));
$('createExam').addEventListener('click', () => {
  draftName = $('examName').value.trim();
  if (!draftName) return alert('Deneme adını yaz.');
  pending = [];
  subjectIndex = 0;
  showCaptureSubject();
});
$('takePhoto').addEventListener('click', startCamera);
$('cameraClose').addEventListener('click', async () => { await stopCamera(); show('capture'); });
$('cameraDone').addEventListener('click', async () => { await stopCamera(); renderPending(); show('capture'); });
$('snapPhoto').addEventListener('click', capturePhoto);
$('cameraFlip').addEventListener('click', flipCamera);
$('nextSubject').addEventListener('click', async () => {
  if (subjectIndex < workflowSubjects.length - 1) {
    subjectIndex += 1;
    showCaptureSubject();
  } else {
    if (!pending.length) return alert('Henüz fotoğraf eklemedin.');
    openReview();
  }
});
$('backCapture').addEventListener('click', () => { subjectIndex = 0; showCaptureSubject(); });
$('saveAll').addEventListener('click', saveExam);

$('deleteExam').addEventListener('click', deleteExamRecord);
$('backupHome').addEventListener('click', () => exportBackup());
$('restoreHome').addEventListener('click', () => $('backupFile').click());
$('backupFile').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) importBackup(file);
});

(async () => {
  await openDB();
  const data = await readData();
  exams = Array.isArray(data.exams) ? data.exams.filter((exam) =>
    exam && typeof exam.id === 'string' && typeof exam.name === 'string'
  ) : [];
  const examIds = new Set(exams.map((exam) => exam.id));
  questions = Array.isArray(data.questions) ? data.questions.filter((question) =>
    question && typeof question.id === 'string' && examIds.has(question.examId) &&
    typeof question.subject === 'string' && question.photo instanceof Blob
  ) : [];
  render();
})().catch((error) => alert(`Uygulama verileri açılamadı: ${error?.message || ''}`));
