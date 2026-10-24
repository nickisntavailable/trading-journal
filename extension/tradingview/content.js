/**
 * Пункт «Открыть сделку в журнале» в контекстном меню инструмента
 * «Длинная/Короткая позиция» на tradingview.com.
 *
 * Работает в мире страницы (world: MAIN в manifest.json): иначе не видно
 * внутреннего объекта TradingView `window.TradingViewApi`, через который
 * читаются выделенная фигура и её уровни. Этот объект не документирован —
 * если TradingView его поменяет, пункт просто перестанет появляться, график
 * при этом не сломается: все обращения обёрнуты в try.
 *
 * Свой пункт — копия существующей строки меню с другим текстом: так он
 * выглядит родным и не зависит от классов вроде menuWrap-lBIxIwtz, которые
 * TradingView меняет при обновлениях.
 */
(function () {
  // Адрес журнала. Для превью-деплоя — поменять здесь и перезагрузить расширение.
  const JOURNAL_URL = "https://trading-journal-five-liart.vercel.app";
  const LABEL = "Открыть сделку в журнале";
  const MARK = "data-tj-journal-item";

  function activeChart() {
    try {
      return window.TradingViewApi?.activeChart?.() ?? null;
    } catch {
      return null;
    }
  }

  /** Выделенная позиция — правый клик по фигуре выделяет её до открытия меню. */
  function selectedPosition(chart) {
    const ids = chart.selection?.().allSources?.() ?? [];
    if (ids.length === 0) return null;
    const names = new Map((chart.getAllShapes?.() ?? []).map((s) => [s.id, s.name]));
    for (const id of ids) {
      const name = names.get(id);
      if (name === "long_position" || name === "short_position") return { id, name };
    }
    return null;
  }

  function readLink() {
    try {
      const chart = activeChart();
      if (!chart) return null;
      const position = selectedPosition(chart);
      if (!position) return null;

      const shape = chart.getShapeById(position.id);
      const points = shape.getPoints?.() ?? [];
      const props = shape.getProperties?.() ?? {};
      const levels = window.TJLevels.computeLevels({
        direction: position.name === "short_position" ? -1 : 1,
        entry: points[0]?.price,
        stopLevel: props.stopLevel,
        profitLevel: props.profitLevel,
        accountSize: props.accountSize,
        amountStop: props.amountStop,
        qty: props.qty,
        // Значение меньше единицы — чтобы в строке не было разделителя тысяч.
        formattedSample: chart.priceFormatter?.().format(0.123456789) ?? "",
      });
      if (!levels) return null;
      return window.TJLevels.journalUrl(JOURNAL_URL, chart.symbol(), levels);
    } catch (error) {
      console.warn("[trading-journal] не удалось прочитать позицию", error);
      return null;
    }
  }

  function closeMenu() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }),
    );
  }

  /** Вставить пункт первой строкой меню, если меню открыто для позиции. */
  function addItem(menu) {
    if (menu.querySelector(`[${MARK}]`)) return;
    const link = readLink();
    if (!link) return;

    const tbody = menu.querySelector('[data-qa-id="menu-inner"] tbody');
    const template = [...(tbody?.querySelectorAll(":scope > tr") ?? [])].find(
      (row) => row.textContent.trim().length > 0,
    );
    if (!template) return;

    const row = template.cloneNode(true);
    row.setAttribute(MARK, "");
    row.querySelectorAll("svg, img").forEach((el) => el.remove());
    // Листья с текстом: первый — подпись пункта, остальные (сочетание клавиш) — пустые.
    const leaves = [...row.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && el.textContent.trim().length > 0,
    );
    leaves.forEach((el, i) => {
      el.textContent = i === 0 ? LABEL : "";
    });
    row.title = link;

    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(127, 127, 127, 0.18)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "";
    });
    row.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(link, "_blank", "noopener");
        closeMenu();
      },
      true,
    );

    tbody.insertBefore(row, tbody.firstChild);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const menu = node.matches(".context-menu") ? node : node.querySelector(".context-menu");
        if (menu) addItem(menu);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
