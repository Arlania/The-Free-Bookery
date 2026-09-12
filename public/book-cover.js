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

  async function pdfFirstPage(file, title) {
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
      return canvasFile(canvas, title);
    } catch {
      return brandedCover(title);
    }
  }

  window.FreeBookeryCover = {
    create(file, title) {
      return file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf")
        ? pdfFirstPage(file, title)
        : brandedCover(title);
    },
  };
})();
