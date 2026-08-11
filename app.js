// 版本号：每次更新代码时递增，方便确认线上是否生效
const VERSION = '1.3.1';

const els = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  cutBtn: document.getElementById('cutBtn'),
  progress: document.getElementById('progress'),
  progressBar: document.getElementById('progressBar'),
  progressArrow: document.getElementById('progressArrow'),
  progressText: document.getElementById('progressText'),
  result: document.getElementById('result'),
  resultImg: document.getElementById('resultImg'),
  downloadBtn: document.getElementById('downloadBtn'),
  modeBtns: document.querySelectorAll('.seg__btn'),
  swatchBtns: document.querySelectorAll('.swatch'),
};

const state = { image: null, objectUrl: null, mode: 'general', bg: 'transparent', lastBlob: null, busy: false };

// 在页脚显示版本号
document.getElementById('ver').textContent = '版本 ' + VERSION;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  try {
    state.image = await loadImage(state.objectUrl);
    els.dropzone.classList.add('is-loaded');
    els.dropzone.querySelector('.dropzone__title').textContent = '已选择：' + file.name;
    els.cutBtn.disabled = false;
    hideResult();
  } catch (e) { alert(e.message); }
}

function hideResult() { els.result.hidden = true; }

els.dropzone.addEventListener('click', () => els.fileInput.click());
els.dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
});
els.fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) handleFile(f);
});
['dragenter','dragover'].forEach((ev) => els.dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); els.dropzone.classList.add('is-drag');
}));
['dragleave','drop'].forEach((ev) => els.dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); els.dropzone.classList.remove('is-drag');
}));
els.dropzone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) handleFile(f);
});
window.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const it of items) {
    if (it.type.startsWith('image/')) { handleFile(it.getAsFile()); break; }
  }
});

els.modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.modeBtns.forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.mode = btn.dataset.mode;
    if (!els.result.hidden) runCutout();
  });
});

els.swatchBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.swatchBtns.forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.bg = btn.dataset.bg;
    if (state.lastBlob) reComposite(state.lastBlob);
  });
});

async function composite(fgBlob, bg) {
  const fg = await loadImage(URL.createObjectURL(fgBlob));
  const canvas = document.createElement('canvas');
  canvas.width = fg.naturalWidth || fg.width;
  canvas.height = fg.naturalHeight || fg.height;
  const ctx = canvas.getContext('2d');
  if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(fg, 0, 0);
  return new Promise((resolve) => { canvas.toBlob((out) => resolve(out), 'image/png'); });
}

async function reComposite(blob) {
  const out = await composite(blob, state.bg);
  const url = URL.createObjectURL(out);
  if (els.downloadBtn.dataset.url) URL.revokeObjectURL(els.downloadBtn.dataset.url);
  els.resultImg.src = url;
  els.downloadBtn.href = url;
  els.downloadBtn.dataset.url = url;
  els.result.hidden = false;
}

let idleTimer = null;
function clearIdle() { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; } }

// 分派：通用走 @imgly，人像走 MediaPipe（两个库均按需动态加载）
async function runCutout() {
  if (!state.image || state.busy) return;
  if (state.mode === 'portrait') await runMediaPipe();
  else await runImgly();
}

