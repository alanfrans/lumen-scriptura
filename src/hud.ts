export interface DialogOption {
  label: string;
  disabled?: boolean;
  onPick: () => void;
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export class Hud {
  dialogOpen = false;
  codexOpen = false;
  private options: DialogOption[] = [];
  private lastStatus = "";
  private lastPrompt: string | null = null;
  private verseTimer = 0;

  setStatus(html: string): void {
    if (html === this.lastStatus) return;
    this.lastStatus = html;
    $("status").innerHTML = html;
  }

  setPrompt(text: string | null): void {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    const p = $("prompt");
    p.textContent = text ?? "";
    p.classList.toggle("hidden", !text);
  }

  toast(text: string): void {
    const list = $("toasts");
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    list.appendChild(t);
    while (list.children.length > 4) list.firstElementChild?.remove();
    setTimeout(() => t.classList.add("fade"), 4000);
    setTimeout(() => t.remove(), 4700);
  }

  showVerse(ref: string, text: string): void {
    const card = $("verse-card");
    (card.querySelector(".ref") as HTMLElement).textContent = ref;
    (card.querySelector(".text") as HTMLElement).textContent = text;
    card.classList.remove("hidden");
    clearTimeout(this.verseTimer);
    this.verseTimer = window.setTimeout(() => card.classList.add("hidden"), 8000);
  }

  openDialog(speaker: string, text: string, options: DialogOption[] = []): void {
    const d = $("dialog");
    (d.querySelector(".speaker") as HTMLElement).textContent = speaker;
    (d.querySelector(".text") as HTMLElement).textContent = text;
    const box = d.querySelector(".options") as HTMLElement;
    box.innerHTML = "";
    options.forEach((o, i) => {
      const b = document.createElement("button");
      b.textContent = `${i + 1}. ${o.label}`;
      b.disabled = !!o.disabled;
      b.addEventListener("click", () => this.pick(i));
      box.appendChild(b);
    });
    (d.querySelector(".close-hint") as HTMLElement).textContent = options.length
      ? "Press a number to choose · Esc to leave"
      : "E or Esc to close";
    this.options = options;
    d.classList.remove("hidden");
    this.dialogOpen = true;
  }

  pick(i: number): void {
    const o = this.options[i];
    if (!o || o.disabled) return;
    this.closeDialog();
    o.onPick();
  }

  get hasOptions(): boolean {
    return this.options.length > 0;
  }

  closeDialog(): void {
    $("dialog").classList.add("hidden");
    this.options = [];
    this.dialogOpen = false;
  }

  setCompass(angleDeg: number | null, text = ""): void {
    const c = $("compass");
    c.classList.toggle("hidden", angleDeg === null);
    if (angleDeg === null) return;
    $("compass-arrow").style.transform = `rotate(${angleDeg}deg)`;
    $("compass-text").textContent = text;
  }

  showCodex(html: string): void {
    const c = $("codex");
    c.innerHTML = html;
    c.classList.remove("hidden");
    this.codexOpen = true;
  }

  hideCodex(): void {
    $("codex").classList.add("hidden");
    this.codexOpen = false;
  }
}
