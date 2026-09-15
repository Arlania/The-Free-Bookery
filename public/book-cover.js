(function setupBookCoverGenerator() {
  const WIDTH = 900;
  const HEIGHT = 1350;

  function drawWrappedText(context, title, maxWidth, startY, lineHeight, maxLines) {
    const words = String(title || "Untitled Book").trim().split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.…]+$/, "")}…`;
    visible.forEach((value, index) => context.fillText(value, WIDTH / 2, startY + index * lineHeight));
  }

  function canvasFile(canvas, title) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("A default cover could not be created."));
        const safeTitle = String(title || "book").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "book";
        resolve(new File([blob], `${safeTitle}-cover.jpg`, { type: "image/jpeg" }));
      }, "image/jpeg", 0.9);
    });
  }

  function loadBrandLogo() {
    return new Promise((resolve) => {
      const logo = new Image();
      logo.onload = () => resolve(logo);
      logo.onerror = () => resolve(null);
      logo.src = "./assets/book-logo.png";
    });
  }

  async function brandedCover(title) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f7f2e7";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = "#100b2b";
    context.fillRect(42, 42, WIDTH - 84, HEIGHT - 84);
    context.fillStyle = "#f2d6a4";
    context.textAlign = "center";
    const logo = await loadBrandLogo();
    if (logo) context.drawImage(logo, WIDTH / 2 - 142, 92, 74, 74);
    context.font = "700 34px Georgia, serif";
    context.textAlign = "left";
    context.fillText("FREE BOOKERY", WIDTH / 2 - 50, 143);
    context.textAlign = "center";
    context.strokeStyle = "#d79a5b";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(250, 190);
    context.lineTo(650, 190);
    context.stroke();
    context.fillStyle = "#fffaf0";
    context.font = "700 76px Georgia, serif";
    drawWrappedText(context, title, 680, 470, 98, 6);
    context.fillStyle = "#f2d6a4";
    context.font = "italic 30px Georgia, serif";
    context.fillText("Read freely. Support creators.", WIDTH / 2, 1210);
    return canvasFile(canvas, title);
  }

  async function renderPdfFirstPage(file) {
    try {
      const pdfjs = await import("./vendor/pdfjs/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.mjs";
      const documentTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const pdf = await documentTask.promise;
      const page = await pdf.getPage(1);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: WIDTH / original.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      await documentTask.destroy();
      return canvas;
    } catch (cause) {
      const error = new Error("This PDF is invalid, corrupted, password-protected, or encrypted. Upload a PDF whose first page can be opened.");
      error.cause = cause;
      throw error;
    }
  }

  async function validateEpub(file) {
    const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
    if (bytes.length < 58 || bytes[0] !== 0x50 || bytes[1] !== 0x4b ||
        bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      throw new Error("This EPUB is invalid or corrupted.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const filenameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const dataStart = 30 + filenameLength + extraLength;
    const expected = "application/epub+zip";
    const filename = new TextDecoder().decode(bytes.slice(30, 30 + filenameLength));
    const mimetype = new TextDecoder().decode(bytes.slice(dataStart, dataStart + expected.length));
    if (view.getUint16(8, true) !== 0 || filename !== "mimetype" || mimetype !== expected) {
      throw new Error("This EPUB is invalid or corrupted. Its required EPUB container metadata is missing.");
    }
    if (typeof window.ePub !== "function") {
      throw new Error("EPUB validation is unavailable. Refresh the page and try again.");
    }
    let book;
    try {
      book = window.ePub(await file.arrayBuffer());
      await book.ready;
      if (!book.spine?.spineItems?.length) throw new Error("No readable chapters");
    } catch (cause) {
      const error = new Error("This EPUB is invalid or corrupted and cannot be opened.");
      error.cause = cause;
      throw error;
    } finally {
      book?.destroy?.();
    }
    return "epub-container";
  }

  async function validateCover(file) {
    if (!file || !["image/jpeg", "image/png"].includes(file.type)) {
      throw new Error("The cover must be a JPG or PNG image.");
    }
    try {
      if ("createImageBitmap" in window) {
        const bitmap = await createImageBitmap(file);
        const valid = bitmap.width > 0 && bitmap.height > 0;
        bitmap.close();
        if (!valid) throw new Error();
      } else {
        await new Promise((resolve, reject) => {
          const image = new Image();
          const url = URL.createObjectURL(file);
          image.onload = () => { URL.revokeObjectURL(url); resolve(); };
          image.onerror = () => { URL.revokeObjectURL(url); reject(new Error()); };
          image.src = url;
        });
      }
    } catch {
      throw new Error("The cover image is invalid or corrupted.");
    }
    return "image-decoded";
  }

  window.FreeBookeryCover = {
    async validateManuscript(file) {
      if (file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf")) {
        await renderPdfFirstPage(file);
        return "pdfjs-first-page";
      }
      return validateEpub(file);
    },
    validateCover,
    async create(file, title) {
      if (file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf")) {
        return canvasFile(await renderPdfFirstPage(file), title);
      }
      await validateEpub(file);
      return brandedCover(title);
    },
  };
})();