// 通用抠图：@imgly/background-removal（ONNX Runtime Web + WASM），首次使用时才拉取
async function runImgly() {
  state.busy = true;
  els.cutBtn.disabled = true;
  els.progress.hidden = false;
  els.progressBar.style.width = '0%';
  els.progressArrow.style.left = '0%';
  els.progressText.textContent = '正在准备模型…';
  const track = { files: new Map(), order: [], prevPct: 0 };
  let sawProgress = false;
  clearIdle();
  idleTimer = setTimeout(() => { if (!sawProgress) els.progressText.textContent = '正在抠图…'; }, 2000);
  try {
    const { removeBackground } = await import('https://esm.sh/@imgly/background-removal@1.7.0');
    const blob = await removeBackground(state.objectUrl, {
      model: 'isnet',
      output: { format: 'image/png' },
      progress: (key, current, total) => {
        if (!total) return; // 准备阶段，保持当前文案
        sawProgress = true;
        clearIdle();
        if (!track.files.has(key)) { track.files.set(key, { current: 0, total: 0 }); track.order.push(key); }
        const rec = track.files.get(key);
        rec.current = current; rec.total = total;
        let done = 0, all = 0;
        for (const r of track.files.values()) { done += Math.min(r.current, r.total); all += r.total; }
        const bytePct = all ? (done / all) * 100 : 0;
        const pct = Math.min(99, Math.max(track.prevPct, bytePct));
        track.prevPct = pct;
        const shown = Math.round(pct);
        els.progressBar.style.width = pct + '%';
        els.progressArrow.style.left = Math.max(3, Math.min(97, shown)) + '%';
        const idx = track.order.indexOf(key) + 1;
        els.progressText.textContent = shown >= 99 ? '正在抠图…' : `下载模型第 ${idx} 个文件 · ${shown}%`;
      },
    });
    clearIdle();
    els.progressBar.style.width = '100%';
    els.progressArrow.style.left = '100%';
    els.progressText.textContent = '处理完成';
    state.lastBlob = blob;
    await reComposite(blob);
  } catch (e) {
    clearIdle();
    alert('抠图失败：' + (e && e.message ? e.message : e));
  } finally {
    clearIdle();
    state.busy = false;
    els.cutBtn.disabled = false;
    els.progress.hidden = true;
  }
}

// 人像抠图：MediaPipe Selfie Segmentation（轻量、头发边缘干净），首次使用时才加载
let mpSegmenter = null;
async function getSegmenter() {
  if (mpSegmenter) return mpSegmenter;
  const { ImageSegmenter, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm'
  );
  const resolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
  );
  const opts = {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  };
  try {
    mpSegmenter = await ImageSegmenter.createFromOptions(resolver, opts);
  } catch (e) {
    // 老设备 / Safari 不支持 GPU delegate 时降级到 CPU
    opts.baseOptions.delegate = 'CPU';
    mpSegmenter = await ImageSegmenter.createFromOptions(resolver, opts);
  }
  return mpSegmenter;
}

async function runMediaPipe() {
  state.busy = true;
  els.cutBtn.disabled = true;
  els.progress.hidden = false;
  els.progressBar.style.width = '0%';
  els.progressArrow.style.left = '0%';
  els.progressText.textContent = '正在加载人像模型…';
  let sawProgress = false;
  clearIdle();
  idleTimer = setTimeout(() => { if (!sawProgress) els.progressText.textContent = '正在抠图…'; }, 2000);
  try {
    const seg = await getSegmenter();
    sawProgress = true;
    clearIdle();
    els.progressText.textContent = '正在抠图…';
    const img = state.image;
    const res = seg.segment(img); // IMAGE 模式：同步返回，无需时间戳
    const mask = res.categoryMask; // MPMask：width / height + getAsUint8Array()
    if (!mask) throw new Error('人像分割未返回掩码，请改用通用模式或重试');
    const maskData = mask.getAsUint8Array(); // Uint8Array：0=背景 1=前景
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const out = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const mx = (x * mask.width / canvas.width) | 0;
        const my = (y * mask.height / canvas.height) | 0;
        out.data[(y * canvas.width + x) * 4 + 3] = maskData[my * mask.width + mx] === 1 ? 255 : 0;
      }
    }
    ctx.putImageData(out, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    els.progressBar.style.width = '100%';
    els.progressArrow.style.left = '100%';
    els.progressText.textContent = '处理完成';
    state.lastBlob = blob;
    await reComposite(blob);
  } catch (e) {
    clearIdle();
    alert('抠图失败：' + (e && e.message ? e.message : e));
  } finally {
    clearIdle();
    state.busy = false;
    els.cutBtn.disabled = false;
    els.progress.hidden = true;
  }
}

els.cutBtn.addEventListener('click', runCutout);
