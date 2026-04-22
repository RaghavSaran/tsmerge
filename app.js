(function () {
    'use strict';

    const MAX_FILES = 50;
    const MAX_TOTAL_BYTES = 2048 * 1024 * 1024; // 2 GB

    // State
    let files = [];       // { id, name, size, file }
    let nextId = 0;
    let isMerging = false;

    // DOM refs
    const dropZone       = document.getElementById('drop-zone');
    const fileInput       = document.getElementById('file-input');
    const fileCountEl     = document.getElementById('file-count');
    const totalSizeEl     = document.getElementById('total-size');
    const fileListHeader  = document.getElementById('file-list-header');
    const reorderHint     = document.getElementById('reorder-hint');
    const fileListEl      = document.getElementById('file-list');
    const clearBtn        = document.getElementById('clear-btn');
    const mergeBtn        = document.getElementById('merge-btn');
    const progressArea    = document.getElementById('progress-area');
    const progressFill    = document.getElementById('progress-fill');
    const progressText    = document.getElementById('progress-text');

    // ── Helpers ──────────────────────────────────────────────

    function totalSize() {
        return files.reduce((s, f) => s + f.size, 0);
    }

    function formatBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
        return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    function updateStats() {
        const count = files.length;
        fileCountEl.textContent = count + ' file' + (count !== 1 ? 's' : '');
        totalSizeEl.textContent = formatBytes(totalSize()) + ' / 2048 MB';
        mergeBtn.disabled = count < 2 || isMerging;
        const show = count > 0;
        fileListHeader.style.display = show ? 'flex' : 'none';
        reorderHint.style.display = count > 1 ? 'block' : 'none';

        if (count >= MAX_FILES || totalSize() >= MAX_TOTAL_BYTES) {
            dropZone.classList.add('disabled');
        } else {
            dropZone.classList.remove('disabled');
        }
    }

    // ── Add files ────────────────────────────────────────────

    function addFiles(incoming) {
        const arr = Array.from(incoming);
        for (const f of arr) {
            if (!f.name.toLowerCase().endsWith('.ts')) {
                alert('Only .ts files are accepted. Skipped: ' + f.name);
                continue;
            }
            if (files.length >= MAX_FILES) {
                alert('Maximum ' + MAX_FILES + ' files allowed.');
                break;
            }
            if (totalSize() + f.size > MAX_TOTAL_BYTES) {
                alert('Total size limit (2 GB) would be exceeded. Skipped: ' + f.name);
                continue;
            }
            files.push({ id: nextId++, name: f.name, size: f.size, file: f });
        }
        renderList();
        updateStats();
    }

    // ── Render list ──────────────────────────────────────────

    function renderList() {
        fileListEl.innerHTML = '';
        files.forEach(function (f, i) {
            const li = document.createElement('li');
            li.setAttribute('draggable', 'true');
            li.dataset.id = f.id;
            li.setAttribute('role', 'listitem');
            li.setAttribute('aria-label', 'File ' + (i + 1) + ': ' + f.name);

            li.innerHTML =
                '<span class="grip-icon" aria-hidden="true">⠿</span>' +
                '<span class="file-index">' + (i + 1) + '</span>' +
                '<span class="file-name" title="' + f.name + '">' + f.name + '</span>' +
                '<span class="file-size">' + formatBytes(f.size) + '</span>' +
                '<button class="remove-file" title="Remove" aria-label="Remove ' + f.name + '">&times;</button>';

            // Remove handler
            li.querySelector('.remove-file').addEventListener('click', function () {
                files = files.filter(function (x) { return x.id !== f.id; });
                renderList();
                updateStats();
            });

            // Drag handlers
            li.addEventListener('dragstart', onDragStart);
            li.addEventListener('dragover', onDragOver);
            li.addEventListener('dragenter', onDragEnter);
            li.addEventListener('dragleave', onDragLeave);
            li.addEventListener('drop', onDrop);
            li.addEventListener('dragend', onDragEnd);

            // Touch handlers for mobile
            li.addEventListener('touchstart', onTouchStart, { passive: false });
            li.addEventListener('touchmove', onTouchMove, { passive: false });
            li.addEventListener('touchend', onTouchEnd);

            fileListEl.appendChild(li);
        });
    }

    // ── Drag & drop reorder (desktop) ────────────────────────

    let dragSrcId = null;

    function onDragStart(e) {
        dragSrcId = parseInt(this.dataset.id);
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    function onDragEnter(e) { e.preventDefault(); this.classList.add('drag-over-item'); }
    function onDragLeave() { this.classList.remove('drag-over-item'); }

    function onDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over-item');
        const targetId = parseInt(this.dataset.id);
        if (dragSrcId === null || dragSrcId === targetId) return;
        const srcIdx = files.findIndex(function (f) { return f.id === dragSrcId; });
        const tgtIdx = files.findIndex(function (f) { return f.id === targetId; });
        const item = files.splice(srcIdx, 1)[0];
        files.splice(tgtIdx, 0, item);
        renderList();
    }

    function onDragEnd() {
        dragSrcId = null;
        document.querySelectorAll('#file-list li').forEach(function (li) {
            li.classList.remove('dragging', 'drag-over-item');
        });
    }

    // ── Touch reorder (mobile) ───────────────────────────────

    let touchSrcId = null;
    let touchClone = null;
    let touchStartY = 0;

    function onTouchStart(e) {
        if (e.target.closest('.remove-file')) return;
        touchSrcId = parseInt(this.dataset.id);
        touchStartY = e.touches[0].clientY;
        this.classList.add('dragging');
    }

    function onTouchMove(e) {
        if (touchSrcId === null) return;
        e.preventDefault();
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!el) return;
        const li = el.closest('#file-list li');
        document.querySelectorAll('#file-list li').forEach(function (item) {
            item.classList.remove('drag-over-item');
        });
        if (li && parseInt(li.dataset.id) !== touchSrcId) {
            li.classList.add('drag-over-item');
        }
    }

    function onTouchEnd(e) {
        if (touchSrcId === null) return;
        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const li = el ? el.closest('#file-list li') : null;
        if (li) {
            const targetId = parseInt(li.dataset.id);
            if (targetId !== touchSrcId) {
                const srcIdx = files.findIndex(function (f) { return f.id === touchSrcId; });
                const tgtIdx = files.findIndex(function (f) { return f.id === targetId; });
                const item = files.splice(srcIdx, 1)[0];
                files.splice(tgtIdx, 0, item);
            }
        }
        touchSrcId = null;
        document.querySelectorAll('#file-list li').forEach(function (item) {
            item.classList.remove('dragging', 'drag-over-item');
        });
        renderList();
    }

    // ── File drop zone ───────────────────────────────────────

    dropZone.addEventListener('click', function (e) {
        if (e.target.closest('.browse-btn') || e.target === dropZone || e.target.closest('.drop-zone')) {
            fileInput.click();
        }
    });

    dropZone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    fileInput.addEventListener('change', function () {
        if (fileInput.files.length) addFiles(fileInput.files);
        fileInput.value = '';
    });

    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });

    clearBtn.addEventListener('click', function () {
        files = [];
        renderList();
        updateStats();
    });

    // ── Merge ────────────────────────────────────────────────

    mergeBtn.addEventListener('click', async function () {
        if (files.length < 2 || isMerging) return;
        isMerging = true;
        mergeBtn.disabled = true;
        dropZone.classList.add('disabled');
        progressArea.classList.add('visible');
        setProgress(0, 'Loading FFmpeg...');

        try {
            const { FFmpeg } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm');
            const { fetchFile } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm');

            const ffmpeg = new FFmpeg();

            ffmpeg.on('progress', function (ev) {
                const pct = Math.max(0, Math.min(100, Math.round((ev.progress || 0) * 100)));
                setProgress(pct, 'Converting... ' + pct + '%');
            });

            setProgress(5, 'Loading FFmpeg core (this may take a moment)...');

            await ffmpeg.load({
                coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.12.10/dist/esm/ffmpeg-core.js',
                wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.12.10/dist/esm/ffmpeg-core.wasm',
            });

            setProgress(15, 'Writing files to virtual filesystem...');

            // Write each .ts file into ffmpeg's virtual FS
            const tsNames = [];
            for (let i = 0; i < files.length; i++) {
                const name = 'input' + i + '.ts';
                tsNames.push(name);
                setProgress(15 + Math.round((i / files.length) * 25), 'Loading file ' + (i + 1) + ' of ' + files.length + '...');
                await ffmpeg.writeFile(name, await fetchFile(files[i].file));
            }

            // Build concat list
            const concatContent = tsNames.map(function (n) { return "file '" + n + "'"; }).join('\n');
            await ffmpeg.writeFile('list.txt', new TextEncoder().encode(concatContent));

            setProgress(45, 'Merging and converting to MP4...');

            await ffmpeg.exec([
                '-f', 'concat',
                '-safe', '0',
                '-i', 'list.txt',
                '-c', 'copy',
                '-bsf:a', 'aac_adtstoasc',
                '-movflags', '+faststart',
                'output.mp4'
            ]);

            setProgress(90, 'Preparing download...');

            const data = await ffmpeg.readFile('output.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'merged_video.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(function () { URL.revokeObjectURL(url); }, 10000);

            setProgress(100, 'Done! Your file is downloading.');

            // Cleanup virtual FS
            for (const name of tsNames) {
                try { await ffmpeg.deleteFile(name); } catch (_) {}
            }
            try { await ffmpeg.deleteFile('list.txt'); } catch (_) {}
            try { await ffmpeg.deleteFile('output.mp4'); } catch (_) {}

        } catch (err) {
            console.error('Merge failed:', err);
            setProgress(0, 'Error: ' + (err.message || 'Merge failed. Check console for details.'));
        } finally {
            isMerging = false;
            mergeBtn.disabled = files.length < 2;
            dropZone.classList.remove('disabled');
        }
    });

    function setProgress(pct, text) {
        progressFill.style.width = pct + '%';
        progressText.textContent = text;
    }

    // Init
    updateStats();
})();
